import http from 'node:http';

// Set RECEIVER_MODE=flaky to fail the first two deliveries for each event, or fail for permanent 503s.
const mode = process.env.RECEIVER_MODE ?? 'success';
const seen = new Map();
http.createServer(async (req, res) => {
  let raw = ''; for await (const part of req) raw += part;
  const event = JSON.parse(raw); const count = (seen.get(event.eventId) ?? 0) + 1; seen.set(event.eventId, count);
  console.log(JSON.stringify({ received: event.eventId, attempt: count, idempotencyKey: req.headers['idempotency-key'] }));
  const status = mode === 'fail' || (mode === 'flaky' && count < 3) ? 503 : 204;
  res.writeHead(status); res.end();
}).listen(4000, () => console.log(`Demo receiver (${mode}) listening on :4000`));
