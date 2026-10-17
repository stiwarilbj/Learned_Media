export const KEY_PROVIDERS = ["gemini", "youtube"] as const;
export type KeyProvider = typeof KEY_PROVIDERS[number];
export type Credential = { value: string; pending: "edit" | "import" | null };
export type AccountKeys = Record<KeyProvider, string>;
type CredentialIO = {
  read(owner: string | null, provider: KeyProvider): Promise<Credential | undefined>;
  write(owner: string | null, provider: KeyProvider, entry?: Credential): Promise<void>;
  load(owner: string, signal: AbortSignal): Promise<Partial<AccountKeys>>;
  save(owner: string, provider: KeyProvider, value: string, signal: AbortSignal): Promise<void>;
  changed(keys: AccountKeys): void;
  status(state: "syncing" | "synced" | "local" | "error", message?: string): void;
};

/** Account-scoped local recovery plus per-provider cloud writes. Never put keys in workspaces. */
export class AccountCredentials {
  private owner: string | null = null;
  private epoch = 0;
  private entries: Partial<Record<KeyProvider, Credential>> = {};
  private revisions = { gemini: 0, youtube: 0 };
  private writes: Promise<unknown> = Promise.resolve();
  private controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private running?: { epoch: number; promise: Promise<void> };
  constructor(private io: CredentialIO) {}
  private current(epoch: number) { return epoch === this.epoch && !this.controller.signal.aborted; }
  private publish() { this.io.changed({ gemini: this.entries.gemini?.value ?? "", youtube: this.entries.youtube?.value ?? "" }); }
  private persist(owner: string | null, provider: KeyProvider, entry?: Credential) {
    const work = this.writes.catch(() => undefined).then(() => this.io.write(owner, provider, entry));
    this.writes = work;
    return work;
  }
  async switchAccount(owner: string | null) {
    const previousOwner = this.owner;
    const guest = previousOwner === null ? this.entries : {};
    this.controller.abort();
    clearTimeout(this.timer);
    const epoch = ++this.epoch;
    this.controller = new AbortController();
    this.owner = owner;
    this.entries = {};
    this.publish();
    this.io.status(owner ? "syncing" : "local");
    const revisions = { ...this.revisions };
    try {
      await this.writes.catch(() => undefined);
      const local = await Promise.all(KEY_PROVIDERS.map(provider => this.io.read(owner, provider)));
      for (const [index, provider] of KEY_PROVIDERS.entries()) {
        if (!this.current(epoch)) return;
        if (this.revisions[provider] !== revisions[provider]) {
          if (owner && guest[provider]?.value) {
            // An edit during restoration already queued its account copy.
            // Wait for durability before retiring the legacy guest copy.
            await this.writes;
            if (!this.current(epoch)) return;
            await this.persist(null, provider);
          }
          continue;
        }
        let entry = local[index];
        if (!entry && owner && previousOwner === null && guest[provider]?.value) {
          entry = { value: guest[provider]!.value, pending: "import" };
          await this.persist(owner, provider, entry);
        }
        if (!this.current(epoch)) return;
        if (this.revisions[provider] === revisions[provider] && entry) this.entries[provider] = entry;
        // Claim legacy device keys only after a durable account-scoped recovery copy.
        if (owner && guest[provider]?.value && entry) await this.persist(null, provider);
      }
      if (!this.current(epoch)) return;
      this.publish();
      if (owner) await this.refresh();
    } catch {
      if (this.current(epoch)) this.io.status("error", "API keys could not be restored. Local keys are retained; reconnect to retry.");
    }
  }
  edit(provider: KeyProvider, value: string) {
    const epoch = this.epoch, owner = this.owner;
    const entry: Credential = { value: value.trim(), pending: owner ? "edit" : null };
    this.revisions[provider]++;
    this.entries[provider] = entry;
    this.publish();
    this.io.status(owner ? "syncing" : "local");
    void this.persist(owner, provider, entry).catch(() => {
      if (this.current(epoch)) this.io.status("error", "This API key could not be saved on this device.");
    });
    clearTimeout(this.timer);
    if (owner) this.timer = setTimeout(() => void this.refresh(), 500);
  }
  refresh(): Promise<void> {
    const epoch = this.epoch, owner = this.owner, signal = this.controller.signal;
    if (!owner) return Promise.resolve();
    if (this.running?.epoch === epoch) return this.running.promise;
    const work = this.sync(owner, epoch, signal).finally(() => {
      if (this.running?.epoch === epoch) this.running = undefined;
    });
    this.running = { epoch, promise: work };
    return work;
  }
  private async sync(owner: string, epoch: number, signal: AbortSignal) {
    this.io.status("syncing");
    try {
      const revisions = { ...this.revisions };
      const remote = await this.io.load(owner, signal);
      if (!this.current(epoch)) return;
      for (const provider of KEY_PROVIDERS) {
        if (!this.current(epoch)) return;
        const entry = this.entries[provider];
        const editedWhileLoading = revisions[provider] !== this.revisions[provider];
        if (!editedWhileLoading && entry?.pending !== "edit" && remote[provider] !== undefined
          && (entry?.value !== remote[provider] || entry?.pending !== null)) {
          const restored: Credential = { value: remote[provider]!, pending: null };
          // Commit before adopting it so failed storage writes remain retryable.
          await this.persist(owner, provider, restored);
          if (!this.current(epoch)) return;
          if (this.revisions[provider] === revisions[provider]) {
            this.entries[provider] = restored;
            this.publish();
          }
        }
        // Serialize writes and re-check edits after each response; an older save
        // must never mark a newer key (or a removal) as already synchronized.
        while (this.current(epoch) && this.entries[provider]?.pending) {
          const current = this.entries[provider]!;
          const revision = this.revisions[provider];
          await this.persist(owner, provider, current);
          if (!this.current(epoch)) return;
          await this.io.save(owner, provider, current.value, signal);
          if (!this.current(epoch)) return;
          if (this.revisions[provider] === revision) {
            this.entries[provider] = { value: current.value, pending: null };
            await this.persist(owner, provider, this.entries[provider]);
          }
        }
      }
      if (this.current(epoch)) {
        this.publish();
        const pending = KEY_PROVIDERS.some(provider => this.entries[provider]?.pending);
        this.io.status(pending ? "syncing" : "synced");
        if (pending) this.timer = setTimeout(() => void this.refresh(), 0);
      }
    } catch {
      if (this.current(epoch)) this.io.status("error", "API key sync is unavailable. Your keys remain saved on this device and will retry when you reconnect.");
    }
  }
  dispose() { ++this.epoch; this.controller.abort(); clearTimeout(this.timer); }
}
