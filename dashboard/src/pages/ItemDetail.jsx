// 화면 2 — 아이템 상세: 시세·매물수 차트 + 이벤트 마커 + 이상 변동 이력 (딥링크 /item/:id)
import { useParams, Link } from "react-router-dom";
import { itemSeries, fmtGold, latestDate } from "../lib/data";
import PriceChart from "../components/PriceChart";
import ListingChart from "../components/ListingChart";
import { Change, ConfidenceBadge, Empty, LowLiquidityBadge, SeverityBadge } from "../components/ui";

function StatCard({ label, children }) {
  return (
    <div className="card rise p-3">
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="text-lg font-bold num">{children}</div>
    </div>
  );
}

export default function ItemDetail({ data }) {
  const { id } = useParams();
  const { rows, anomalies, items, events, thresholds } = data;
  const item = items.find((it) => it.itemId === id);
  if (!item) return <Empty>품목을 찾을 수 없습니다. <Link to="/">오버뷰로</Link></Empty>;

  const series = itemSeries(rows, id, data.backfill);
  const myAnomalies = anomalies.filter((a) => a.itemId === id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = [...series].reverse().find((s) => s.avgPrice != null);
  const llBelow = thresholds?.lowLiquidity?.listingCountBelow ?? 0;
  const lowLiq = llBelow > 0 && last?.listing != null && last.listing < llBelow;
  const inRange = events.filter((ev) => series.some((s) => s.date === ev.date));
  const date = latestDate(rows);
  const hasBackfill = series.some((s) => s.backfill);

  return (
    <div className="space-y-4">
      <div className="rise">
        <Link to="/" className="text-xs no-underline" style={{ color: "var(--text-secondary)" }}>← 마켓 오버뷰</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="t-title m-0">{item.name}</h1>
          <span className="px-1.5 py-0.5 text-xs" style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)", borderRadius: "var(--badge-radius)" }}>{item.category}</span>
          {lowLiq && <LowLiquidityBadge />}
        </div>
        <p className="m-0 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>선정 사유: {item.reason}</p>
        {lowLiq && (
          <p className="m-0 mt-1 text-xs" style={{ color: "var(--warn)" }}>
            저유동 품목입니다. 매물 {last?.listing}건으로 기준 {llBelow}건 미만이라,
            소수 등록·거래만으로 지표가 크게 움직일 수 있습니다. 변동 해석에 주의가 필요합니다.
          </p>
        )}
      </div>

      {/* 현재가 요약 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="등록 평균가">{fmtGold(last?.avgPrice)}{last?.avgPrice != null && <span className="text-xs font-normal"> 골드</span>}</StatCard>
        <StatCard label="등록 최저가">{fmtGold(last?.minPrice)}{last?.minPrice != null && <span className="text-xs font-normal"> 골드</span>}</StatCard>
        <StatCard label="실거래 평균(24시간)">{fmtGold(last?.soldAvg)}{last?.soldAvg != null && <span className="text-xs font-normal"> 골드</span>}</StatCard>
        <StatCard label="매물 수">{last?.listing != null ? `${last.listing.toLocaleString()}` : "미수집"}{last?.listing != null && <span className="text-xs font-normal"> 건</span>}</StatCard>
      </div>

      {/* 차트 */}
      <div className="card p-3">
        <h2 className="t-section m-0 px-2">시세 추이</h2>
        <p className="m-0 mb-1 px-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          하루 6회 수집(KST 03·07·11·15·19·23시). 결손 회차는 공백으로 표기합니다.
          {hasBackfill && " 수집 시작 전 실거래는 과거 판매완료 내역을 일 단위로 소급 수집했습니다."}
        </p>
        <PriceChart series={series} events={inRange} />
        <div className="mt-2 border-t pt-1.5" style={{ borderColor: "var(--hairline)" }}>
          <ListingChart series={series} />
        </div>
      </div>

      {/* 이상 변동 이력 */}
      <div>
        <h2 className="t-section m-0 mb-2">이상 변동 이력</h2>
        {myAnomalies.length === 0 ? (
          <Empty>탐지된 이상 변동이 없습니다. (기준일 {date ?? "집계 전"})</Empty>
        ) : (
          <div className="space-y-2">
            {myAnomalies.map((a) => (
              <div key={a.id} className="card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-xs" style={{ color: "var(--text-secondary)" }}>{a.date}</span>
                  <span className="text-xs">{a.metric === "avgPrice" ? "평균가" : "매물 수"} · {a.basis === "ma7" ? "7일 평균 이탈" : "전일 대비"}</span>
                  <Change value={a.change_pct} />
                  <SeverityBadge severity={a.severity} />
                  {a.lowLiquidity && <LowLiquidityBadge />}
                </div>
                {a.ai_hypothesis && (
                  <div className="mt-2 rounded p-2 text-xs" style={{ background: "var(--bg-sunken)" }}>
                    <span className="mr-1 font-semibold" style={{ color: "var(--text-secondary)" }}>AI 가설</span>
                    <ConfidenceBadge confidence={a.ai_hypothesis.confidence} />
                    <p className="m-0 mt-1" style={{ color: "var(--text-primary)" }}>{a.ai_hypothesis.text}</p>
                    {a.ai_hypothesis.evidence_urls?.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 text-xs">근거 공지 ↗</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
