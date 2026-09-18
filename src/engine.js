import { randomUUID } from 'node:crypto';

export const DeliveryState = Object.freeze({ PENDING: 'pending', DELIVERING: 'delivering', SUCCEEDED: 'succeeded', FAILED: 'failed' });

export function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function retryDelayMs(attemptNumber, baseDelayMs, maxDelayMs) {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attemptNumber - 1));
}

/** Coordinates ingestion, durable state changes, and one-at-a-time delivery. */
export class WebhookEngine {
  constructor({ store, transport, clock = () => new Date(), config = {}, logger = console }) {
    this.store = store;
    this.transport = transport;
    this.clock = clock;
    this.logger = logger;
    this.config = { maxAttempts: 4, baseDelayMs: 1000, maxDelayMs: 30_000, timeoutMs: 5000, ...config };
    this.running = false;
  }

  async recover() {
    // A process may die after claiming work; that attempt is indeterminate and remains in history.
    // Re-queue it so the at-least-once guarantee is preserved.
    await this.store.requeueDelivering(this.clock().toISOString());
  }

  async ingest(event) {
    validateEvent(event);
    const now = this.clock().toISOString();
    return this.store.createIfAbsent({
      id: event.eventId,
      event,
      state: DeliveryState.PENDING,
      attempts: [],
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
    });
  }

  async processDue() {
    if (this.running) return 0;
    this.running = true;
    let count = 0;
    try {
      while (true) {
        const job = await this.store.claimDue(this.clock().toISOString());
        if (!job) break;
        count += 1;
        await this.deliver(job);
      }
    } finally {
      this.running = false;
    }
    return count;
  }

  async deliver(job) {
    const attemptNumber = job.attempts.length + 1;
    const startedAt = this.clock().toISOString();
    let result;
    try {
      result = await this.transport.send(job.event, { timeoutMs: this.config.timeoutMs });
    } catch (error) {
      result = { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error) };
    }
    const completedAt = this.clock().toISOString();
    const attempt = {
      id: randomUUID(), attemptNumber, startedAt, completedAt,
      outcome: result.ok ? 'success' : 'failure',
      httpStatus: result.status ?? null,
      error: result.error ?? null,
      retryable: !result.ok && result.retryable === true,
    };
    if (result.ok) {
      await this.store.finish(job.id, { state: DeliveryState.SUCCEEDED, attempt, completedAt });
      this.logger.info?.({ eventId: job.id, attemptNumber, state: 'succeeded' }, 'webhook delivered');
      return;
    }
    const exhausted = attemptNumber >= this.config.maxAttempts;
    const state = !attempt.retryable || exhausted ? DeliveryState.FAILED : DeliveryState.PENDING;
    const nextAttemptAt = state === DeliveryState.PENDING
      ? new Date(this.clock().getTime() + retryDelayMs(attemptNumber, this.config.baseDelayMs, this.config.maxDelayMs)).toISOString()
      : null;
    await this.store.finish(job.id, { state, attempt, completedAt, nextAttemptAt });
    this.logger.warn?.({ eventId: job.id, attemptNumber, state, retryable: attempt.retryable }, 'webhook delivery failed');
  }
}

function validateEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Event body must be a JSON object');
  for (const field of ['eventId', 'type', 'occurredAt']) {
    if (typeof event[field] !== 'string' || !event[field].trim()) throw new Error(`event.${field} must be a non-empty string`);
  }
  if (!Number.isFinite(Date.parse(event.occurredAt))) throw new Error('event.occurredAt must be an ISO-8601 timestamp');
  if (!Object.hasOwn(event, 'payload')) throw new Error('event.payload is required');
}
