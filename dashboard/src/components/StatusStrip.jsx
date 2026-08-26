// 파이프라인 상태 스트립: 수집 → 분석 → 브리핑 → 배포.
// 각 단계의 최근 실행 시각과 상태등을 한 줄로 보여 "무인 운영 중"을 시각화한다.
import { lastCollectedLabel } from "../lib/data";

function Light({ on }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${on ? "pulse" : ""}`}
      style={{ background: on ? "var(--statuslight-ok)" : "var(--statuslight-wait)" }}
      aria-hidden="true"
    />
  );
}

function Step({ title, time, on, note }) {
  return (
    <div className="flex min-w-[132px] flex-1 items-start gap-2 px-1">
      <div className="mt-1"><Light on={on} /></div>
      <div>
        <div className="text-sm font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>{title}</div>
        <div className="num text-[13px] leading-snug" style={{ color: on ? "var(--text-secondary)" : "var(--text-muted)" }}>
          {time}
        </div>
        {note && <div className="text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>{note}</div>}
      </div>
    </div>
  );
}

function ArrowGap() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" className="mt-1.5 shrink-0" aria-hidden="true">
      <path d="M1 6h13M11 2.5 14.5 6 11 9.5" fill="none" stroke="var(--hairline-strong)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StatusStrip({ rows, briefings, bare = false }) {
  const collected = lastCollectedLabel(rows);
  const latestBriefing = briefings[0] ?? null;

  const steps = [
    {
      title: "수집",
      on: !!collected,
      time: collected ? `최근 ${collected}` : "대기",
      note: "하루 6회 자동",
    },
    {
      title: "분석",
      on: !!latestBriefing,
      time: latestBriefing ? `${latestBriefing.date.slice(5)} 심야 실행` : "첫 실행 대기",
      note: "이상 탐지·AI 해석",
    },
    {
      title: "브리핑",
      on: !!latestBriefing,
      time: latestBriefing ? `${latestBriefing.date.slice(5)} 발행` : "발행 대기",
      note: "매일 자동 발행",
    },
    {
      title: "배포",
      on: !!collected,
      time: "수집 즉시 반영",
      note: "Vercel 자동",
    },
  ];

  const inner = (
    <div className={`flex items-start gap-1 ${bare ? "min-w-[560px]" : "min-w-[640px] px-3 py-2"}`}>
      {!bare && (
        <div className="mr-2 hidden shrink-0 self-center sm:block">
          <div className="t-eyebrow leading-tight" style={{ color: "var(--accent)" }}>무인<br />파이프라인</div>
        </div>
      )}
      {steps.map((s, i) => (
        <div key={s.title} className="flex flex-1 items-start">
          {i > 0 && <ArrowGap />}
          <Step {...s} />
        </div>
      ))}
    </div>
  );

  if (bare) {
    return (
      <div className="scroll-x" role="group" aria-label="무인 파이프라인 상태">
        <div className="t-eyebrow mb-1" style={{ color: "var(--gold-text)" }}>무인 파이프라인</div>
        {inner}
      </div>
    );
  }
  return (
    <div className="card scroll-x" role="group" aria-label="무인 파이프라인 상태">
      {inner}
    </div>
  );
}
