// 화면 2 — 아이템 상세: 시세·매물수 차트 + 이벤트 마커 + 이상 변동 이력 (딥링크 /item/:id)
import { useParams, Link } from "react-router-dom";
import { itemSeries, fmtGold, latestDate } from "../lib/data";
import PriceChart from "../components/PriceChart";
import ListingChart from "../components/ListingChart";
import { Change, ConfidenceBadge, Empty, LowLiquidityBadge, SeverityBadge } from "../components/ui";

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

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-xs no-underline" style={{ color: "var(--text-secondary)" }}>← 마켓 오버뷰</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold">{item.name}</h1>
          <span className="rounded px-1.5 py-0.5 text-xs" style={{ background: "#EEF1F6", color: "var(--text-secondary)" }}>{item.category}</span>
          {lowLiq && <LowLiquidityBadge />}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>선정 사유: {item.reason}</p>
        {lowLiq && (
          <p className="mt-1 text-xs" style={{ color: "var(--warn)" }}>
            ⚠ 저유동 품목 — 매물 {last?.listing}건(기준 {llBelow}건 미만). 소수 등록·거래만으로 지표가 크게 움직일 수 있어 변동 해석에 주의가 필요합니다.
          </p>
        )}
      </div>

      {/* 현재가 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-3">
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>등록 평균가</div>
          <div className="text-lg font-bold num">{fmtGold(last?.avgPrice)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>등록 최저가</div>
          <div className="text-lg font-bold num">{fmtGold(last?.minPrice)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>실거래 평균(24h)</div>
          <div className="text-lg font-bold num">{fmtGold(last?.soldAvg)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>매물 수</div>
          <div className="text-lg font-bold num">{last?.listing ?? "—"}</div>
        </div>
      </div>

      {/* 차트 */}
      <div className="card p-3">
        <h2 className="mb-1 px-2 text-sm font-bold">시세 추이 <span className="font-normal text-xs" style={{ color: "var(--text-muted)" }}>(하루 6회 수집 KST 03·07·11·15·19·23시, 결손 슬롯은 공백{series.some((s) => s.backfill) ? ", 과거 실거래는 일 단위 소급 백필" : ""})</span></h2>
        <PriceChart series={series} events={inRange} />
        <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--border)" }}>
          <ListingChart series={series} />
        </div>
      </div>

      {/* 이상 변동 이력 */}
      <div>
        <h2 className="mb-2 text-sm font-bold">이상 변동 이력</h2>
        {myAnomalies.length === 0 ? (
          <Empty>탐지된 이상 변동이 없습니다. (기준일 {date ?? "—"})</Empty>
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
                  <div className="mt-2 rounded p-2 text-xs" style={{ background: "var(--bg-base)" }}>
                    <span className="mr-1 font-semibold" style={{ color: "var(--text-secondary)" }}>AI 가설</span>
                    <ConfidenceBadge confidence={a.ai_hypothesis.confidence} />
                    <p className="mt-1" style={{ color: "var(--text-primary)" }}>{a.ai_hypothesis.text}</p>
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
