// 화면 3 — 브리핑 아카이브: 날짜별 목록과 읽기 좋은 카드 상세, 가설 근거 링크와 신뢰도 뱃지
import { Link, useSearchParams } from "react-router-dom";
import { ConfidenceBadge, Empty, SeverityBadge, Change, LowLiquidityBadge } from "../components/ui";

function BulletIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" className="mt-1.5 shrink-0" aria-hidden="true">
      <path d="M2 6h6M5.5 3.5 8 6 5.5 8.5" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Briefings({ data }) {
  const { briefings, anomalies } = data;
  const [params, setParams] = useSearchParams();
  const selected = params.get("date") ?? briefings[0]?.date ?? null;
  const setSelected = (d) => setParams({ date: d }, { replace: true });
  const cur = briefings.find((b) => b.date === selected) ?? briefings[0];
  const linked = cur ? anomalies.filter((a) => cur.anomaly_ids.includes(a.id)) : [];

  if (!briefings.length) return (
    <div className="space-y-3">
      <h1 className="t-title m-0">브리핑 아카이브</h1>
      <Empty>발행된 브리핑이 아직 없습니다. 심야(KST 03:00)에 자동 발행됩니다.</Empty>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rise">
        <h1 className="t-title m-0">브리핑 아카이브</h1>
        <p className="t-lead m-0 mt-1">매일 심야에 자동 발행되는 데일리 브리핑입니다. 사람 손을 거치지 않습니다.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[190px_1fr]">
        {/* 날짜 목록 */}
        <div className="space-y-1.5" aria-label="브리핑 날짜 목록">
          {briefings.map((b) => {
            const on = cur?.date === b.date;
            return (
              <button key={b.date} onClick={() => setSelected(b.date)}
                aria-current={on ? "true" : undefined}
                className="card card-lift block w-full cursor-pointer p-2.5 text-left text-sm"
                style={on ? { borderColor: "var(--accent)", boxShadow: "inset 2px 0 0 var(--accent)" } : {}}>
                <span className="num" style={{ color: on ? "var(--accent)" : "var(--text-primary)", fontWeight: on ? 700 : 450 }}>{b.date}</span>
                <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  이상 {b.anomaly_ids.length}건
                </span>
              </button>
            );
          })}
        </div>

        {/* 상세 */}
        {cur && (
          <article className="card rise p-4">
            <div className="t-kicker num">
              {cur.date} · 생성 {cur.generatedBy === "template" ? "규칙 기반(무비용)" : cur.generatedBy}
              {cur.costUsd > 0 && <span> · LLM 비용 ${cur.costUsd.toFixed(4)}</span>}
            </div>
            <h2 className="t-section m-0 mt-1.5" style={{ fontSize: "1.3rem", lineHeight: 1.35 }}>{cur.headline}</h2>
            <hr className="rule mt-3 mb-3" />
            <ul className="m-0 list-none space-y-2 p-0 text-sm" style={{ color: "var(--text-primary)" }}>
              {cur.summary_3lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <BulletIcon />
                  <span>{l}</span>
                </li>
              ))}
            </ul>

            {cur.notable?.length > 0 && (
              <div className="mt-5">
                <h3 className="t-kicker m-0">주목 변동</h3>
                <ul className="m-0 mt-1.5 list-none space-y-1.5 p-0 text-sm">
                  {cur.notable.map((n, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{n.itemName}</span>
                      <span style={{ color: "var(--text-secondary)" }}>{n.comment}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {linked.length > 0 && (
              <div className="mt-5 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
                <h3 className="t-kicker m-0">연결된 이상 변동·가설</h3>
                <div className="mt-2 space-y-2">
                  {linked.map((a) => (
                    <div key={a.id} className="rounded p-2.5 text-sm" style={{ background: "var(--bg-sunken)" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/item/${a.itemId}`} className="font-semibold">{a.itemName}</Link>
                        <span className="text-xs">{a.metric === "avgPrice" ? "평균가" : "매물 수"}</span>
                        <Change value={a.change_pct} />
                        <SeverityBadge severity={a.severity} />
                        {a.lowLiquidity && <LowLiquidityBadge />}
                        {a.ai_hypothesis && <ConfidenceBadge confidence={a.ai_hypothesis.confidence} />}
                      </div>
                      {a.ai_hypothesis && (
                        <p className="m-0 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {a.ai_hypothesis.text}
                          {a.ai_hypothesis.evidence_urls?.map((u) => (
                            <a key={u} href={u} target="_blank" rel="noreferrer" className="ml-2">근거 ↗</a>
                          ))}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
