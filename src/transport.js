export class HttpTransport {
  constructor(endpoint) { this.endpoint = endpoint; }
  async send(event, { timeoutMs }) {
    try {
      const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': event.eventId }, body: JSON.stringify(event), signal: AbortSignal.timeout(timeoutMs) });
      return { ok: response.status >= 200 && response.status < 300, status: response.status, retryable: response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500 };
    } catch (error) { return { ok: false, retryable: true, error: error.name === 'TimeoutError' ? 'request timed out' : error.message }; }
  }
}
