import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/remembered-keys.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

class FakeTransaction {
  constructor(database, mode) {
    this.database = database;
    this.mode = mode;
    this.reads = [];
    this.writes = [];
    this.error = null;
    database.transactions.push(this);
    setTimeout(() => this.finish(), database.delayMs);
  }
  objectStore() {
    return {
      get: key => {
        this.reads.push(key);
        const request = { result: undefined, onsuccess: undefined, onerror: undefined };
        this.writes.push(() => {
          try {
            request.result = structuredClone(this.database.records.get(key));
            request.onsuccess?.();
          } catch (error) { request.error = error; request.onerror?.(); }
        });
        return request;
      },
      put: (value, key) => { this.writes.push(() => {
        this.database.records.set(key, structuredClone(value));
        if (key === 'device-key') this.database.deviceKeyWrites = (this.database.deviceKeyWrites ?? 0) + 1;
      }); },
      delete: key => { this.writes.push(() => this.database.records.delete(key)); }
    };
  }
  finish() {
    if (this.mode === 'readwrite' && this.database.failNextTransaction) {
      this.error = this.database.failNextTransaction;
      this.database.failNextTransaction = null;
      this.onerror?.();
      this.onabort?.();
      return;
    }
    try {
      for (const operation of this.writes) operation();
      this.oncomplete?.();
    } catch (error) {
      this.error = error;
      this.onerror?.();
      this.onabort?.();
    }
  }
}

const database = {
  records: new Map(), transactions: [], delayMs: 20, failNextTransaction: null, deviceKeyWrites: 0,
  transaction(_store, mode = 'readonly') { return new FakeTransaction(this, mode); }
};
function loadApi(connection) {
  const exports = {};
  runInNewContext(code, {
    exports,
    require: name => name === './indexed-db' ? { createDatabaseConnection: () => async () => connection } : (() => { throw Error(`Unexpected module ${name}`); })(),
    crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, Promise, setTimeout, structuredClone
  });
  return exports;
}
function connectionTo(shared) {
  return {
    records: shared.records,
    transactions: shared.transactions,
    get delayMs() { return shared.delayMs; },
    get failNextTransaction() { return shared.failNextTransaction; },
    set failNextTransaction(value) { shared.failNextTransaction = value; },
    get deviceKeyWrites() { return shared.deviceKeyWrites; },
    set deviceKeyWrites(value) { shared.deviceKeyWrites = value; },
    transaction(_store, mode = 'readonly') { return new FakeTransaction(this, mode); }
  };
}

const api = loadApi(database);
const wait = delay => new Promise(resolve => setTimeout(resolve, delay));

async function run() {
  await api.saveCredential('gemini', 'account-A', { value: 'account secret', pending: 'edit' });
  const before = database.transactions.length;
  let settled = false;
  const restoration = api.readCredential('gemini', 'account-A').then(value => { settled = true; return value; });
  await wait(5);
  const readTransactions = database.transactions.slice(before).filter(tx => tx.mode === 'readonly');
  assert.equal(readTransactions.length, 1, 'both records must use one readonly transaction');
  assert.deepEqual(readTransactions[0].reads, ['device-key', 'account:account-A:gemini']);
  assert.equal(settled, false, 'restoration waits for transaction completion');
  assert.deepEqual(JSON.parse(JSON.stringify(await restoration)), { value: 'account secret', pending: 'edit' });

  const missing = await api.readCredential('gemini', 'account-B');
  assert.equal(missing, undefined, 'an encrypted value from another account is not returned');
  const key = database.records.get('device-key');
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('legacy youtube key'));
  database.records.set('youtube', { iv, ciphertext });
  assert.deepEqual(JSON.parse(JSON.stringify(await api.readCredential('youtube', null))), { value: 'legacy youtube key', pending: null });
  assert.equal(await api.readCredential('youtube', 'account-A'), undefined, 'provider and account namespaces remain isolated');
}

await run();
console.log('Credential restoration reads both records in one transaction and preserves isolation and legacy behavior.');

async function runCrossConnectionFirstSave() {
  const shared = { records: new Map(), transactions: [], delayMs: 20, failNextTransaction: null, deviceKeyWrites: 0 };
  const firstDatabase = connectionTo(shared);
  const secondDatabase = connectionTo(shared);
  const firstApi = loadApi(firstDatabase);
  const secondApi = loadApi(secondDatabase);
  await Promise.all([
    firstApi.saveCredential('gemini', 'account-A', { value: 'gemini first save', pending: 'edit' }),
    secondApi.saveCredential('youtube', 'account-A', { value: 'youtube first save', pending: 'import' })
  ]);

  assert.equal(shared.records.has('device-key'), true, 'one device key should be installed');
  assert.equal(shared.deviceKeyWrites, 1, 'the losing tab must not overwrite the key selected by the winning transaction');
  assert.deepEqual(
    await Promise.all([
      firstApi.readCredential('gemini', 'account-A'),
      secondApi.readCredential('youtube', 'account-A')
    ]).then(values => values.map(value => JSON.parse(JSON.stringify(value)))),
    [
      { value: 'gemini first save', pending: 'edit' },
      { value: 'youtube first save', pending: 'import' }
    ],
    'both providers must encrypt with the key selected by their connection transaction'
  );
  assert.equal(await firstApi.readCredential('gemini', 'account-B'), undefined, 'credentials remain account-scoped');
}

async function runKeyTransactionFailure() {
  const shared = { records: new Map(), transactions: [], delayMs: 1, failNextTransaction: new Error('simulated IndexedDB abort'), deviceKeyWrites: 0 };
  const api = loadApi(connectionTo(shared));
  await assert.rejects(
    api.saveCredential('youtube', 'account-A', { value: 'must not be acknowledged', pending: 'edit' }),
    /simulated IndexedDB abort/
  );
  assert.equal(shared.records.has('device-key'), false, 'failed key selection must not install a key');
  assert.equal(shared.records.has('account:account-A:youtube'), false, 'encryption and credential storage wait for transaction commit');

  await api.saveCredential('youtube', 'account-A', { value: 'retry succeeds', pending: 'edit' });
  assert.deepEqual(JSON.parse(JSON.stringify(await api.readCredential('youtube', 'account-A'))), { value: 'retry succeeds', pending: 'edit' });
}

await runCrossConnectionFirstSave();
await runKeyTransactionFailure();
console.log('Concurrent first saves across connections retain one decryptable device key for both providers; failed selection remains retryable.');
