// 매물 수 바 차트.
// 위의 시세 차트와 같은 시간 축·같은 여백을 쓴다. 두 차트가 세로로 붙어 있어
// 축이 다르면 같은 날짜가 서로 다른 자리에 찍혀 비교가 어긋난다.
import { useRef } from "react";
import { slotLabel } from "../lib/data";
import { useWidth } from "../lib/use-width";
import { AXIS, buildPoints, xScale } from "../lib/chart-points";

const M = { top: 22, right: AXIS.right, bottom: 22, left: AXIS.left };

export default function ListingChart({ series, height = 116, mode = "day", rangeDays = 14 }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const points = buildPoints(series, mode, rangeDays);

  if (!points.length) return null;
  const { iw, xAt } = xScale(points, width);
  const ih = height - M.top - M.bottom;
  const max = Math.max(...points.map((p) => p.listing ?? 0), 1);
  // 막대 두께는 점 간격에 맞추되 24px을 넘기지 않는다 (칸을 꽉 채우지 않는다)
  const gap = points.length > 1 ? iw / (points.length - 1) : iw;
  const bw = Math.min(Math.max(gap - 4, 3), 24);
  const hasAny = points.some((p) => p.listing != null);

  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img"
           aria-label={`매물 수 추이 차트. 최대 ${max.toLocaleString()}건`}>
        <text x={M.left - 54} y={11} fontSize="13" fill="var(--chart-axis-text)">단위: 건</text>
        <text x={M.left - 6} y={M.top + 8} textAnchor="end" fontSize="13" fill="var(--chart-axis-text)" className="num">{Math.round(max).toLocaleString()}</text>
        <line x1={M.left} x2={width - M.right} y1={M.top + ih} y2={M.top + ih} stroke="var(--chart-grid)" />
        {!hasAny && (
          <text x={M.left + iw / 2} y={M.top + ih / 2} textAnchor="middle" fontSize="13" fill="var(--text-muted)">
            표시할 매물 수 데이터가 없습니다
          </text>
        )}
        {points.map((p) =>
          p.listing == null ? null : (
            <rect
              key={`${p.date}|${p.slot ?? "day"}`}
              x={xAt(p.t) - bw / 2}
              y={M.top + ih - (p.listing / max) * ih}
              width={bw}
              height={Math.max((p.listing / max) * ih, 1)}
              fill="var(--neutral)"
              opacity="0.55"
              rx="2"
            >
              <title>{`${p.date}${p.slot ? ` ${slotLabel(p.slot)}` : ""}, 매물 ${Math.round(p.listing).toLocaleString()}건`}</title>
            </rect>
          )
        )}
      </svg>
      <div className="px-2 t-micro" style={{ color: "var(--text-secondary)" }}>
        매물 수 (등록 기준, 수집이 없는 구간은 빈 칸)
      </div>
    </div>
  );
}
