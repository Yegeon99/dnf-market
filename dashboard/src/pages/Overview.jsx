// 화면 1 — 마켓 오버뷰: KPI, 카테고리 등락 히트맵, 최신 브리핑
import { Link } from "react-router-dom";
import { dodChanges, latestDate, fmtGold } from "../lib/data";
import { Change, Empty, LowLiquidityBadge } from "../components/ui";

function Kpi({ label, children }) {
  return (
    <div className="card p-4">
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="mt-1 text-xl font-bold num">{children}</div>
    </div>
  );
}

/** 등락 히트맵 셀 배경: 상승 레드·하락 블루, 변동폭에 따라 투명도 */
function cellStyle(pct) {
  if (pct == null) return { background: "#F0F2F5", color: "var(--text-muted)" };
  const a = Math.min(Math.abs(pct) / 20, 1) * 0.85 + 0.08;
  return pct >= 0
    ? { background: `rgba(214,69,69,${a.toFixed(2)})`, color: Math.abs(pct) > 6 ? "#fff" : "var(--text-primary)" }
    : { background: `rgba(46,107,214,${a.toFixed(2)})`, color: Math.abs(pct) > 6 ? "#fff" : "var(--text-primary)" };
}

export default function Overview({ data }) {
  const { rows, anomalies, briefings, items, thresholds } = data;
  const date = latestDate(rows);
  const changes = dodChanges(rows, items, date);
  const todayAnomalies = anomalies.filter((a) => a.date === date);
  const withChange = changes.filter((c) => c.changePct != null);
  const ups = [...withChange].sort((a, b) => b.changePct - a.changePct).filter((c) => c.changePct > 0).slice(0, 3);
  const downs = [...withChange].sort((a, b) => a.changePct - b.changePct).filter((c) => c.changePct < 0).slice(0, 3);
  const latestBriefing = briefings[0];
  const llBelow = thresholds?.lowLiquidity?.listingCountBelow ?? 0;

  const byCategory = {};
  for (const c of changes) (byCategory[c.category] ??= []).push(c);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">마켓 오버뷰</h1>
        <span className="text-xs num" style={{ color: "var(--text-muted)" }}>기준일 {date ?? "—"} (KST, 하루 3회 수집)</span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="추적 품목">{items.length}종</Kpi>
        <Kpi label="오늘 이상 변동">
          <span style={{ color: todayAnomalies.length ? "var(--warn)" : "var(--text-primary)" }}>
            {todayAnomalies.length}건
          </span>
        </Kpi>
        <Kpi label="상승 1위 (전일 대비)">
          {ups[0] ? (
            <span className="text-sm">{ups[0].name} <Change value={ups[0].changePct} /></span>
          ) : (
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{withChange.length ? "상승 없음" : "비교 데이터 축적 중"}</span>
          )}
        </Kpi>
        <Kpi label="하락 1위 (전일 대비)">
          {downs[0] ? (
            <span className="text-sm">{downs[0].name} <Change value={downs[0].changePct} /></span>
          ) : (
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{withChange.length ? "하락 없음" : "비교 데이터 축적 중"}</span>
          )}
        </Kpi>
      </div>

      {/* 최신 브리핑 */}
      {latestBriefing ? (
        <Link to="/briefings" className="card block p-4 no-underline" style={{ color: "inherit" }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="num">{latestBriefing.date}</span>
            <span>데일리 브리핑</span>
            <span className="ml-auto" style={{ color: "var(--accent)" }}>아카이브 →</span>
          </div>
          <div className="mt-1 font-bold">{latestBriefing.headline}</div>
          <ul className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {latestBriefing.summary_3lines.map((l, i) => <li key={i}>· {l}</li>)}
          </ul>
        </Link>
      ) : (
        <Empty>브리핑이 아직 발행되지 않았습니다.</Empty>
      )}

      {/* 카테고리 히트맵 */}
      <div>
        <div className="mb-2 flex items-baseline justify-between flex-wrap gap-1">
          <h2 className="text-sm font-bold">카테고리별 등락 (전일 대비 평균 등록가)</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--up)" }}>■ 상승</span> · <span style={{ color: "var(--down)" }}>■ 하락</span> · 회색 = 비교 불가
          </span>
        </div>
        <div className="space-y-3">
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat} className="card p-3">
              <div className="mb-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{cat}</div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {list.map((c) => (
                  <Link key={c.itemId} to={`/item/${c.itemId}`}
                        className="rounded px-2 py-1.5 text-xs no-underline"
                        style={cellStyle(c.changePct)}
                        title={`${c.name} — 평균가 ${fmtGold(c.avgPrice)}`}>
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="num flex items-center gap-1">
                      {c.changePct == null ? "축적 중" : `${c.changePct > 0 ? "▲" : c.changePct < 0 ? "▼" : ""}${Math.abs(c.changePct).toFixed(1)}%`}
                      {llBelow > 0 && c.listing != null && c.listing < llBelow && <LowLiquidityBadge />}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
