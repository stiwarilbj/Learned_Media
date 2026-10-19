type Receipt = { resolve: () => void; reject: (error: unknown) => void };
type Entry<T> = { snapshot: T; receipts: Receipt[] };

/** One immutable active write and one replaceable, newest waiting snapshot. */
export class LatestSnapshotQueue<T> {
  private active?: Entry<T>;
  private pending?: Entry<T>;
  private running = false;

  constructor(private readonly write: (snapshot: T) => Promise<void>) {}

  get hasUnacknowledged() { return Boolean(this.active || this.pending); }
  get isWriting() { return this.running; }

  enqueue(snapshot: T): Promise<void> {
    const receipt = new Promise<void>((resolve, reject) => {
      if (!this.active) this.active = { snapshot, receipts: [{ resolve, reject }] };
      else {
        // Callers superseded before sending are acknowledged by the newest write.
        const receipts = this.pending?.receipts ?? [];
        receipts.push({ resolve, reject });
        this.pending = { snapshot, receipts };
      }
    });
    if (!this.running) void this.drain();
    return receipt;
  }

  private async drain() {
    this.running = true;
    while (this.active) {
      const entry = this.active;
      try {
        await this.write(entry.snapshot);
      } catch (error) {
        // Keep both snapshots for a later retry, including the exact active revision.
        // Reject this attempt's callers so failures remain visible without a retry loop.
        for (const item of [entry, this.pending]) {
          item?.receipts.splice(0).forEach(receipt => receipt.reject(error));
        }
        this.running = false;
        return;
      }
      this.active = this.pending;
      this.pending = undefined;
      entry.receipts.forEach(receipt => receipt.resolve());
    }
    this.running = false;
  }
}
