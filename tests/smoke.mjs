import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const files = [
  "src/core/schema.js",
  "src/core/score.js",
  "src/core/aggregate.js",
];

const sandbox = {
  console,
  URL,
  TextEncoder,
  navigator: { userAgent: "smoke-test" },
  location: {
    href: "https://source.test/path",
    hostname: "source.test",
  },
  window: null,
  globalThis: null,
};

sandbox.window = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);

for (const relativePath of files) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

const { SSM } = sandbox;
assert.ok(SSM, "SSM namespace must be initialized");

const analyzed = SSM.analyzeURL(
  "https://bit.ly/bonus?utm_source=ad&aff_id=7&gclid=x",
  {
    text: "Claim bonus",
    rel: "sponsored",
    attr: "href",
  },
  {
    source: "https://source.test/path",
    currentHost: "source.test",
  }
);

assert.ok(analyzed, "analyzeURL should produce a record");
assert.equal(analyzed.host, "bit.ly");
assert.equal(analyzed.shortener, true);
assert.equal(analyzed.is_external, true);
assert.ok(analyzed.suspicion_score >= 3);
assert.deepEqual(Array.from(analyzed.utm_keys), ["utm_source"]);
assert.deepEqual(Array.from(analyzed.aff_keys), ["aff_id"]);
assert.deepEqual(Array.from(analyzed.tracker_keys), ["gclid"]);

const summary = SSM.aggregateHosts([
  analyzed,
  {
    ...analyzed,
    url: "https://bit.ly/bonus-2",
    pathname: "/bonus-2",
    suspicion_score: 2,
  },
]);

assert.equal(summary.length, 1);
assert.equal(summary[0].host, "bit.ly");
assert.equal(summary[0].count, 2);
assert.equal(summary[0].max_suspicion_score, analyzed.suspicion_score);

const snapshot = SSM.createSnapshot({
  source: "https://source.test/path",
  userAgent: "smoke-test",
  links: [analyzed],
  summary,
});

const validation = SSM.validateSnapshot(snapshot);
assert.equal(validation.ok, true);
assert.equal(snapshot.meta.total_links, 1);
assert.equal(snapshot.meta.total_hosts, 1);

console.log("Smoke tests passed");
