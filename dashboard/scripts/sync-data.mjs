// 저장소의 data/·config/ 를 대시보드 public/data/ 로 동기화한다 (dev·build 전 자동 실행).
// events.csv는 JSON으로 변환한다. 생성물은 커밋하지 않는다 (.gitignore).
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const out = join(here, "..", "public", "data");
mkdirSync(out, { recursive: true });

for (const f of ["timeseries.json", "anomalies.json", "briefings.json", "llm_costs.json", "backfill.json"]) {
  const src = join(repo, "data", f);
  if (existsSync(src)) cpSync(src, join(out, f));
}
for (const f of ["items.json", "thresholds.json"]) {
  cpSync(join(repo, "config", f), join(out, f));
}

// events.csv → events.json (title에 쉼표가 있어도 안전: 첫 필드=date, 마지막 2필드=type,url)
// 최근 수집 회차 상태 → collection.json
// 화면(상태 바)이 "무인 운영 중"만 말하고 실패를 숨기지 않도록, 마지막 시도 회차의
// 성공·실패와 시계열 병합 여부를 함께 내보낸다. 스냅샷 원본은 배포물에 싣지 않는다.
const slotOf = (h) => (h < 5 ? "h03" : h < 9 ? "h07" : h < 13 ? "h11"
                     : h < 17 ? "h15" : h < 21 ? "h19" : "h23");
const snapDir = join(repo, "data", "snapshots");
let collection = { latestAttempt: null };
if (existsSync(snapDir)) {
  const files = readdirSync(snapDir).filter((f) => f.endsWith(".json")).sort();
  const tsRows = existsSync(join(repo, "data", "timeseries.json"))
    ? JSON.parse(readFileSync(join(repo, "data", "timeseries.json"), "utf-8")).rows || []
    : [];
  const attempts = files.map((f) => {
    const snap = JSON.parse(readFileSync(join(snapDir, f), "utf-8"));
    const items = snap.items || [];
    const ok = items.filter((it) => it.avgUnitPrice != null || it.listingCount != null
                                 || it.soldCount24h != null).length;
    const hour = Number(String(snap.collectedAt || "").slice(11, 13));
    const slot = Number.isNaN(hour) ? snap.slot : slotOf(hour);
    return {
      file: f, date: snap.date, slot, collectedAt: snap.collectedAt,
      itemCount: items.length, okCount: ok, failCount: (snap.failures || []).length,
      merged: tsRows.some((r) => r.date === snap.date && r.slot === slot),
    };
  });
  const last = attempts[attempts.length - 1] ?? null;
  collection = {
    latestAttempt: last && { ...last, failed: last.okCount === 0, partial: last.okCount > 0 && last.failCount > 0 },
    attempts: attempts.slice(-12),
  };
}
writeFileSync(join(out, "collection.json"), JSON.stringify(collection, null, 1), "utf-8");

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
const la = collection.latestAttempt;
console.log(`sync-data: ${events.length} events, 최근 회차 ${la ? `${la.date} ${la.slot} 수집 ${la.okCount}/${la.itemCount}${la.failed ? " (실패)" : ""}` : "없음"}, data → public/data/`);
