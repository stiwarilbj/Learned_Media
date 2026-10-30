import { createDatabaseConnection } from "./indexed-db";
import type { Credential, KeyProvider } from "./account-credentials";
type Provider = KeyProvider;
const keyId = (provider: Provider, owner: string | null) => owner ? `account:${owner}:${provider}` : provider;
const DB = "learned-media-private-keys";
let queue = Promise.resolve();
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
async function put(db: IDBDatabase, id: string, value?: unknown) {
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("keys", "readwrite");
    if (value === undefined) transaction.objectStore("keys").delete(id);
    else transaction.objectStore("keys").put(value, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
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
    if (!value.trim()) { await put(db, id); return; }
    const key = await getOrCreateDeviceKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, new TextEncoder().encode(value));
    await put(db, id, {iv, ciphertext});
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
