// 화면 3 — 브리핑 아카이브: 날짜별 목록·상세, 가설 근거 링크·신뢰도 뱃지
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfidenceBadge, Empty, SeverityBadge, Change, LowLiquidityBadge } from "../components/ui";

export default function Briefings({ data }) {
  const { briefings, anomalies } = data;
  const [selected, setSelected] = useState(briefings[0]?.date ?? null);
  const cur = briefings.find((b) => b.date === selected);
  const linked = cur ? anomalies.filter((a) => cur.anomaly_ids.includes(a.id)) : [];

  if (!briefings.length) return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">브리핑 아카이브</h1>
      <Empty>발행된 브리핑이 아직 없습니다. 심야(KST 03:00) 자동 발행됩니다.</Empty>
    </div>
  );

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">브리핑 아카이브</h1>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        {/* 날짜 목록 */}
        <div className="space-y-1.5">
          {briefings.map((b) => (
            <button key={b.date} onClick={() => setSelected(b.date)}
              className="card block w-full cursor-pointer p-2.5 text-left text-sm"
              style={selected === b.date ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 600 } : {}}>
              <span className="num">{b.date}</span>
              <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                이상 {b.anomaly_ids.length}건
              </span>
            </button>
          ))}
        </div>

        {/* 상세 */}
        {cur && (
          <div className="card p-3">
            <div className="text-xs num" style={{ color: "var(--text-secondary)" }}>
              {cur.date} · 생성 {cur.generatedBy === "template" ? "규칙 기반(무비용)" : cur.generatedBy}
              {cur.costUsd > 0 && <span> · LLM 비용 ${cur.costUsd.toFixed(4)}</span>}
            </div>
            <h2 className="mt-1 text-base font-bold">{cur.headline}</h2>
            <ul className="mt-3 space-y-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
              {cur.summary_3lines.map((l, i) => <li key={i}>· {l}</li>)}
            </ul>

            {cur.notable?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>주목 변동</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {cur.notable.map((n, i) => (
                    <li key={i}><span className="font-semibold">{n.itemName}</span> — {n.comment}</li>
                  ))}
                </ul>
              </div>
            )}

            {linked.length > 0 && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>연결된 이상 변동·가설</h3>
                <div className="mt-2 space-y-2">
                  {linked.map((a) => (
                    <div key={a.id} className="rounded p-2 text-sm" style={{ background: "var(--bg-base)" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/item/${a.itemId}`} className="font-semibold">{a.itemName}</Link>
                        <span className="text-xs">{a.metric === "avgPrice" ? "평균가" : "매물 수"}</span>
                        <Change value={a.change_pct} />
                        <SeverityBadge severity={a.severity} />
                        {a.lowLiquidity && <LowLiquidityBadge />}
                        {a.ai_hypothesis && <ConfidenceBadge confidence={a.ai_hypothesis.confidence} />}
                      </div>
                      {a.ai_hypothesis && (
                        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
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
          </div>
        )}
      </div>
    </div>
  );
}
