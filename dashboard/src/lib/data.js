// 정적 JSON 로드·가공 유틸. 대시보드는 Actions가 커밋한 data/를 읽기만 한다.

const cache = {};

export async function loadJson(name) {
  if (cache[name]) return cache[name];
  const res = await fetch(`/data/${name}`);
  if (!res.ok) throw new Error(`${name} 로드 실패 (${res.status})`);
  const json = await res.json();
  cache[name] = json;
  return json;
}

export async function loadAll() {
  const [ts, anomalies, briefings, items, events, thresholds, backfill, collection, llmCosts] = await Promise.all([
    loadJson("timeseries.json").catch(() => ({ rows: [] })),
    loadJson("anomalies.json").catch(() => ({ anomalies: [] })),
    loadJson("briefings.json").catch(() => ({ briefings: [] })),
    loadJson("items.json"),
    loadJson("events.json").catch(() => ({ events: [] })),
    loadJson("thresholds.json"),
    loadJson("backfill.json").catch(() => ({ rows: [] })),
    loadJson("collection.json").catch(() => ({ latestAttempt: null })),
    loadJson("llm_costs.json").catch(() => ({ days: {} })),
  ]);
  return {
    rows: ts.rows || [],
    anomalies: anomalies.anomalies || [],
    // 상한에 걸려 저장되지 않은 이상 변동이 있는 날을 화면이 알 수 있게 한다
    anomalyTotals: anomalies.dailyTotals || {},
    briefings: (briefings.briefings || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    items: items.items || [],
    events: events.events || [],
    thresholds,
    backfill: backfill.rows || [],
    collection,
    llmCosts: llmCosts.days || {},
  };
}

// 예정 수집 슬롯 (KST). "day"는 백필(일 단위 소급) 전용 라벨.
// 예정일 뿐이고 실제 성공 회차는 날마다 다르다 (collectionStats로 실측한다).
export const SLOTS = ["h03", "h07", "h11", "h15", "h19", "h23"];

/** 회차 대표 등록가. 중앙값이 있으면 중앙값, 없으면(2026-08-30 이전 회차) 평균.
 *  경매장에는 시세의 수십 배로 올린 매물이 상시 섞여 있어, 매물이 몇 건뿐인 품목은
 *  평균이 그 한 건에 끌려간다. 그래서 대표값은 중앙값을 쓴다. */
/** 수치 계산 방식이 바뀐 날. 이 날 발행분부터 지금과 같은 방식으로 계산됐다.
 *  그 이전 브리핑은 발행 당시 값이 맞고, 지금 데이터로 다시 계산하면 다르게 나온다. */
export const DEFINITION_CHANGED_AT = "2026-08-31";

export function repPrice(r) {
  return r?.medUnitPrice ?? r?.avgUnitPrice ?? null;
}

/** 대표값이 중앙값인지 평균인지 (화면 라벨 분기용) */
export function isMedianBased(rows) {
  return rows.some((r) => r?.medUnitPrice != null);
}

/** 실제 수집 실적: {days, slots, expected, perDay:{date:n}, latestDays} */
export function collectionStats(rows) {
  const perDay = {};
  for (const r of rows) (perDay[r.date] ??= new Set()).add(r.slot);
  const dates = Object.keys(perDay).sort();
  const counts = Object.fromEntries(dates.map((d) => [d, perDay[d].size]));
  const slots = dates.reduce((a, d) => a + counts[d], 0);
  return {
    days: dates.length,
    slots,
    expected: dates.length * SLOTS.length,
    perDay: counts,
    dates,
  };
}

export function slotLabel(slot) {
  if (slot === "day") return "일 평균(소급 수집)";
  const legacy = { night: "03시", am: "09시", pm: "15시" };
  if (legacy[slot]) return legacy[slot];
  // 심야 회차는 2026-08-27부터 KST 02:17 실행이다. 슬롯 id(h03)는 시계열 호환을 위해
  // 그대로 두고 표시 이름만 기준 시각에 맞춘다. 과거 기록도 같은 회차이므로 같은 이름을 쓴다.
  if (slot === "h03") return "02시";
  return slot.startsWith("h") ? `${slot.slice(1)}시` : slot;
}

/** 시간순 슬롯 키 목록: 데이터가 존재하는 (date, slot) 전 구간의 그리드.
 *  결손 슬롯도 그리드에 포함해 차트에서 공백으로 정직하게 표기한다. */
export function slotGrid(rows) {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const grid = [];
  for (const date of dates) {
    for (const slot of SLOTS) grid.push({ date, slot });
  }
  // 실데이터가 있는 첫/마지막 슬롯 사이만 남긴다
  const has = new Set(rows.map((r) => `${r.date}|${r.slot}`));
  let first = grid.findIndex((g) => has.has(`${g.date}|${g.slot}`));
  let last = grid.length - 1;
  while (last >= 0 && !has.has(`${grid[last].date}|${grid[last].slot}`)) last--;
  return grid.slice(Math.max(first, 0), last + 1);
}

/** 품목별 슬롯 시계열: 백필(일 단위, 과거) + 스냅샷(슬롯 단위) 연결.
 *  [{date, slot, avgPrice, minPrice, soldAvg, listing, backfill}] (결손=null 필드) */
export function itemSeries(rows, itemId, backfillRows = []) {
  // 과거 백필 구간: 하루 1점 (실거래만 존재 — 등록가·매물수는 null 공백)
  const past = backfillRows
    .filter((r) => r.itemId === itemId)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => ({
      date: r.date,
      slot: "day",
      avgPrice: null,
      minPrice: null,
      soldAvg: r.soldAvgUnitPriceDay ?? null,
      listing: null,
      soldCapped: false,
      backfill: true,
    }));

  const mine = rows.filter((r) => r.itemId === itemId);
  const byKey = Object.fromEntries(mine.map((r) => [`${r.date}|${r.slot}`, r]));
  const collected = slotGrid(mine).map(({ date, slot }) => {
    const r = byKey[`${date}|${slot}`];
    return {
      date,
      slot,
      avgPrice: repPrice(r),
      minPrice: r?.minUnitPrice ?? null,
      soldAvg: r?.soldMedUnitPrice24h ?? r?.soldAvgUnitPrice24h ?? null,
      listing: r?.listingCount ?? null,
      listingQty: r?.listingQty ?? null,
      soldCapped: r?.soldCapped ?? false,
      soldWindowHours: r?.soldWindowHours ?? null,
      backfill: false,
    };
  });
  return [...past, ...collected];
}

/** 품목별 일 대표값 (슬롯 평균) → 날짜 오름차순 [{date, avgPrice, listing}] */
export function dailySeries(rows, itemId) {
  const byDate = {};
  for (const r of rows) {
    if (r.itemId !== itemId) continue;
    (byDate[r.date] ??= []).push(r);
  }
  return Object.entries(byDate)
    .map(([date, recs]) => {
      const p = recs.map(repPrice).filter((v) => v != null);
      const c = recs.map((r) => r.listingCount).filter((v) => v != null);
      return {
        date,
        avgPrice: p.length ? p.reduce((a, b) => a + b, 0) / p.length : null,
        listing: c.length ? c.reduce((a, b) => a + b, 0) / c.length : null,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** {itemId: {date: {slot: [price, count]}}} — 공통 슬롯 비교용 격자 */
function slotGridOf(rows) {
  const g = {};
  for (const r of rows) {
    ((g[r.itemId] ??= {})[r.date] ??= {})[r.slot] = [repPrice(r), r.listingCount ?? null];
  }
  return g;
}

/** 지정 슬롯들만으로 일 대표값 → [price, count] */
function meanOver(day, slots) {
  const p = [], c = [];
  for (const s of slots) {
    const v = day[s];
    if (!v) continue;
    if (v[0] != null) p.push(v[0]);
    if (v[1] != null) c.push(v[1]);
  }
  return [
    p.length ? p.reduce((a, b) => a + b, 0) / p.length : null,
    c.length ? c.reduce((a, b) => a + b, 0) / c.length : null,
  ];
}

/** 전 품목 전일 대비 변동률 [{itemId, name, category, changePct|null, listing}].
 *
 *  비교는 두 날에 모두 있는 회차(공통 슬롯)로만 한다. 수집 회차가 날마다 1~6개로
 *  달라서, 회차 구성이 다른 날을 그대로 비교하면 시간대 차이가 변동률로 둔갑한다.
 *  파이프라인(detect.py dod_changes)과 같은 규칙이다. */
export function dodChanges(rows, items, targetDate, minListing = 0) {
  const grid = slotGridOf(rows);
  return items.map((it) => {
    const days = grid[it.itemId] ?? {};
    const dates = Object.keys(days).sort();
    let idx = dates.indexOf(targetDate);
    if (idx < 0) idx = dates.length - 1;
    const curDate = dates[idx], prevDate = idx > 0 ? dates[idx - 1] : null;
    const [curAll, curCntAll] = curDate ? meanOver(days[curDate], Object.keys(days[curDate])) : [null, null];

    let changePct = null, listingPrev = null, thin = false;
    if (prevDate) {
      const common = Object.keys(days[curDate]).filter((s) => s in days[prevDate]);
      if (common.length) {
        const [cp, cc] = meanOver(days[curDate], common);
        const [pp, pc] = meanOver(days[prevDate], common);
        listingPrev = pc;
        // 탐지기와 같은 기준: 매물이 이틀 연속 기준 미만이면 가격 신호를 채택하지 않는다.
        // 매물 두어 건짜리 품목은 등록 하나로 수치가 몇 배씩 튀어 순위가 무의미해진다.
        thin = minListing > 0 && cc != null && pc != null && cc < minListing && pc < minListing;
        if (!thin && pp && cp != null) changePct = ((cp - pp) / pp) * 100;
      }
    }
    return {
      thin,
      itemId: it.itemId,
      name: it.name,
      category: it.category,
      reason: it.reason,
      changePct,
      avgPrice: curAll,
      listing: curCntAll,
      listingPrev,
    };
  });
}

/** 저유동 판정 단일 규칙: 당일·전일 매물 수가 모두 기준 미만일 때만 저유동.
 *  detect.py의 판정과 같은 규칙이다. 화면 세 곳(이상 뱃지·아이템 상세·히트맵
 *  툴팁)이 이 함수 하나만 쓴다 — 규칙이 갈리면 같은 품목이 화면마다 달라진다. */
export function isLowLiquidity(cur, prev, below) {
  return below > 0 && cur != null && prev != null && cur < below && prev < below;
}

/** 브리핑이 발행되는 심야 회차 (KST 02:17). 본문 수치는 이 회차까지 수집된 값으로 산출된다 */
export const briefingSlot = "h03";

/** 브리핑 발행 시점 기준 전일 대비 변동률.
 *  당일은 심야 회차 값만, 전일은 그날 전 회차 평균 — 브리핑 본문과 같은 기준이다.
 *  이후 회차가 더 쌓이면 dodChanges(최신 수집 기준)와 값이 갈리므로 화면에서 기준을 병기한다. */
export function publishChanges(rows, items, targetDate) {
  return items.map((it) => {
    const daily = dailySeries(rows, it.itemId);
    const idx = daily.findIndex((d) => d.date === targetDate);
    const prev = idx > 0 ? daily[idx - 1] : null;
    const prices = rows
      .filter((r) => r.itemId === it.itemId && r.date === targetDate && r.slot === briefingSlot)
      .map(repPrice)
      .filter((v) => v != null);
    const cur = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
    return {
      itemId: it.itemId,
      name: it.name,
      changePct: prev?.avgPrice && cur != null ? ((cur - prev.avgPrice) / prev.avgPrice) * 100 : null,
      avgPrice: cur,
    };
  });
}

export function latestDate(rows) {
  return rows.length ? rows.map((r) => r.date).sort().at(-1) : null;
}

/** 골드 표기: 1.2억 / 345만 / 6,789 */
export function fmtGold(v) {
  if (v == null) return "미수집";
  if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만`;
  return Math.round(v).toLocaleString();
}

/** 천 단위 콤마 전체 표기 (툴팁·KPI용) */
export function fmtComma(v) {
  if (v == null) return "미수집";
  return Math.round(v).toLocaleString();
}

export function fmtPct(v) {
  if (v == null) return "비교 전";
  const sign = v > 0 ? "▲" : v < 0 ? "▼" : "";
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

/** 품목의 날짜별 전일 대비 등락률 맵 {date: pct|null} (일 대표값 기준) */
export function dailyChangeMap(rows, itemId) {
  const daily = dailySeries(rows, itemId);
  const map = {};
  daily.forEach((d, i) => {
    const prev = i > 0 ? daily[i - 1] : null;
    map[d.date] = prev?.avgPrice && d.avgPrice != null
      ? ((d.avgPrice - prev.avgPrice) / prev.avgPrice) * 100
      : null;  // 일 대표값 기준 (회차 구성 차이는 dodChanges가 보정한다)
  });
  return map;
}

/** 등락 색상 (색+부호 병기 — fmtPct와 함께 사용) */
export function pctColor(v) {
  if (v == null || v === 0) return "var(--neutral)";
  return v > 0 ? "var(--up)" : "var(--down)";
}

/** 히트맵 색상 스케일: 보합(±0.5% 미만) + 방향별 5단계.
 *  흰 텍스트는 진한 단계(4·5)에서만, 나머지는 딥 네이비 텍스트로 WCAG AA 유지. */
export const HEAT_BOUNDS = [0.5, 2, 5, 10, 20];
export function heatColor(pct) {
  if (pct == null) return { bg: "var(--heat-none)", fg: "var(--text-secondary)" };
  const a = Math.abs(pct);
  if (a < HEAT_BOUNDS[0]) return { bg: "var(--heat-flat)", fg: "var(--text-primary)" };
  const lv = a < 2 ? 1 : a < 5 ? 2 : a < 10 ? 3 : a < 20 ? 4 : 5;
  const dir = pct > 0 ? "up" : "down";
  return { bg: `var(--heat-${dir}-${lv})`, fg: lv >= 4 ? "#FFFFFF" : "var(--text-primary)" };
}

/** 부호 항상 표기 등락률: +4.2% / -3.1% (색만으로 전달 금지) */
export function fmtSignedPct(v) {
  if (v == null) return "비교 전";
  return `${v > 0 ? "+" : v < 0 ? "-" : "±"}${Math.abs(v).toFixed(1)}%`;
}

/** 최근 수집 라벨: 실제 값이 담긴 최신 (date, slot) → "08-25 15시".
 *  값이 하나도 없는 회차를 세면 실패 회차를 "최근 수집"이라 말하게 된다. */
export function lastCollectedLabel(allRows) {
  const rows = allRows.filter((r) => repPrice(r) != null || r.listingCount != null);
  if (!rows.length) return null;
  const hour = (s) => (s.startsWith("h") ? parseInt(s.slice(1), 10) : { night: 3, am: 9, pm: 15 }[s] ?? 0);
  const last = rows.reduce((a, b) =>
    a.date !== b.date ? (a.date > b.date ? a : b) : hour(a.slot) >= hour(b.slot) ? a : b);
  return `${last.date.slice(5)} ${slotLabel(last.slot)}`;
}
