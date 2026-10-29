import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const Module = require("node:module");
Module._extensions[".ts"] = (module, filename) => {
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  module._compile(compiled, filename);
};
const source = require("../lib/background-work.ts");
const generatedContext = { console, AbortController, DOMException, setTimeout, clearTimeout, performance };
generatedContext.globalThis = generatedContext;
vm.runInNewContext(readFileSync(new URL("../../App/Resources/frontend/background-work.js", import.meta.url), "utf8"), generatedContext);

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

async function verify(api, label) {
  const scheduler = new api.LocalWorkScheduler();
  const order = [];
  const background = scheduler.run(() => { order.push("background"); }, { priority: "background", canPause: true });
  const interactive = scheduler.run(() => { order.push("interactive"); }, { priority: "interactive", canPause: true });
  await Promise.all([background, interactive]);
  assert.deepEqual(order, ["interactive", "background"], `${label}: an active user task can preempt a scheduled idle slice`);

  const serializedScheduler = new api.LocalWorkScheduler();
  const entered = deferred(), release = deferred(), serialized = [];
  const first = serializedScheduler.run(async () => { serialized.push("first-start"); entered.resolve(); await release.promise; serialized.push("first-end"); }, { priority: "visible", canPause: false });
  await entered.promise;
  const second = serializedScheduler.run(() => { serialized.push("second"); }, { priority: "interactive", canPause: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(serialized, ["first-start"], `${label}: one asynchronous decode slice owns the scheduler until it settles`);
  release.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(serialized, ["first-start", "first-end", "second"]);

  const cancellationScheduler = new api.LocalWorkScheduler();
  const controller = new AbortController();
  let canceledWorkRan = false;
  const canceled = cancellationScheduler.run(() => { canceledWorkRan = true; }, { priority: "background", signal: controller.signal });
  const rejected = assert.rejects(canceled, error => error?.name === "AbortError");
  const urgent = cancellationScheduler.run(() => "ready", { priority: "interactive" });
  controller.abort();
  assert.equal(await urgent, "ready");
  await rejected;
  assert.equal(canceledWorkRan, false, `${label}: canceled queued work never runs`);

  const visited = [];
  await api.forEachBackground([0, 1, 2, 3], value => { visited.push(value); }, undefined, { priority: "background", canPause: true });
  assert.deepEqual(visited, [0, 1, 2, 3], `${label}: scheduled iterations preserve input order`);

  const stop = new AbortController();
  const aborted = api.forEachBackground([0, 1, 2], value => { if (value === 0) stop.abort(); }, stop.signal, { priority: "background" });
  await assert.rejects(aborted, error => error?.name === "AbortError", `${label}: cancellation is checked inside each slice`);
}

await verify(source, "website");
await verify(generatedContext.LEARNED_MEDIA_BACKGROUND, "generated Mac runtime");

// Loading another scheduler helper must still reuse the per-page queue.
const firstMacRuntime = generatedContext.LEARNED_MEDIA_BACKGROUND;
const sharedGate = deferred(), sharedOrder = [];
let firstStarted;
const started = new Promise(resolve => { firstStarted = resolve; });
const firstCopyTask = firstMacRuntime.runBackgroundSlice(async () => {
  sharedOrder.push("first-start");
  firstStarted();
  await sharedGate.promise;
  sharedOrder.push("first-end");
}, { priority: "visible", canPause: false });
await started;
vm.runInNewContext(readFileSync(new URL("../../App/Resources/frontend/background-work.js", import.meta.url), "utf8"), generatedContext);
const secondMacRuntime = generatedContext.LEARNED_MEDIA_BACKGROUND;
const secondCopyTask = secondMacRuntime.runBackgroundSlice(() => { sharedOrder.push("second"); }, { priority: "interactive" });
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(sharedOrder, ["first-start"], "generated Mac helper copies share one queue per page runtime");
sharedGate.resolve();
await Promise.all([firstCopyTask, secondCopyTask]);
assert.deepEqual(sharedOrder, ["first-start", "first-end", "second"]);
console.log("Priority, cancellation, slice serialization, and order checks passed for website and Mac.");
