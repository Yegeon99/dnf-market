// 무인 파이프라인 상태 바: 수집 → 분석 → 브리핑 → 배포를 한 줄 40px에 담는다.
// 히어로 바로 아래에 얇게 깔려 "지금도 사람 손 없이 돌고 있다"만 전한다.
import { lastCollectedLabel } from "../lib/data";

function Light({ on }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${on ? "pulse" : ""}`}
      style={{ background: on ? "var(--statuslight-ok)" : "var(--statuslight-wait)" }}
      aria-hidden="true"
    />
  );
}

export default function StatusStrip({ rows, briefings }) {
  const collected = lastCollectedLabel(rows);
  const latest = briefings[0] ?? null;

  const steps = [
    { title: "수집", on: !!collected, time: collected ?? "대기" },
    { title: "분석", on: !!latest, time: latest ? `${latest.date.slice(5)} 심야` : "대기" },
    { title: "브리핑", on: !!latest, time: latest ? `${latest.date.slice(5)} 발행` : "대기" },
    { title: "배포", on: !!collected, time: "수집 즉시" },
  ];

  return (
    <div className="status-bar">
      <div className="sec-inner h-full">
        <div className="scroll-x h-full" role="group" aria-label="무인 파이프라인 상태">
          <div className="flex h-full min-w-[600px] items-center gap-x-4 whitespace-nowrap text-[13px]">
            <span className="t-eyebrow shrink-0" style={{ color: "var(--gold-text)" }}>무인 파이프라인</span>
            {steps.map((s, i) => (
              <span key={s.title} className="flex shrink-0 items-center gap-1.5">
                {i > 0 && <span className="mr-2.5" style={{ color: "var(--hairline-strong)" }} aria-hidden="true">→</span>}
                <Light on={s.on} />
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.title}</span>
                <span className="num" style={{ color: "var(--text-muted)" }}>{s.time}</span>
              </span>
            ))}
            <span className="ml-auto shrink-0 pl-4" style={{ color: "var(--text-muted)" }}>하루 6회 자동 · 매일 자동 발행</span>
          </div>
        </div>
      </div>
    </div>
  );
}
