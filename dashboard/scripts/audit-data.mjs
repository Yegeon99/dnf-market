// 데이터 정합성 자동 감사: 표시값 vs 저장값 vs 재계산값 3중 대조.
//
// - 표시값  = dashboard/src/lib/data.js (화면이 실제로 쓰는 로직)
// - 저장값  = data/anomalies.json · data/briefings.json (파이프라인이 남긴 값)
// - 재계산값 = 이 파일 안의 독립 구현 (timeseries 원본에서 직접)
//
// 실행: node scripts/audit-data.mjs   (실패 1건이라도 있으면 exit 1)

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  dodChanges, publishChanges, latestDate, briefingSlot, HEAT_BOUNDS,
  isLowLiquidity, lastCollectedLabel, slotLabel,
} from "../src/lib/data.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const TOL = 0.1; // 허용 오차 (%p)

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const rootData = (n) => read(join(ROOT, "data", n));


const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
}

// ── 재계산: 원본 timeseries에서 직접 (표시 로직과 공유 코드 없음) ──────────
function recalcDaily(rows, itemId) {
  const byDate = new Map();
  for (const r of rows) {
    if (r.itemId !== itemId) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  return [...byDate.entries()]
    .map(([date, recs]) => {
      const mean = (vals) => {
        const v = vals.filter((x) => x != null);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
      };
      return {
        date,
        avgPrice: mean(recs.map((r) => r.avgUnitPrice)),
        listing: mean(recs.map((r) => r.listingCount)),
        slots: recs.map((r) => r.slot).sort(),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

function recalcDod(rows, itemId, date, { slotFilter = null } = {}) {
  const daily = recalcDaily(rows, itemId);
  const i = daily.findIndex((d) => d.date === date);
  if (i <= 0) return { price: null, listing: null };
  const prev = daily[i - 1];
  let cur = daily[i];
  if (slotFilter) {
    const recs = rows.filter((r) => r.itemId === itemId && r.date === date && slotFilter(r.slot));
    const mean = (vals) => {
      const v = vals.filter((x) => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    cur = { avgPrice: mean(recs.map((r) => r.avgUnitPrice)), listing: mean(recs.map((r) => r.listingCount)) };
  }
  const pct = (p, c) => (p == null || c == null || p === 0 ? null : ((c - p) / p) * 100);
  return { price: pct(prev.avgPrice, cur.avgPrice), listing: pct(prev.listing, cur.listing) };
}

// ── 데이터 로드 ───────────────────────────────────────────────────────────
const FILES = ["timeseries.json", "anomalies.json", "briefings.json", "backfill.json"];
const rows = rootData("timeseries.json").rows;
const anomalies = rootData("anomalies.json").anomalies;
const briefings = [...rootData("briefings.json").briefings].sort((a, b) => (a.date < b.date ? 1 : -1));
const items = read(join(ROOT, "config", "items.json")).items;
const thresholds = read(join(ROOT, "config", "thresholds.json"));
const backfill = rootData("backfill.json").rows;
const collection = existsSync(join(ROOT, "dashboard", "public", "data", "collection.json"))
  ? read(join(ROOT, "dashboard", "public", "data", "collection.json"))
  : { latestAttempt: null, attempts: [] };
const date = latestDate(rows);

// ── 1. 배포본 동기화: data/ 와 dashboard/public/data/ 가 같은가 ───────────
{
  const bad = [];
  for (const f of [...FILES, "items.json", "thresholds.json"]) {
    const pub = join(ROOT, "dashboard", "public", "data", f);
    if (!existsSync(pub)) { bad.push(`${f}: public 사본 없음`); continue; }
    const src = f === "items.json" || f === "thresholds.json"
      ? read(join(ROOT, "config", f))
      : rootData(f);
    if (JSON.stringify(src) !== JSON.stringify(read(pub))) bad.push(`${f}: 내용 불일치`);
  }
  check("배포본 동기화 (data/ vs public/data/)", bad.length === 0, bad.join(", ") || `${FILES.length + 2}개 파일 일치`);
}

// ── 2. 등락률 재계산 vs 화면 표시값 (최신 수집 기준, 31품목) ──────────────
{
  const shown = dodChanges(rows, items, date);
  const bad = [];
  for (const c of shown) {
    const re = recalcDod(rows, c.itemId, date).price;
    if (c.changePct == null && re == null) continue;
    if (c.changePct == null || re == null || Math.abs(c.changePct - re) > TOL) {
      bad.push(`${c.name}: 표시 ${c.changePct?.toFixed(2)} vs 재계산 ${re?.toFixed(2)}`);
    }
  }
  check(`등락률 재계산 대조 (최신 수집 기준 ${shown.length}종)`, bad.length === 0,
        bad.join(" / ") || `전 품목 오차 ${TOL}%p 이내`);
}

// ── 3. 브리핑 발행 시점 기준 재계산 vs 표시 로직 ──────────────────────────
{
  const bDate = briefings[0]?.date;
  const shown = publishChanges(rows, items, bDate);
  const bad = [];
  for (const c of shown) {
    const re = recalcDod(rows, c.itemId, bDate, { slotFilter: (s) => s === briefingSlot }).price;
    if (c.changePct == null && re == null) continue;
    if (c.changePct == null || re == null || Math.abs(c.changePct - re) > TOL) {
      bad.push(`${c.name}: 표시 ${c.changePct?.toFixed(2)} vs 재계산 ${re?.toFixed(2)}`);
    }
  }
  check(`등락률 재계산 대조 (발행 시점 기준 ${shown.length}종)`, bad.length === 0,
        bad.join(" / ") || `전 품목 오차 ${TOL}%p 이내`);
}

// ── 4. anomalies 저장값 재검증 (baseValue·currentValue·change_pct·severity·lowLiquidity) ──
{
  const bad = [];
  const ll = thresholds.lowLiquidity;
  const tiersFor = (m) => thresholds.dayOverDay[m];
  for (const a of anomalies) {
    const recomputed = a.baseValue === 0 ? null : ((a.currentValue - a.baseValue) / a.baseValue) * 100;
    if (recomputed == null || Math.abs(recomputed - a.change_pct) > TOL) {
      bad.push(`${a.itemName}: change_pct ${a.change_pct} vs 재계산 ${recomputed?.toFixed(2)}`);
    }
    // severity 재판정 (저유동 강등은 슬롯 지속성 판단이라 여기서는 상한만 확인)
    const t = tiersFor(a.metric);
    const abs = Math.abs(a.change_pct);
    const nominal = abs >= t.high ? "high" : abs >= t.mid ? "mid" : abs >= t.low ? "low" : null;
    if (nominal == null) bad.push(`${a.itemName}: 임계치 미달인데 이상으로 기록됨 (${abs.toFixed(2)}%)`);
    const rank = { high: 0, mid: 1, low: 2 };
    if (nominal && rank[a.severity] < rank[nominal]) {
      bad.push(`${a.itemName}: severity ${a.severity} 가 임계 판정 ${nominal} 보다 높음`);
    }
    // lowLiquidity: 당일·전일 매물 수 모두 기준 미만이어야 true
    const daily = recalcDaily(rows, a.itemId);
    const i = daily.findIndex((d) => d.date === a.date);
    const curL = a.metric === "listingCount" ? a.currentValue : daily[i]?.listing;
    const prevL = a.metric === "listingCount" ? a.baseValue : daily[i - 1]?.listing;
    const expect = isLowLiquidity(curL, prevL, ll.listingCountBelow);
    if (expect !== a.lowLiquidity) {
      bad.push(`${a.itemName}: lowLiquidity ${a.lowLiquidity} vs 재판정 ${expect} (전일 ${prevL}, 당일 ${curL})`);
    }
  }
  check(`이상 변동 저장값 재검증 (${anomalies.length}건)`, bad.length === 0,
        bad.join(" / ") || "변동률·심각도·저유동 판정 전건 일치");
}

// ── 5. 브리핑 인용 수치 전수 대조 ─────────────────────────────────────────
{
  const bad = [];
  for (const b of briefings) {
    const texts = [b.headline, ...b.summary_3lines, ...(b.notable || []).map((n) => n.comment)];
    const pcts = texts.flatMap((t) => [...String(t).matchAll(/([+-]?\d+(?:\.\d+)?)%/g)].map((m) => parseFloat(m[1])));
    if (!pcts.length) continue;
    // 대조 후보: 발행 시점 가격 등락 + 그날 anomalies 의 변동률 + 임계치 상수
    const priceSet = publishChanges(rows, items, b.date).map((c) => c.changePct).filter((v) => v != null);
    const anomSet = anomalies.filter((a) => a.date === b.date).map((a) => a.change_pct);
    const constSet = [thresholds.dayOverDay.avgPrice.low, thresholds.dayOverDay.avgPrice.mid,
                      thresholds.dayOverDay.avgPrice.high];
    const pool = [...priceSet, ...anomSet, ...constSet];
    for (const p of pcts) {
      if (!pool.some((v) => Math.abs(v - p) <= TOL)) bad.push(`${b.date}: ${p}% 근거 없음`);
    }
  }
  check("브리핑 인용 수치 전수 대조", bad.length === 0,
        bad.join(" / ") || "헤드라인·요약·주목 변동의 모든 %가 데이터에 실존");
}

// ── 6. 순위 보드: 정렬 정확성 + 매물 수 변동 제외 규칙 ────────────────────
{
  const changes = dodChanges(rows, items, date).filter((c) => c.changePct != null);
  const ups = [...changes].sort((a, b) => b.changePct - a.changePct).filter((c) => c.changePct > 0);
  const downs = [...changes].sort((a, b) => a.changePct - b.changePct).filter((c) => c.changePct < 0);
  const bad = [];
  for (let i = 1; i < ups.length; i++) if (ups[i - 1].changePct < ups[i].changePct) bad.push("상승 정렬 역전");
  for (let i = 1; i < downs.length; i++) if (downs[i - 1].changePct > downs[i].changePct) bad.push("하락 정렬 역전");
  if (ups.some((c) => c.changePct <= 0)) bad.push("상승 목록에 비양수 포함");
  if (downs.some((c) => c.changePct >= 0)) bad.push("하락 목록에 비음수 포함");
  check("순위 보드 정렬 정확성", bad.length === 0,
        bad.join(" / ") || `상승 ${ups.length}종·하락 ${downs.length}종 단조 정렬`);

  // "매물 수 변동 제외": 순위 보드가 쓰는 값이 가격에서만 나오는지 확인.
  // 매물 수 이상만 걸린 품목이 순위 보드 수치와 같은 값을 갖고 있으면 오염이다.
  const listingOnly = anomalies.filter((a) => a.date === date && a.metric === "listingCount");
  const leak = listingOnly.filter((a) => {
    const c = changes.find((x) => x.itemId === a.itemId);
    return c && Math.abs(c.changePct - a.change_pct) <= TOL;
  });
  check("순위 보드 매물 수 변동 제외 규칙", leak.length === 0,
        leak.length ? leak.map((a) => a.itemName).join(", ") + " 매물 수 변동률이 순위에 유입"
                    : `매물 수 이상 ${listingOnly.length}건 모두 순위 수치와 무관 (가격 기준만 사용)`);
}

// ── 7. 마스트헤드 스택 바 합계 ────────────────────────────────────────────
{
  const cells = dodChanges(rows, items, date);
  const flat = HEAT_BOUNDS[0];
  let up = 0, down = 0, flatN = 0, pending = 0;
  for (const c of cells) {
    if (c.changePct == null) pending++;
    else if (Math.abs(c.changePct) < flat) flatN++;
    else if (c.changePct > 0) up++;
    else down++;
  }
  const sum = up + down + flatN + pending;
  check("스택 바 합계 정합", sum === items.length && sum === cells.length,
        `상승 ${up} + 보합 ${flatN} + 하락 ${down} + 대기 ${pending} = ${sum} (추적 ${items.length}종)`);
}

// ── 8. 저유동 판정 단일 규칙 (이상 뱃지 · 아이템 상세 · 히트맵 툴팁) ────────
{
  const below = thresholds.lowLiquidity.listingCountBelow;
  const bad = [];

  // (1) 저장된 이상 뱃지가 공용 헬퍼 판정과 같은가
  for (const a of anomalies) {
    const daily = recalcDaily(rows, a.itemId);
    const i = daily.findIndex((d) => d.date === a.date);
    const cur = a.metric === "listingCount" ? a.currentValue : daily[i]?.listing;
    const prev = a.metric === "listingCount" ? a.baseValue : daily[i - 1]?.listing;
    if (isLowLiquidity(cur, prev, below) !== a.lowLiquidity) {
      bad.push(`이상 뱃지 ${a.itemName}: 저장 ${a.lowLiquidity} vs 규칙 ${isLowLiquidity(cur, prev, below)}`);
    }
  }

  // (2) 히트맵 툴팁(dodChanges)과 아이템 상세(dailySeries)가 같은 판정을 내는가
  const cells = dodChanges(rows, items, date);
  if (cells.some((c) => !("listingPrev" in c))) bad.push("dodChanges에 listingPrev 없음");
  for (const c of cells) {
    const daily = recalcDaily(rows, c.itemId);
    const heat = isLowLiquidity(c.listing, c.listingPrev, below);
    const detail = isLowLiquidity(daily.at(-1)?.listing, daily.at(-2)?.listing, below);
    if (heat !== detail) bad.push(`${c.name}: 히트맵 ${heat} vs 상세 ${detail}`);
  }

  const n = cells.filter((c) => isLowLiquidity(c.listing, c.listingPrev, below)).length;
  check(`저유동 판정 단일 규칙 (당일·전일 모두 ${below}건 미만)`, bad.length === 0,
        bad.join(" / ") || `이상 뱃지·히트맵·상세 세 곳 판정 일치 (저유동 ${n}종)`);
}

// ── 9. 백필(과거 실거래 소급 수집) 구간 표기 ──────────────────────────────
{
  const dates = [...new Set(backfill.map((r) => r.date))].sort();
  const min = dates[0], max = dates.at(-1);
  const shownDays = Math.round((new Date(max) - new Date(min)) / 86400000) + 1;
  const overlap = dates.filter((d) => rows.some((r) => r.date === d));
  check("백필 구간 표기 정확성",
        shownDays === dates.length && overlap.length === 0,
        `화면 표기 ${shownDays}일 (${min}~${max}), 실제 수집일 ${dates.length}일, 스냅샷 구간과 중복 ${overlap.length}일`);
}

// ── 10. 문구 스캔: 줄표·겹말·내부 용어·원인 미상 신뢰도 ───────────────────
{
  const texts = [];
  for (const b of briefings) {
    texts.push([`briefings/${b.date}/headline`, b.headline]);
    b.summary_3lines.forEach((l, i) => texts.push([`briefings/${b.date}/summary[${i}]`, l]));
    (b.notable || []).forEach((n, i) => texts.push([`briefings/${b.date}/notable[${i}]`, n.comment]));
  }
  for (const a of anomalies) if (a.ai_hypothesis) texts.push([`anomalies/${a.id}/hypothesis`, a.ai_hypothesis.text]);

  const REDUNDANT = ["상승 상위 1위", "하락 상위 1위", "가장 최대", "약 정도", "역전 뒤집", "다시 재"];
  const JARGON = ["슬롯", "백필", "listingCount", "avgPrice", "changePct", "dod", "ma7", "soldCount"];
  const bad = [];
  for (const [where, t] of texts) {
    if (/[—–]/.test(t) || /(?<=\S)\s-\s(?=\S)/.test(t)) bad.push(`${where}: 줄표`);
    for (const r of REDUNDANT) if (t.includes(r)) bad.push(`${where}: 겹말 "${r}"`);
    for (const j of JARGON) if (t.includes(j)) bad.push(`${where}: 내부 용어 "${j}"`);
  }
  check("문구 스캔 (줄표·겹말·내부 용어)", bad.length === 0, bad.join(" / ") || `${texts.length}개 문장 이상 없음`);

  // 원인 미상 항목에는 신뢰도를 붙이지 않는다
  const withConf = anomalies.filter((a) => a.ai_hypothesis?.text?.startsWith("원인 미상") && a.ai_hypothesis.confidence);
  const briefConf = briefings.flatMap((b) => (b.notable || []))
    .filter((n) => /원인 미상/.test(n.comment) && /\((확정|추정)\)/.test(n.comment));
  check("원인 미상 항목 신뢰도 표기 없음", withConf.length === 0 && briefConf.length === 0,
        withConf.length || briefConf.length
          ? `이상 ${withConf.length}건 · 브리핑 문장 ${briefConf.length}건에 신뢰도 잔존`
          : "원인 미상 항목에 신뢰도 괄호 없음");
}

// ── 11. 스냅샷 · 시계열 병합 건전성 ─────────────────────────────────────────
{
  const slotOf = (h) => (h < 5 ? "h03" : h < 9 ? "h07" : h < 13 ? "h11"
                       : h < 17 ? "h15" : h < 21 ? "h19" : "h23");
  const snapDir = join(ROOT, "data", "snapshots");
  const files = existsSync(snapDir) ? readdirSync(snapDir).filter((f) => f.endsWith(".json")).sort() : [];
  const tsKeys = new Set(rows.map((r) => `${r.date}|${r.slot}`));
  const snapKeys = new Set();
  const bad = [];
  let okRuns = 0, failedRuns = 0;

  for (const f of files) {
    const snap = read(join(snapDir, f));
    const its = snap.items || [];
    const okCount = its.filter((it) => it.avgUnitPrice != null || it.listingCount != null
                                    || it.soldCount24h != null).length;
    const hour = Number(String(snap.collectedAt || "").slice(11, 13));
    const slot = Number.isNaN(hour) ? snap.slot : slotOf(hour);
    const key = `${snap.date}|${slot}`;
    snapKeys.add(key);
    if (okCount > 0) {
      okRuns += 1;
      if (!tsKeys.has(key)) bad.push(`${f}: 값이 있는 회차인데 시계열에 병합되지 않음`);
    } else {
      failedRuns += 1;
      if (tsKeys.has(key)) bad.push(`${f}: 전 품목 실패 회차인데 시계열에 병합됨`);
    }
  }
  for (const k of tsKeys) if (!snapKeys.has(k)) bad.push(`시계열 ${k}: 대응 스냅샷 없음`);

  check(`스냅샷·시계열 병합 건전성 (스냅샷 ${files.length}개)`, bad.length === 0,
        bad.join(" / ") || `성공 회차 ${okRuns}개 전부 병합, 실패 회차 ${failedRuns}개 전부 미병합, 고아 회차 0`);
}

// ── 12. "최근 수집" 라벨이 실제 값이 있는 회차를 가리키는가 ────────────────
{
  const label = lastCollectedLabel(rows);
  const a = collection.latestAttempt;
  const bad = [];
  if (a && a.okCount === 0) {
    const failLabel = `${a.date.slice(5)} ${slotLabel(a.slot)}`;
    if (label === failLabel) bad.push(`실패 회차(${failLabel})를 "최근 수집"으로 표기`);
  }
  const withValue = rows.filter((r) => r.avgUnitPrice != null || r.listingCount != null);
  if (!withValue.length && label) bad.push("값이 없는데 최근 수집 라벨이 있음");
  check("최근 수집 라벨 정확성", bad.length === 0,
        bad.join(" / ") || `"${label}" (마지막 시도 ${a ? `${a.date} ${slotLabel(a.slot)} ${a.okCount}/${a.itemCount}종` : "기록 없음"})`);
}

// ── 출력 ──────────────────────────────────────────────────────────────────
const w = Math.max(...results.map((r) => [...r.name].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)));
const pad = (s) => {
  const len = [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
  return s + " ".repeat(Math.max(0, w - len));
};
console.log(`\n데이터 정합성 감사 — 기준일 ${date} / 브리핑 ${briefings[0]?.date}\n`);
for (const r of results) console.log(`  ${r.ok ? "통과" : "실패"}  ${pad(r.name)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length}개 항목 중 통과 ${results.length - failed}, 실패 ${failed}\n`);
process.exit(failed ? 1 : 0);
