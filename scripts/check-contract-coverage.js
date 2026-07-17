const fs = require("node:fs");
const path = require("node:path");

const reportPath = path.resolve(process.argv[2] ?? "coverage/coverage-final.json");
const threshold = Number(process.argv[3] ?? 100);

if (!fs.existsSync(reportPath)) {
  console.error(`Coverage report missing: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));

function percent(hits) {
  if (hits.length === 0) return 100;
  return (hits.filter((hit) => hit > 0).length / hits.length) * 100;
}

const hits = { statements: [], branches: [], functions: [], lines: [] };

for (const file of Object.values(report)) {
  hits.statements.push(...Object.values(file.s));
  hits.functions.push(...Object.values(file.f));
  hits.branches.push(...Object.values(file.b).flat());
  hits.lines.push(...Object.values(file.l));
}

let failed = false;
for (const [metric, values] of Object.entries(hits)) {
  const actual = percent(values);
  console.log(`${metric}: ${actual.toFixed(2)}% (required ${threshold}%)`);
  if (actual < threshold) failed = true;
}

if (failed) process.exit(1);
