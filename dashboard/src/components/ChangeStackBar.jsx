// 등락 스택 바: 오늘 하루 31품목이 어느 쪽으로 움직였는지 한 줄로.
// 3D 지형도를 대신하는 요약 장치. 구간 색은 히트맵과 같은 등락색 규칙을 쓴다.
import { HEAT_BOUNDS } from "../lib/data";

const FLAT = HEAT_BOUNDS[0]; // ±0.5% 미만은 보합

function splitChanges(cells) {
  let up = 0, down = 0, flat = 0, pending = 0;
  for (const c of cells) {
    if (c.changePct == null) pending += 1;
    else if (Math.abs(c.changePct) < FLAT) flat += 1;
    else if (c.changePct > 0) up += 1;
    else down += 1;
  }
  return { up, down, flat, pending, total: cells.length };
}

export default function ChangeStackBar({ cells }) {
  const { up, down, flat, pending, total } = splitChanges(cells);
  if (!total) return null;

  const segs = [
    { key: "up", n: up, label: "상승", color: "var(--up)" },
    { key: "flat", n: flat, label: "보합", color: "var(--heat-flat)" },
    { key: "down", n: down, label: "하락", color: "var(--down)" },
    { key: "pending", n: pending, label: "비교 대기", color: "var(--heat-none)" },
  ].filter((s) => s.n > 0);

  const text = segs.map((s) => `${s.label} ${s.n}종`).join(", ");

  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`전일 대비 ${text} (총 ${total}종)`}
      >
        {segs.map((s) => (
          <span
            key={s.key}
            className="stack-seg"
            style={{ width: `${(s.n / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[13px]" aria-hidden="true">
        {segs.map((s) => (
          <span key={s.key} style={{ color: "var(--text-secondary)" }}>
            {s.label} <b className="num" style={{ color: s.key === "up" ? "var(--up)" : s.key === "down" ? "var(--down)" : "var(--text-primary)" }}>{s.n}</b>종
          </span>
        ))}
      </div>
    </div>
  );
}
