// 무인 파이프라인 상태 바: 수집 → 분석 → 브리핑 → 배포를 한 줄 40px에 담는다.
// 히어로 바로 아래에 얇게 깔려 "지금도 사람 손 없이 돌고 있다"만 전한다.
// 단, 최근 회차가 실패했으면 그 사실을 숨기지 않는다 (상태등 주황 + 오른쪽 안내).
import { lastCollectedLabel, slotLabel } from "../lib/data";

function Light({ state }) {
  const color = { ok: "var(--statuslight-ok)", fail: "var(--statuslight-fail)" }[state]
    ?? "var(--statuslight-wait)";
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${state === "ok" ? "pulse" : ""}`}
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

/** 마지막 시도 회차가 실패했을 때 한 줄 안내문. 정상이면 null */
function failureNotice(attempt) {
  if (!attempt || attempt.okCount > 0) return null;
  return `${attempt.date.slice(5)} ${slotLabel(attempt.slot)} 회차 수집 실패(전 품목), 다음 회차 자동 재시도`;
}

export default function StatusStrip({ rows, briefings, collection }) {
  const collected = lastCollectedLabel(rows);
  const latest = briefings[0] ?? null;
  const attempt = collection?.latestAttempt ?? null;
  const notice = failureNotice(attempt);
  const partial = !notice && attempt?.failCount > 0;

  const steps = [
    {
      title: "수집",
      state: notice ? "fail" : collected ? "ok" : "wait",
      time: collected ?? "대기",
    },
    { title: "분석", state: latest ? "ok" : "wait", time: latest ? `${latest.date.slice(5)} 심야` : "대기" },
    { title: "브리핑", state: latest ? "ok" : "wait", time: latest ? `${latest.date.slice(5)} 발행` : "대기" },
    { title: "배포", state: collected ? "ok" : "wait", time: "수집 즉시" },
  ];

  return (
    <div className="status-bar">
      <div className="sec-inner h-full">
        <div className="scroll-x h-full" role="group" aria-label="무인 파이프라인 상태">
          <div className="flex h-full min-w-[600px] items-center gap-x-4 whitespace-nowrap text-[13px]">
            {/* 실패가 있으면 좁은 화면에서 라벨 자리를 안내문에 내준다 */}
            <span className={`t-eyebrow shrink-0 ${notice ? "hidden sm:inline" : ""}`}
                  style={{ color: "var(--gold-text)" }}>무인 파이프라인</span>
            {steps.map((s, i) => (
              <span key={s.title} className="flex shrink-0 items-center gap-1.5">
                {i > 0 && <span className="mr-2.5" style={{ color: "var(--hairline-strong)" }} aria-hidden="true">→</span>}
                <Light state={s.state} />
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.title}</span>
                <span className="num" style={{ color: "var(--text-muted)" }}>{s.time}</span>
              </span>
            ))}
            <span
              className={`shrink-0 ${notice
                ? "order-first pr-4 font-medium sm:order-none sm:ml-auto sm:pl-4 sm:pr-0"
                : "ml-auto pl-4"}`}
              style={{ color: notice ? "var(--statuslight-fail)" : "var(--text-muted)" }}
              role={notice ? "status" : undefined}
            >
              {notice
                ?? (partial
                  ? `${attempt.date.slice(5)} ${slotLabel(attempt.slot)} 회차 일부 실패(${attempt.okCount}/${attempt.itemCount}종 수집)`
                  : "하루 6회 자동 · 매일 자동 발행")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
