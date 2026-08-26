// 히트맵 색상 범례: 그라데이션 바 + 구간 라벨 (오버뷰·방법론 공유)
const STOPS = [
  "var(--heat-down-5)", "var(--heat-down-4)", "var(--heat-down-3)", "var(--heat-down-2)", "var(--heat-down-1)",
  "var(--heat-flat)",
  "var(--heat-up-1)", "var(--heat-up-2)", "var(--heat-up-3)", "var(--heat-up-4)", "var(--heat-up-5)",
];
const LABELS = ["-20%", "-10", "-5", "-2", "±0.5", "+2", "+5", "+10", "+20%"];

export default function HeatLegend({ width = 220 }) {
  return (
    <div style={{ width }}>
      <div className="flex h-2.5 overflow-hidden rounded-sm" title="전일 대비 등락 색상 스케일">
        {STOPS.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] num" style={{ color: "var(--text-muted)" }}>
        {LABELS.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}
