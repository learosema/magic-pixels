/**
 * Generic Web Worker pool: spawns `Worker`s lazily up to `workerLimit`
 * (default 4), reused round-robin once that limit is reached, and
 * correlates `postMessage` responses back to callers by the `id` each
 * request and response carries. What to send and how to interpret a
 * response - including telling a decode error apart from a decoded
 * result - is the caller's job, not this class's: {@link DracoWorkerPool}
 * and `MeshoptWorkerPool` each build their own request/response protocol
 * on top of it.
 */
export type WorkerPoolOptions = {
  workerLimit?: number;
};

export class WorkerPool<Response extends { id: number }> {
  private readonly workers: Worker[] = [];
  private nextWorker = 0;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (response: Response) => void; reject: (error: Error) => void }
  >();

  constructor(
    private readonly workerUrl: string | URL,
    private readonly options: WorkerPoolOptions = {}
  ) {}

  /** A fresh id for a new request, to correlate its response */
  nextRequestId(): number {
    return this.nextId++;
  }

  /** Send `message` (`message.id` from {@link nextRequestId}) to the next available worker */
  send(message: { id: number }, transfer: Transferable[]): Promise<Response> {
    const worker = this.getWorker();
    return new Promise((resolve, reject) => {
      this.pending.set(message.id, { resolve, reject });
      worker.postMessage(message, transfer);
    });
  }

  /** Terminate every spawned worker; further `send()` calls spawn fresh ones */
  dispose(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers.length = 0;
    this.nextWorker = 0;
    this.pending.clear();
  }

  private getWorker(): Worker {
    const limit = this.options.workerLimit ?? 4;
    if (this.workers.length < limit) {
      const worker = new Worker(this.workerUrl);
      worker.onmessage = (event: MessageEvent<Response>) =>
        this.handleMessage(event.data);
      worker.onerror = (event: ErrorEvent) => this.handleFatal(event);
      this.workers.push(worker);
      return worker;
    }
    const worker = this.workers[this.nextWorker];
    this.nextWorker = (this.nextWorker + 1) % this.workers.length;
    return worker;
  }

  private handleMessage(response: Response): void {
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    this.pending.delete(response.id);
    pending.resolve(response);
  }

  /** A worker itself failed (e.g. the decoder script 404s): fail every request in flight */
  private handleFatal(event: ErrorEvent): void {
    const error = Error(`glTF: worker error: ${event.message}`);
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
