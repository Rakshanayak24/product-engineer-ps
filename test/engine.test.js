import test from 'node:test';
import assert from 'node:assert/strict';
import { WebhookEngine } from '../src/engine.js';

class MemoryStore {
  constructor() { this.jobs = new Map(); }
  async createIfAbsent(job) { const old = this.jobs.get(job.id); if (old) return { job: structuredClone(old), created: false }; this.jobs.set(job.id, structuredClone(job)); return { job: structuredClone(job), created: true }; }
  async get(id) { return structuredClone(this.jobs.get(id)); }
  async claimDue(now) { const job = [...this.jobs.values()].find(j => j.state === 'pending' && j.nextAttemptAt <= now); if (!job) return null; job.state = 'delivering'; return structuredClone(job); }
  async finish(id, update) { const j = this.jobs.get(id); j.attempts.push(update.attempt); j.state = update.state; j.nextAttemptAt = update.nextAttemptAt ?? null; j.updatedAt = update.completedAt; }
  async requeueDelivering() {}
}
const event = (id = 'evt-1') => ({ eventId: id, type: 'incident.created', occurredAt: '2026-09-15T10:00:00Z', payload: { incidentId: 'i1' } });
function harness(outcomes, config = {}) { let now = new Date('2026-09-15T10:00:00Z'); const store = new MemoryStore(); const engine = new WebhookEngine({ store, clock: () => now, transport: { send: async () => outcomes.shift() }, config: { baseDelayMs: 1, maxDelayMs: 10, ...config }, logger: { info() {}, warn() {} } }); return { store, engine, advance: (ms) => { now = new Date(now.getTime() + ms); } }; }

test('records a successful delivery', async () => { const h = harness([{ ok: true, status: 204 }]); await h.engine.ingest(event()); await h.engine.processDue(); const job = await h.store.get('evt-1'); assert.equal(job.state, 'succeeded'); assert.deepEqual(job.attempts.map(a => [a.attemptNumber, a.outcome, a.httpStatus]), [[1, 'success', 204]]); });
test('retries a temporary failure and records ordered history', async () => { const h = harness([{ ok: false, status: 503, retryable: true }, { ok: true, status: 200 }]); await h.engine.ingest(event()); await h.engine.processDue(); h.advance(1); await h.engine.processDue(); const job = await h.store.get('evt-1'); assert.equal(job.state, 'succeeded'); assert.deepEqual(job.attempts.map(a => a.outcome), ['failure', 'success']); });
test('stops after bounded retryable failures', async () => { const h = harness([{ ok: false, status: 503, retryable: true }, { ok: false, status: 503, retryable: true }, { ok: false, status: 503, retryable: true }], { maxAttempts: 3 }); await h.engine.ingest(event()); for (let i = 0; i < 3; i++) { await h.engine.processDue(); h.advance(10); } const job = await h.store.get('evt-1'); assert.equal(job.state, 'failed'); assert.equal(job.attempts.length, 3); });
test('deduplicates repeated ingestion by caller event id', async () => { const h = harness([]); const first = await h.engine.ingest(event()); const duplicate = await h.engine.ingest(event()); assert.equal(first.created, true); assert.equal(duplicate.created, false); assert.equal(h.store.jobs.size, 1); });
