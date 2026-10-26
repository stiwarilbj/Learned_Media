import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const ts = require("typescript");
Module._extensions[".ts"] = (module, filename) => {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  module._compile(compiled, filename);
};

const { ImmutableSchemaCache } = require("../lib/immutable-schema-cache.ts");

test("schema fragments are reused and recursively immutable", () => {
  const cache = new ImmutableSchemaCache(4);
  let builds = 0;
  const create = () => {
    builds += 1;
    return { properties: { facts: { maxItems: 7, items: { properties: { title: { type: "STRING" } } } } } };
  };
  const first = cache.get("candidate:7", create);
  const second = cache.get("candidate:7", create);

  assert.strictEqual(first, second);
  assert.equal(builds, 1);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.properties));
  assert.ok(Object.isFrozen(first.properties.facts.items.properties));
  assert.equal(Reflect.set(first.properties.facts, "maxItems", 99), false);
  assert.equal(second.properties.facts.maxItems, 7);
});

test("schema cache keys separate parameters and LRU eviction remains bounded", () => {
  const cache = new ImmutableSchemaCache(2);
  let builds = 0;
  const create = value => ({ maxItems: value, serial: ++builds });
  const seven = cache.get("candidate:7", () => create(7));
  cache.get("grounded:3:0", () => create(3));
  assert.equal(cache.get("candidate:7", () => create(70)).serial, seven.serial, "a cache hit refreshes its LRU position");
  cache.get("grounded:4:1", () => create(4));
  assert.equal(cache.size, 2);
  const rebuilt = cache.get("grounded:3:0", () => create(30));
  assert.equal(rebuilt.maxItems, 30);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("candidate:7", () => create(70)).maxItems, 70, "the least-recently used key is rebuilt after eviction");
});
