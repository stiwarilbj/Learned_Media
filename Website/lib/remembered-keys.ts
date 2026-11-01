import { createDatabaseConnection } from "./indexed-db";
import type { Credential, CredentialChange, KeyProvider } from "./account-credentials";
type Provider = KeyProvider;
const keyId = (provider: Provider, owner: string | null) => owner ? `account:${owner}:${provider}` : provider;
const DB = "learned-media-private-keys";
const CHANGE_REVISION_ID = "credential-change-revision";
const CHANGE_CHANNEL = "learned-media-credential-change-v1";
const CHANGE_STORAGE_KEY = "learned-media-credential-change-v1";
const MAX_TRACKED_ACCOUNTS = 128;
let queue = Promise.resolve();
type CredentialChangeListener = (change: CredentialChange) => void;
const credentialChangeListeners = new Set<CredentialChangeListener>();
const latestCredentialRevisions = new Map<string, number>();
const ownCredentialRevisions = new Map<string, number>();
let credentialChangeChannel: BroadcastChannel | undefined;
let credentialStorageListener: ((event: StorageEvent) => void) | undefined;
const open = createDatabaseConnection(DB, 1, database => {
  if (!database.objectStoreNames.contains("keys")) database.createObjectStore("keys");
});

function get<T>(db: IDBDatabase, id: string): Promise<T | undefined>;
function get<T extends unknown[]>(db: IDBDatabase, ids: readonly string[]): Promise<T>;
function get<T>(db: IDBDatabase, idOrIds: string | readonly string[]): Promise<T | T[] | undefined> {
  return new Promise((resolve, reject) => {
    const ids = typeof idOrIds === "string" ? [idOrIds] : idOrIds;
    const transaction = db.transaction("keys", "readonly");
    const results: unknown[] = new Array(ids.length);
    ids.forEach((id, index) => {
      const request = transaction.objectStore("keys").get(id);
      request.onsuccess = () => { results[index] = request.result; };
      request.onerror = () => reject(request.error);
    });
    transaction.oncomplete = () => resolve((typeof idOrIds === "string" ? results[0] : results) as T | T[] | undefined);
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Credential storage could not be read."));
  });
}
function credentialScope(change: Pick<CredentialChange, "account" | "provider">) {
  return JSON.stringify([change.account, change.provider]);
}
function rememberRevision(map: Map<string, number>, scope: string, revision: number) {
  map.delete(scope);
  map.set(scope, revision);
  while (map.size > MAX_TRACKED_ACCOUNTS) map.delete(map.keys().next().value!);
}
function parseCredentialChange(value: unknown): CredentialChange | undefined {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const change = value as Partial<CredentialChange>;
  if (Object.keys(change).length !== 3
    || !(change.account === null || typeof change.account === "string" && change.account.length <= 256)
    || !(change.provider === "gemini" || change.provider === "youtube")
    || !Number.isSafeInteger(change.revision) || (change.revision ?? 0) < 1) return;
  return { account: change.account!, provider: change.provider, revision: change.revision! };
}
function receiveCredentialChange(value: unknown) {
  const change = parseCredentialChange(value);
  if (!change) return;
  const scope = credentialScope(change);
  if (change.revision <= (latestCredentialRevisions.get(scope) ?? 0)) return;
  rememberRevision(latestCredentialRevisions, scope, change.revision);
  if (change.revision === ownCredentialRevisions.get(scope)) return;
  for (const listener of credentialChangeListeners) listener(change);
}
function startCredentialChangeListeners() {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      credentialChangeChannel = new BroadcastChannel(CHANGE_CHANNEL);
      credentialChangeChannel.onmessage = event => receiveCredentialChange(event.data);
    }
  } catch { /* Storage events remain the cross-tab fallback. */ }
  if (typeof window !== "undefined") {
    credentialStorageListener = event => {
      if (event.key === CHANGE_STORAGE_KEY && event.newValue) receiveCredentialChange(event.newValue);
    };
    window.addEventListener("storage", credentialStorageListener);
  }
}
function stopCredentialChangeListeners() {
  credentialChangeChannel?.close();
  credentialChangeChannel = undefined;
  if (credentialStorageListener && typeof window !== "undefined") window.removeEventListener("storage", credentialStorageListener);
  credentialStorageListener = undefined;
}
/** Listen for metadata-only notices; subscribers reread their own encrypted record. */
export function subscribeCredentialChanges(listener: CredentialChangeListener) {
  credentialChangeListeners.add(listener);
  if (credentialChangeListeners.size === 1) startCredentialChangeListeners();
  return () => {
    credentialChangeListeners.delete(listener);
    if (!credentialChangeListeners.size) stopCredentialChangeListeners();
  };
}
function broadcastCredentialChange(change: CredentialChange) {
  const scope = credentialScope(change);
  rememberRevision(latestCredentialRevisions, scope, change.revision);
  rememberRevision(ownCredentialRevisions, scope, change.revision);
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(CHANGE_CHANNEL);
      channel.postMessage(change);
      channel.close();
    }
  } catch { /* Storage events remain the cross-tab fallback. */ }
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(CHANGE_STORAGE_KEY, JSON.stringify(change));
  } catch { /* BroadcastChannel and encrypted storage remain available. */ }
}
async function putCredential(db: IDBDatabase, id: string, value: unknown, account: string | null, provider: Provider): Promise<number> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("keys", "readwrite");
    const store = transaction.objectStore("keys");
    let revision: number | undefined;
    let failure: unknown;
    const request = store.get(CHANGE_REVISION_ID);
    request.onsuccess = () => {
      const previous = Number.isSafeInteger(request.result) && request.result >= 0 ? request.result as number : 0;
      if (previous >= Number.MAX_SAFE_INTEGER) {
        failure = new Error("Credential change revision is exhausted.");
        transaction.abort();
        return;
      }
      revision = previous + 1;
      if (value === undefined) store.delete(id);
      else store.put(value, id);
      store.put(revision, CHANGE_REVISION_ID);
    };
    request.onerror = () => {
      failure = request.error;
      transaction.abort();
    };
    transaction.oncomplete = () => revision === undefined
      ? reject(failure ?? new Error("Credential change revision could not be saved."))
      : resolve(revision);
    transaction.onerror = transaction.onabort = () => reject(failure ?? transaction.error ?? new Error("Credential could not be saved."));
  });
}
async function getOrCreateDeviceKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await get<CryptoKey>(db, "device-key");
  if (existing) return existing;

  // Generate outside IndexedDB, then select/install atomically. Another tab may
  // have created the device key after the readonly lookup above.
  const candidate = await crypto.subtle.generateKey({name:"AES-GCM", length:256}, false, ["encrypt", "decrypt"]);
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("keys", "readwrite");
    const store = transaction.objectStore("keys");
    let selected: CryptoKey | undefined;
    const request = store.get("device-key");
    request.onsuccess = () => {
      const stored = request.result as CryptoKey | undefined;
      selected = stored ?? candidate;
      if (!stored) store.put(candidate, "device-key");
    };
    transaction.oncomplete = () => {
      if (selected) resolve(selected);
      else reject(new Error("Credential encryption key could not be selected."));
    };
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Credential encryption key could not be stored."));
  });
}
/** Device-local convenience, not protection against scripts running on this origin. */
export function saveCredential(provider: Provider, owner: string | null, entry?: Credential) {
  const id = keyId(provider, owner);
  const value = entry ? JSON.stringify(entry) : "";
  const work = queue.catch(() => undefined).then(async () => {
    const db = await open();
    let saved: { iv: Uint8Array; ciphertext: ArrayBuffer } | undefined;
    if (value.trim()) {
      const key = await getOrCreateDeviceKey(db);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, new TextEncoder().encode(value));
      saved = { iv, ciphertext };
    }
    const revision = await putCredential(db, id, saved, owner, provider);
    broadcastCredentialChange({ account: owner, provider, revision });
  });
  queue = work;
  return work;
}
export async function readCredential(provider: Provider, owner: string | null): Promise<Credential | undefined> {
  await queue.catch(() => undefined);
  const id = keyId(provider, owner);
  const db = await open();
  const [key, saved] = await get<[CryptoKey | undefined, {iv: Uint8Array; ciphertext: ArrayBuffer} | undefined]>(db, ["device-key", id]);
  if (!saved || !key) return undefined;
  const value = new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:saved.iv},key,saved.ciphertext));
  try {
    const entry = JSON.parse(value);
    if (typeof entry.value === "string" && [null, "edit", "import"].includes(entry.pending)) return entry;
  } catch { /* Legacy entries stored just the key. */ }
  return { value, pending: owner ? "import" : null };
}

export const saveRememberedKey = (provider: Provider, value: string) => saveCredential(provider, null, value ? { value, pending: null } : undefined);
export const readRememberedKey = async (provider: Provider) => (await readCredential(provider, null))?.value ?? "";
