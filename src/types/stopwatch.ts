export class Stopwatch {
  private _startTime = NaN;
  private _totalElapsed = 0;
  private _running = false;

  /**
   * start the stopwatch
   * @returns instance
   */
  start(): Stopwatch {
    this._startTime = performance.now();
    this._running = true;
    return this;
  }

  /**
   * stop the stopwatch
   * @returns instance
   */
  stop(): Stopwatch {
    if (this._running) {
      this._running = false;
      this._totalElapsed += performance.now() - this._startTime;
    }
    return this;
  }

  /**
   * reset the stopwatch
   * @returns instance
   */
  reset(): Stopwatch {
    this._totalElapsed = 0;
    this._startTime = this._running ? performance.now() : NaN;
    return this;
  }

  get running(): boolean {
    return this._running;
  }

  get elapsedTime(): number {
    return this._running
      ? this._totalElapsed + performance.now() - this._startTime
      : this._totalElapsed;
  }
}
