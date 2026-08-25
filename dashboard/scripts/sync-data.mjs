// 저장소의 data/·config/ 를 대시보드 public/data/ 로 동기화한다 (dev·build 전 자동 실행).
// events.csv는 JSON으로 변환한다. 생성물은 커밋하지 않는다 (.gitignore).
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const out = join(here, "..", "public", "data");
mkdirSync(out, { recursive: true });

for (const f of ["timeseries.json", "anomalies.json", "briefings.json", "llm_costs.json"]) {
  const src = join(repo, "data", f);
  if (existsSync(src)) cpSync(src, join(out, f));
}
for (const f of ["items.json", "thresholds.json"]) {
  cpSync(join(repo, "config", f), join(out, f));
}

// events.csv → events.json (title에 쉼표가 있어도 안전: 첫 필드=date, 마지막 2필드=type,url)
const csv = readFileSync(join(repo, "config", "events.csv"), "utf-8").replace(/^﻿/, "");
const lines = csv.split(/\r?\n/).filter((l) => l.trim());
const events = lines.slice(1).map((line) => {
  const parts = line.split(",");
  const date = parts[0];
  const url = parts[parts.length - 1];
  const type = parts[parts.length - 2];
  const title = parts.slice(1, parts.length - 2).join(",");
  return { date, title, type, url };
});
writeFileSync(join(out, "events.json"), JSON.stringify({ events }, null, 1), "utf-8");
console.log(`sync-data: ${events.length} events, data → public/data/`);
