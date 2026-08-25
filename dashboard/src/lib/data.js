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
  const [ts, anomalies, briefings, items, events, thresholds, backfill] = await Promise.all([
    loadJson("timeseries.json").catch(() => ({ rows: [] })),
    loadJson("anomalies.json").catch(() => ({ anomalies: [] })),
    loadJson("briefings.json").catch(() => ({ briefings: [] })),
    loadJson("items.json"),
    loadJson("events.json").catch(() => ({ events: [] })),
    loadJson("thresholds.json"),
    loadJson("backfill.json").catch(() => ({ rows: [] })),
  ]);
  return {
    rows: ts.rows || [],
    anomalies: anomalies.anomalies || [],
    briefings: (briefings.briefings || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    items: items.items || [],
    events: events.events || [],
    thresholds,
    backfill: backfill.rows || [],
  };
}

// 하루 6회 수집 슬롯 (KST). "day"는 백필(일 단위 소급) 전용 라벨.
export const SLOTS = ["h03", "h07", "h11", "h15", "h19", "h23"];

export function slotLabel(slot) {
  if (slot === "day") return "일 평균(백필)";
  const legacy = { night: "03시", am: "09시", pm: "15시" };
  if (legacy[slot]) return legacy[slot];
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
    };
  });
}

export function latestDate(rows) {
  return rows.length ? rows.map((r) => r.date).sort().at(-1) : null;
}

/** 골드 표기: 1.2억 / 345만 / 6,789 */
export function fmtGold(v) {
  if (v == null) return "—";
  if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만`;
  return Math.round(v).toLocaleString();
}

export function fmtPct(v) {
  if (v == null) return "—";
  const sign = v > 0 ? "▲" : v < 0 ? "▼" : "";
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

/** 등락 색상 (색+부호 병기 — fmtPct와 함께 사용) */
export function pctColor(v) {
  if (v == null || v === 0) return "var(--neutral)";
  return v > 0 ? "var(--up)" : "var(--down)";
}
