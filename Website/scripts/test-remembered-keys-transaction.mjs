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
      put: (value, key) => { this.writes.push(() => this.database.records.set(key, structuredClone(value))); },
      delete: key => { this.writes.push(() => this.database.records.delete(key)); }
    };
  }
  finish() {
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
  records: new Map(), transactions: [], delayMs: 20,
  transaction(_store, mode = 'readonly') { return new FakeTransaction(this, mode); }
};
const exports = {};
runInNewContext(code, {
  exports,
  require: name => name === './indexed-db' ? { createDatabaseConnection: () => async () => database } : (() => { throw Error(`Unexpected module ${name}`); })(),
  crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, Promise, setTimeout, structuredClone
});

const api = exports;
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
