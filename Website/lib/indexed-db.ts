/** Reuse a connection and pending open, retiring failed or outdated handles. */
export function createDatabaseConnection(name: string, version: number, upgrade: (database: IDBDatabase) => void) {
  let active: { promise: Promise<IDBDatabase> } | undefined;
  return function open() {
    if (active) return active.promise;
    const entry = {} as { promise: Promise<IDBDatabase> };
    entry.promise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, version);
      const release = (database?: IDBDatabase) => {
        if (active === entry) active = undefined;
        database?.close();
      };
      request.onupgradeneeded = () => upgrade(request.result);
      request.onerror = () => {
        release();
        reject(request.error ?? new Error(`Could not open ${name}.`));
      };
      request.onblocked = () => {
        release();
        reject(new Error(`Another tab is blocking the ${name} database upgrade.`));
      };
      request.onsuccess = () => {
        const database = request.result;
        // A blocked open can complete after its caller has already retried.
        if (active !== entry) { database.close(); return; }
        database.onversionchange = () => release(database);
        database.onclose = () => release();
        database.onerror = () => release(database);
        resolve(database);
      };
    });
    active = entry;
    // Synchronous open failures must not leave a rejected promise cached.
    void entry.promise.catch(() => { if (active === entry) active = undefined; });
    return entry.promise;
  };
}
