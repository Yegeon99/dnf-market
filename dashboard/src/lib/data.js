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
  const [ts, anomalies, briefings, items, events, thresholds, backfill, collection] = await Promise.all([
    loadJson("timeseries.json").catch(() => ({ rows: [] })),
    loadJson("anomalies.json").catch(() => ({ anomalies: [] })),
    loadJson("briefings.json").catch(() => ({ briefings: [] })),
    loadJson("items.json"),
    loadJson("events.json").catch(() => ({ events: [] })),
    loadJson("thresholds.json"),
    loadJson("backfill.json").catch(() => ({ rows: [] })),
    loadJson("collection.json").catch(() => ({ latestAttempt: null })),
  ]);
  return {
    rows: ts.rows || [],
    anomalies: anomalies.anomalies || [],
    briefings: (briefings.briefings || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    items: items.items || [],
    events: events.events || [],
    thresholds,
    backfill: backfill.rows || [],
    collection,
  };
}

// 하루 6회 수집 슬롯 (KST). "day"는 백필(일 단위 소급) 전용 라벨.
export const SLOTS = ["h03", "h07", "h11", "h15", "h19", "h23"];

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
      avgPrice: r?.avgUnitPrice ?? null,
      minPrice: r?.minUnitPrice ?? null,
      soldAvg: r?.soldAvgUnitPrice24h ?? null,
      listing: r?.listingCount ?? null,
      soldCapped: r?.soldCapped ?? false,
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
      const p = recs.map((r) => r.avgUnitPrice).filter((v) => v != null);
      const c = recs.map((r) => r.listingCount).filter((v) => v != null);
      return {
        date,
        avgPrice: p.length ? p.reduce((a, b) => a + b, 0) / p.length : null,
        listing: c.length ? c.reduce((a, b) => a + b, 0) / c.length : null,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** 전 품목 전일 대비 변동률 [{itemId, name, category, changePct|null, listing}] */
export function dodChanges(rows, items, targetDate) {
  return items.map((it) => {
    const daily = dailySeries(rows, it.itemId);
    const idx = daily.findIndex((d) => d.date === targetDate);
    const cur = idx >= 0 ? daily[idx] : daily[daily.length - 1];
    const prev = idx > 0 ? daily[idx - 1] : null;
    let changePct = null;
    if (prev && prev.avgPrice && cur?.avgPrice != null) {
      changePct = ((cur.avgPrice - prev.avgPrice) / prev.avgPrice) * 100;
    }
    return {
      itemId: it.itemId,
      name: it.name,
      category: it.category,
      reason: it.reason,
      changePct,
      avgPrice: cur?.avgPrice ?? null,
      listing: cur?.listing ?? null,
      listingPrev: prev?.listing ?? null,
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
      .map((r) => r.avgUnitPrice)
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
      : null;
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
  const rows = allRows.filter((r) => r.avgUnitPrice != null || r.listingCount != null);
  if (!rows.length) return null;
  const hour = (s) => (s.startsWith("h") ? parseInt(s.slice(1), 10) : { night: 3, am: 9, pm: 15 }[s] ?? 0);
  const last = rows.reduce((a, b) =>
    a.date !== b.date ? (a.date > b.date ? a : b) : hour(a.slot) >= hour(b.slot) ? a : b);
  return `${last.date.slice(5)} ${slotLabel(last.slot)}`;
}
