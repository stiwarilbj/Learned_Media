import type { FactMemory } from "./fact-quality";
export type WorkspaceSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRecord<T> = WorkspaceSummary & { state: T };

export type WorkspaceStore<T> = {
  version: 1;
  factMemory?: FactMemory[];
  ownerId?: string;
  activeId: string;
  records: Array<WorkspaceRecord<T>>;
  theme?: "light" | "dark";
};

const DB_NAME = "learned-media-workspaces";
const DB_VERSION = 1;
const STORE_NAME = "records";
const STORE_KEY = "workspace-store";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Workspace storage could not open."));
  });
}

export async function readWorkspaceStore<T>(fallback: WorkspaceStore<T> | null): Promise<WorkspaceStore<T> | null> {
  if (typeof window === "undefined") return fallback;
  let recovery: WorkspaceStore<T> | null = null;
  try { recovery = JSON.parse(window.localStorage.getItem("learned-media-all-workspaces") || "null"); } catch { /* Try the transactional copy. */ }
  if (!window.indexedDB) return recovery ?? fallback;
  try {
    const database = await openDatabase();
    const stored = await new Promise<WorkspaceStore<T> | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STORE_KEY);
      request.onsuccess = () => resolve((request.result as WorkspaceStore<T> | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return stored ?? recovery ?? fallback;
  } catch {
    return recovery ?? fallback;
  }
}

export async function accountWorkspaceBackup<T>(ownerId: string, value?: WorkspaceStore<T>): Promise<WorkspaceStore<T> | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, value ? 'readwrite' : 'readonly');
      const records = transaction.objectStore(STORE_NAME), key = 'account:' + ownerId;
      if (value) records.put(structuredClone(value), key);
      const request = records.get(key);
      transaction.oncomplete = () => resolve(request.result ?? null);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { database.close(); }
}

export async function writeWorkspaceStore<T>(store: WorkspaceStore<T>): Promise<void> {
  if (typeof window === "undefined") return;
  const snapshot = structuredClone(store);
  // The synchronous recovery record includes every workspace, not just the active one.
  let recoverySaved = false;
  try { window.localStorage.setItem("learned-media-all-workspaces", JSON.stringify(snapshot)); recoverySaved = true; } catch { /* IndexedDB is authoritative when the recovery copy is too large. */ }
  if (!window.indexedDB) { if (!recoverySaved) throw new Error("Local storage is unavailable."); return; }
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const records = transaction.objectStore(STORE_NAME);
    const previous = records.get(STORE_KEY);
    previous.onsuccess = () => { if (previous.result) records.put(previous.result, "workspace-store-backup"); records.put(snapshot, STORE_KEY); };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Workspace storage could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Workspace storage could not be saved."));
  });
  database.close();
}

export function makeWorkspaceId() {
  return `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
