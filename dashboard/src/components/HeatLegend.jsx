// 히트맵 색상 범례: 이산 스와치 + 경계 라벨. 방향 안내 문구를 함께 둔다 (오버뷰·방법론 공유)
const CELLS = [
  { c: "var(--heat-down-5)", b: "-20%" },
  { c: "var(--heat-down-4)", b: "-10" },
  { c: "var(--heat-down-3)", b: "-5" },
  { c: "var(--heat-down-2)", b: "-2" },
  { c: "var(--heat-down-1)", b: "" },
  { c: "var(--heat-flat)", b: "보합" },
  { c: "var(--heat-up-1)", b: "" },
  { c: "var(--heat-up-2)", b: "+2" },
  { c: "var(--heat-up-3)", b: "+5" },
  { c: "var(--heat-up-4)", b: "+10" },
  { c: "var(--heat-up-5)", b: "+20%" },
];

export default function HeatLegend({ width = 250 }) {
  return (
    <div style={{ width }} aria-label="전일 대비 등락 색상 범례">
      <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span>← 하락</span>
        <span>전일 대비 등락률</span>
        <span>상승 →</span>
      </div>
      <div className="mt-0.5 flex gap-[2px]">
        {CELLS.map((cell, i) => (
          <span key={i} className="h-2.5 flex-1" style={{ background: cell.c, borderRadius: 2 }} />
        ))}
      </div>
      <div className="mt-0.5 flex text-[10px] num" style={{ color: "var(--text-muted)" }}>
        {CELLS.map((cell, i) => (
          <span key={i} className="flex-1 text-center">{cell.b}</span>
        ))}
      </div>
    </div>
  );
}
