import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** JSON file store with serialized mutations. Replace with a DB transaction in multi-process deployment. */
export class FileStore {
  constructor(path) { this.path = path; this.jobs = new Map(); this.tail = Promise.resolve(); }
  async init() {
    await mkdir(dirname(this.path), { recursive: true });
    try { JSON.parse(await readFile(this.path, 'utf8')).forEach((job) => this.jobs.set(job.id, job)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  async createIfAbsent(job) { return this.mutate(() => { const existing = this.jobs.get(job.id); if (existing) return { job: structuredClone(existing), created: false }; this.jobs.set(job.id, job); return { job: structuredClone(job), created: true }; }); }
  async get(id) { const job = this.jobs.get(id); return job && structuredClone(job); }
  async claimDue(now) { return this.mutate(() => { const job = [...this.jobs.values()].filter((j) => j.state === 'pending' && j.nextAttemptAt <= now).sort((a,b) => a.nextAttemptAt.localeCompare(b.nextAttemptAt))[0]; if (!job) return null; job.state = 'delivering'; job.updatedAt = now; return structuredClone(job); }); }
  async finish(id, update) { return this.mutate(() => { const job = this.require(id); if (job.state !== 'delivering') throw new Error(`Cannot finish ${id}: not delivering`); job.attempts.push(update.attempt); job.state = update.state; job.updatedAt = update.completedAt; job.nextAttemptAt = update.nextAttemptAt ?? null; return structuredClone(job); }); }
  async requeueDelivering(now) { return this.mutate(() => { for (const job of this.jobs.values()) if (job.state === 'delivering') { job.state = 'pending'; job.nextAttemptAt = now; job.updatedAt = now; } }); }
  require(id) { const job = this.jobs.get(id); if (!job) throw new Error(`Unknown event: ${id}`); return job; }
  async mutate(operation) { const work = this.tail.then(async () => { const value = operation(); await this.persist(); return value; }); this.tail = work.catch(() => {}); return work; }
  async persist() { const temp = `${this.path}.tmp`; await writeFile(temp, JSON.stringify([...this.jobs.values()], null, 2)); await rename(temp, this.path); }
}
