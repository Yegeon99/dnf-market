// 차트 공용 축 계산.
//
// 시세 차트와 매물 수 차트가 세로로 붙어 있어 x축 기준이 다르면 같은 날짜가
// 서로 다른 자리에 찍힌다. 두 차트가 이 파일 하나를 같이 쓴다.
const DAY_MS = 86400000;
// 회차 라벨 → 그날의 시각. 시간 축에 회차를 제자리에 놓기 위한 값
export const SLOT_HOUR = { h03: 3, h07: 7, h11: 11, h15: 15, h19: 19, h23: 23, day: 12 };
// 축 여백은 두 차트가 같아야 세로로 줄이 맞는다
export const AXIS = { left: 66, right: 14 };

export const dayNum = (date) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
export const dateOf = (num) => new Date(num * DAY_MS).toISOString().slice(0, 10);

export const mean = (vals) => {
  const v = vals.filter((x) => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** 회차 단위 원본 → 그릴 점 목록. 빠진 날짜는 값 없는 점으로 채워 선을 끊는다.
 *  mode: "day"(그날 회차 평균) | "slot"(회차 하나하나)
 *  rangeDays: 0이면 전체 */
export function buildPoints(series, mode, rangeDays) {
  if (!series.length) return [];
  const lastDay = dayNum(series[series.length - 1].date);
  const firstDay = rangeDays > 0
    ? Math.max(dayNum(series[0].date), lastDay - rangeDays + 1)
    : dayNum(series[0].date);
  const inRange = series.filter((s) => dayNum(s.date) >= firstDay);

  if (mode === "slot") {
    return inRange.map((s) => ({
      ...s,
      mode: "slot",
      t: dayNum(s.date) + (SLOT_HOUR[s.slot] ?? 12) / 24,
    }));
  }

  const byDate = new Map();
  for (const s of inRange) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  const out = [];
  for (let d = firstDay; d <= lastDay; d += 1) {
    const date = dateOf(d);
    const recs = byDate.get(date);
    if (!recs) {
      out.push({ date, slot: null, mode: "day", t: d + 0.5, missing: true,
                 avgPrice: null, soldAvg: null, listing: null, backfill: false });
      continue;
    }
    out.push({
      date,
      slot: null,
      mode: "day",
      t: d + 0.5,
      slotCount: recs.filter((r) => r.avgPrice != null || r.soldAvg != null).length,
      avgPrice: mean(recs.map((r) => r.avgPrice)),
      soldAvg: mean(recs.map((r) => r.soldAvg)),
      listing: mean(recs.map((r) => r.listing)),
      listingQty: mean(recs.map((r) => r.listingQty)),
      minPrice: mean(recs.map((r) => r.minPrice)),
      soldCapped: recs.some((r) => r.soldCapped),
      backfill: recs.every((r) => r.backfill),
    });
  }
  return out;
}

/** 두 차트가 같은 가로 위치를 쓰도록 하는 x 변환 */
export function xScale(points, width) {
  const iw = Math.max(width - AXIS.left - AXIS.right, 10);
  const t0 = points.length ? points[0].t : 0;
  const t1 = points.length ? points[points.length - 1].t : 1;
  const span = t1 - t0 || 1;
  return { iw, t0, t1, span, xAt: (t) => AXIS.left + ((t - t0) / span) * iw };
}
