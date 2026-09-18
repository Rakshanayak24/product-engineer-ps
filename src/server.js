import http from 'node:http';
import { join } from 'node:path';
import { FileStore } from './store.js';
import { WebhookEngine } from './engine.js';
import { HttpTransport } from './transport.js';

const port = Number(process.env.PORT ?? 3000);
const endpoint = process.env.WEBHOOK_URL ?? 'http://localhost:4000/webhooks';
const store = new FileStore(process.env.DATA_FILE ?? join(process.cwd(), 'data', 'webhooks.json'));
await store.init();
const engine = new WebhookEngine({ store, transport: new HttpTransport(endpoint), config: configFromEnv() });
await engine.recover();
// The engine only claims work whose persisted due time has arrived. This timer is a
// simple scheduler for the single-process prototype; it also resumes retry work
// after a restart without requiring a new ingestion request.
const scheduler = setInterval(() => { void engine.processDue(); }, Math.min(1000, configFromEnv().baseDelayMs));

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true });
    if (request.method === 'GET' && url.pathname.startsWith('/events/')) {
      const job = await store.get(decodeURIComponent(url.pathname.slice('/events/'.length)));
      return job ? json(response, 200, publicJob(job)) : json(response, 404, { error: 'event not found' });
    }
    if (request.method === 'POST' && url.pathname === '/events') {
      const result = await engine.ingest(await body(request));
      // Processing after durable acceptance keeps the caller response independent of receiver latency.
      void engine.processDue();
      return json(response, result.created ? 202 : 200, { id: result.job.id, created: result.created, state: result.job.state, statusUrl: `/events/${encodeURIComponent(result.job.id)}` });
    }
    if (request.method === 'POST' && url.pathname === '/admin/drain') return json(response, 200, { processed: await engine.processDue() });
    json(response, 404, { error: 'not found' });
  } catch (error) { json(response, error instanceof SyntaxError || String(error.message).startsWith('Event') ? 400 : 500, { error: error.message }); }
});
server.listen(port, () => console.log(`Webhook engine listening on :${port}; endpoint=${endpoint}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(scheduler); server.close(() => process.exit(0)); });

function configFromEnv() { return { maxAttempts: numberEnv('MAX_ATTEMPTS', 4), baseDelayMs: numberEnv('BASE_DELAY_MS', 1000), maxDelayMs: numberEnv('MAX_DELAY_MS', 30000), timeoutMs: numberEnv('TIMEOUT_MS', 5000) }; }
function numberEnv(name, fallback) { const value = Number(process.env[name]); return Number.isFinite(value) && value > 0 ? value : fallback; }
function json(response, status, value) { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); }
async function body(request) { let raw = ''; for await (const part of request) { raw += part; if (raw.length > 1_000_000) throw new Error('body too large'); } return JSON.parse(raw); }
function publicJob(job) { return job; }
