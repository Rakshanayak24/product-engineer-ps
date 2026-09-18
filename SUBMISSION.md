# Product Engineering Challenge Submission

## Candidate

* Name: Raksha Nayak
* Email: rakshanayak40@gmail.com
* GitHub: https://github.com/Rakshanayak24/product-engineer-ps
* Selected problem: **Problem 2 — Webhook Retry Engine**
* Demo video: https://drive.google.com/file/d/1tTOV01KhYPFJ3JtrQ80q2yTApL8xLcdV/view?usp=sharing

## Run the project

Prerequisite: Node.js 20+ (Node 22+ recommended). No package installation is required.

```powershell
# terminal 1: successful receiver (or RECEIVER_MODE=flaky / fail)
npm.cmd run demo:receiver

# terminal 2: delivery service; delays are shortened for the demo
$env:WEBHOOK_URL='http://localhost:4000/webhooks'; $env:BASE_DELAY_MS='250'; npm.cmd start

# terminal 3: submit and inspect
curl.exe -X POST http://localhost:3000/events -H "content-type: application/json" -d '{"eventId":"evt_demo_1","type":"incident.created","occurredAt":"2026-09-15T10:00:00Z","payload":{"incidentId":"inc_456","severity":"high"}}'
curl.exe http://localhost:3000/events/evt_demo_1
```

Use `RECEIVER_MODE=flaky` in terminal 1 to return 503 twice then 204; inspect the ordered `attempts` array. Submit the same body again to demonstrate idempotency: it returns `200` and `created: false`, without a second job. Use `RECEIVER_MODE=fail` to show terminal failure after four attempts. `POST /admin/drain` is available to manually process currently due work in a demo.

## Run the tests

```powershell
npm.cmd test
```

The tests use a deterministic fake transport and clock—no sleeps, network, or paid services. They cover success, temporary failure/retry, attempt exhaustion, and idempotent ingestion.

## Architecture and data flow

```
POST /events → validation → FileStore create-if-absent (durable) → pending job
                                                          ↓
GET /events/:id ← attempt history ← engine claims due job → HTTP transport → finish state
```

`server.js` owns HTTP concerns; `WebhookEngine` owns the delivery state machine; `FileStore` owns serialized durable mutations and atomic file replacement; `HttpTransport` owns HTTP classification. The persisted job is the source of truth: original event, state, schedule, and ordered immutable attempt records.

States are `pending → delivering → succeeded|pending|failed`. On startup, stranded `delivering` work is re-queued. This intentionally favors at-least-once delivery over losing an accepted event.

## Technology choices

Node’s built-in HTTP/fetch/test APIs keep the review setup under a minute and make interfaces explicit without framework plumbing. JSON-file persistence is appropriate for the single-process exercise; a transactional database and lease-based queue would replace it in production. I chose an injected transport and clock to test delivery policy deterministically rather than rely on timing-sensitive integration tests.

## Important decisions

1. **Idempotency key = caller-supplied `eventId`.** FileStore serializes mutations in-process, so concurrent requests cannot create duplicate logical jobs. A production database would enforce `UNIQUE(event_id)` in the same transaction as job creation.
2. **Retry policy is intentionally selective.** Retry transport failures/timeouts and HTTP 408, 425, 429, and 5xx; treat other 4xx responses as terminal. Retry up to 4 total attempts with capped exponential delays (1s, 2s, 4s; configurable).
3. **At-least-once semantics.** A successful receiver response can be lost if the process crashes before persisting it; restart may resend. The event ID is sent as `Idempotency-Key`, and receivers must deduplicate it.

Each attempt retains a UUID, number, start/completion timestamps, status (if any), safe error message, outcome, and retryability. Response bodies are deliberately not retained, avoiding accidental persistence of large or sensitive downstream data.

## Assumptions and limitations

One configured endpoint and one Node process are in scope. The in-process mutation queue protects same-process concurrency only; JSON files are not multi-writer safe. There is no request authentication, signing, rate limiting, endpoint circuit breaker, manual replay, or dead-letter UI. The process polls only when work is submitted or `/admin/drain` is called; production would use a scheduler/queue wake-up.

## Production and scale

First, replace FileStore with Postgres (`events`, `deliveries`) and atomically claim work via `FOR UPDATE SKIP LOCKED` plus lease expiry. Use a durable queue/outbox and workers, per-endpoint concurrency limits/token buckets, jittered backoff, circuit breakers, and a dead-letter/replay workflow. Emit queue depth, delivery latency, outcome/status counts, retry count, lease recovery, and endpoint-specific error-rate metrics; alert on sustained backlog, terminal-failure spikes, and endpoint degradation. Keep payloads encrypted/minimized and sign outbound requests.

## AI usage

OpenAI Codex was used to help implement, review, and test this submission. I reviewed the design, retry semantics, and all code paths, and can explain or modify every part of it.

## Credibility note

I helped build Store Provisioning Platform, a Kubernetes-based backend platform designed to automate and simplify the provisioning and management of stores and their services.

My personal contribution included backend APIs, service integration, Kubernetes-based provisioning, and CI/CD automation. I was mainly responsible for implementing the backend functionality and deployment workflow.

The project involved multiple services, API integrations, containerized workloads, Kubernetes deployments, and automated CI/CD workflows.

One challenging decision was using Kubernetes for managing the store services instead of handling deployments manually. I chose this approach because it makes the system easier to automate, manage, and scale, although it adds some infrastructure complexity.

Evidence: GitHub repository — https://github.com/Rakshanayak24/Store-provisioning-platform
