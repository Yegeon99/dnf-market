// 매물 수 바 차트 (결손 회차는 빈 칸으로 정직 표기)
import { useRef } from "react";
import { slotLabel } from "../lib/data";
import { useWidth } from "../lib/use-width";

const M = { top: 16, right: 12, bottom: 22, left: 66 };
// 날짜 라벨은 가운데 정렬이라 양 끝에서 잘린다. 절반 폭만큼 안쪽으로 물린다
const TICK_HALF = 18;

export default function ListingChart({ series, height = 116 }) {
  const ref = useRef(null);
  const width = useWidth(ref);

  if (!series.length) return null;
  const iw = Math.max(width - M.left - M.right, 10);
  const ih = height - M.top - M.bottom;
  const n = series.length;
  const xAt = (i) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const max = Math.max(...series.map((s) => s.listing ?? 0), 1);
  const bw = Math.min(Math.max(iw / n - 4, 3), 18);
  const hasAny = series.some((s) => s.listing != null);

  return (
    <div ref={ref}>
      <svg width={width} height={height} role="img" aria-label="매물 수 추이 차트">
        <text x={M.left - 54} y={12} fontSize="13" fill="var(--chart-axis-text)">단위: 건</text>
        <text x={M.left - 6} y={M.top + 8} textAnchor="end" fontSize="13" fill="var(--chart-axis-text)" className="num">{max.toLocaleString()}</text>
        <line x1={M.left} x2={width - M.right} y1={M.top + ih} y2={M.top + ih} stroke="var(--chart-grid)" />
        {!hasAny && (
          <text x={M.left + iw / 2} y={M.top + ih / 2} textAnchor="middle" fontSize="13" fill="var(--text-muted)">
            표시할 매물 수 데이터가 없습니다
          </text>
        )}
        {series.map((s, i) =>
          s.listing == null ? null : (
            <g key={i}>
              <rect
                x={xAt(i) - bw / 2}
                y={M.top + ih - (s.listing / max) * ih}
                width={bw}
                height={Math.max((s.listing / max) * ih, 1)}
                fill="var(--neutral)"
                opacity="0.55"
                rx="2"
              >
                <title>{`${s.date} ${slotLabel(s.slot)}, 매물 ${s.listing.toLocaleString()}건`}</title>
              </rect>
            </g>
          )
        )}
        {(() => {
          let ticks = [];
          series.forEach((s, i) => {
            if (i === 0 || s.date !== series[i - 1].date) ticks.push({ i, date: s.date });
          });
          if (ticks.length > 10) {
            const step = Math.ceil(ticks.length / 8);
            ticks = ticks.filter((_, k) => k % step === 0 || k === ticks.length - 1);
          }
          return ticks.map((t) => (
            <text key={t.i} x={Math.min(Math.max(xAt(t.i), TICK_HALF), width - TICK_HALF)} y={height - 5} textAnchor="middle" fontSize="13" fill="var(--chart-axis-text)" className="num">
              {t.date.slice(5)}
            </text>
          ));
        })()}
      </svg>
      <div className="px-2 t-micro" style={{ color: "var(--text-secondary)" }}>매물 수 (등록 기준, 결손 회차는 빈 칸)</div>
    </div>
  );
}
