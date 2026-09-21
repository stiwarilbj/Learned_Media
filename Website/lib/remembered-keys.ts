type Provider = "gemini" | "youtube";
const DB = "learned-media-private-keys";
let queue = Promise.resolve();
function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function get<T>(db: IDBDatabase, id: string) {
  return new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction("keys").objectStore("keys").get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
/** Device-local convenience, not protection against scripts running on this origin. */
export function saveRememberedKey(provider: Provider, value: string) {
  const work = queue.catch(() => undefined).then(async () => {
    const db = await open();
    try {
      if (!value.trim()) { await put(db, provider); return; }
      let key = await get<CryptoKey>(db, "device-key");
      if (!key) {
        key = await crypto.subtle.generateKey({name:"AES-GCM", length:256}, false, ["encrypt", "decrypt"]);
        await put(db, "device-key", key);
      }
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, new TextEncoder().encode(value));
      await put(db, provider, {iv, ciphertext});
    } finally { db.close(); }
  });
  queue = work;
  return work;
}
export async function readRememberedKey(provider: Provider) {
  const db = await open();
  try {
    const key = await get<CryptoKey>(db, "device-key");
    const saved = await get<{iv: Uint8Array; ciphertext: ArrayBuffer}>(db, provider);
    if (!saved || !key) return "";
    return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:saved.iv},key,saved.ciphertext));
  } finally { db.close(); }
}
