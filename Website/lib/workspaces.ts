export type WorkspaceSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRecord<T> = WorkspaceSummary & { state: T };

export type WorkspaceStore<T> = {
  version: 1;
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
  if (!window.indexedDB) return fallback;
  try {
    const database = await openDatabase();
    const stored = await new Promise<WorkspaceStore<T> | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STORE_KEY);
      request.onsuccess = () => resolve((request.result as WorkspaceStore<T> | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return stored ?? fallback;
  } catch {
    return fallback;
  }
}

export async function writeWorkspaceStore<T>(store: WorkspaceStore<T>): Promise<void> {
  if (typeof window === "undefined" || !window.indexedDB) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(store, STORE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Workspace storage could not be saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Workspace storage could not be saved."));
  });
  database.close();
}

export function makeWorkspaceId() {
  return `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
