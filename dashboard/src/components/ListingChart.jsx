// 매물 수 바 차트 (결손 슬롯은 빈 칸으로 정직 표기)
import { useRef, useState, useEffect } from "react";
import { SLOT_LABEL } from "../lib/data";

const M = { top: 8, right: 12, bottom: 20, left: 52 };

export default function ListingChart({ series, height = 110 }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setWidth(es[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  if (!series.length) return null;
  const iw = Math.max(width - M.left - M.right, 10);
  const ih = height - M.top - M.bottom;
  const n = series.length;
  const xAt = (i) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const max = Math.max(...series.map((s) => s.listing ?? 0), 1);
  const bw = Math.min(Math.max(iw / n - 4, 3), 18);

  return (
    <div ref={ref}>
      <svg width={width} height={height}>
        <text x={M.left - 6} y={M.top + 8} textAnchor="end" fontSize="10" fill="var(--text-muted)" className="num">{max}</text>
        <line x1={M.left} x2={width - M.right} y1={M.top + ih} y2={M.top + ih} stroke="var(--border)" />
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
                <title>{`${s.date} ${SLOT_LABEL[s.slot]} — 매물 ${s.listing}`}</title>
              </rect>
            </g>
          )
        )}
        {series.map((s, i) =>
          i === 0 || s.date !== series[i - 1].date ? (
            <text key={i} x={xAt(i)} y={height - 5} textAnchor="middle" fontSize="10" fill="var(--text-muted)" className="num">
              {s.date.slice(5)}
            </text>
          ) : null
        )}
      </svg>
      <div className="px-2 text-xs" style={{ color: "var(--text-secondary)" }}>매물 수 (등록 기준, 결손 슬롯은 빈 칸)</div>
    </div>
  );
}
