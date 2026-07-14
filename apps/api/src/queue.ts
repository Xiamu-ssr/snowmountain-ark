import type { InteractionJob, Session } from "@snowmountain/contracts";
import { Store } from "./db.js";
import type { AgentRuntime } from "./runtime.js";

export class InteractionQueue {
  private readonly activeSessions = new Set<string>();
  private pumping = false;
  private closed = false;

  constructor(
    private readonly store: Store,
    private readonly runtime: AgentRuntime,
    private readonly concurrency = 4,
    private readonly onError: (error: unknown) => void = () => undefined
  ) {
    store.recoverInterruptedJobs();
  }

  start(): void {
    this.pump();
  }

  enqueue(sessionId: string, content: string): InteractionJob {
    if (this.closed) throw new Error("Interaction queue is closed");
    const job = this.store.enqueueInteraction(sessionId, content);
    this.pump();
    return job;
  }

  async wait(jobId: string): Promise<InteractionJob> {
    for (;;) {
      const job = this.store.getInteractionJob(jobId);
      if (!job) throw new Error("Interaction job not found");
      if (job.status === "completed") return job;
      if (job.status === "failed") throw new Error(job.error ?? "Interaction failed");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  stop(sessionId: string): boolean {
    return this.store.cancelQueuedInteraction(sessionId) || this.runtime.stop(sessionId);
  }

  close(): void {
    this.closed = true;
  }

  private pump(): void {
    if (this.closed || this.pumping) return;
    this.pumping = true;
    queueMicrotask(() => {
      try {
        while (!this.closed && this.activeSessions.size < this.concurrency) {
          const job = this.store.claimNextInteraction(this.activeSessions);
          if (!job) break;
          this.activeSessions.add(job.sessionId);
          void this.execute(job);
        }
      } finally {
        this.pumping = false;
      }
    });
  }

  private async execute(job: InteractionJob): Promise<void> {
    try {
      await this.runtime.run(job.sessionId, job.content);
      this.store.finishInteractionJob(job.id, "completed");
    } catch (error) {
      this.store.finishInteractionJob(job.id, "failed", error instanceof Error ? error.message : String(error));
      this.onError(error);
    } finally {
      this.activeSessions.delete(job.sessionId);
      this.pump();
    }
  }
}
