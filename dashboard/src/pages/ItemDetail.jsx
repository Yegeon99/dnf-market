// 화면 2 — 아이템 상세: 품목 아이덴티티 헤더 + 히어로 차트 + 이상 변동 이력 (딥링크 /item/:id)
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { itemSeries, dailySeries, fmtGold, fmtSignedPct, dailyChangeMap, latestDate, isLowLiquidity } from "../lib/data";
import PriceChart from "../components/PriceChart";
import ListingChart from "../components/ListingChart";
import { Change, ConfidenceBadge, Empty, LowLiquidityBadge, SeverityBadge } from "../components/ui";

function StatCard({ label, children }) {
  return (
    <div className="card p-3">
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="text-[26px] font-bold num leading-tight">{children}</div>
    </div>
  );
}

/** Neople 오픈 API 제공 아이템 아이콘. 로드 실패 시 이니셜 폴백 */
function ItemIcon({ itemId, name }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded border text-lg font-bold"
            style={{ borderColor: "var(--hairline-strong)", background: "var(--bg-sunken)", color: "var(--text-muted)" }}
            aria-hidden="true">
        {name.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={`https://img-api.neople.co.kr/df/items/${itemId}`}
      alt={`${name} 아이콘 (Neople 오픈 API 제공)`}
      width={56} height={56} loading="lazy"
      className="shrink-0 rounded border"
      style={{ borderColor: "var(--hairline-strong)", background: "var(--bg-sunken)", imageRendering: "pixelated" }}
      onError={() => setOk(false)}
    />
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
  // 저유동 판정은 화면마다 같아야 한다 (당일·전일 매물 수 모두 기준 미만)
  const dailyForItem = dailySeries(rows, id);
  const lowLiq = isLowLiquidity(dailyForItem.at(-1)?.listing, dailyForItem.at(-2)?.listing, llBelow);
  const inRange = events.filter((ev) => series.some((s) => s.date === ev.date));
  const date = latestDate(rows);
  const hasBackfill = series.some((s) => s.backfill);

  const todayChange = date ? dailyChangeMap(rows, id)[date] : null;

  return (
    <div className="space-y-4">
      {/* 품목 아이덴티티 헤더 */}
      <div className="card rise overflow-hidden">
        <div className="hero-grid-bg flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-4">
          <ItemIcon itemId={id} name={item.name} />
          <div className="min-w-0 flex-1">
            <Link to="/" className="text-[13px] no-underline" style={{ color: "var(--text-secondary)" }}>← 마켓 오버뷰</Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="t-title m-0">{item.name}</h1>
              <span className="px-1.5 py-0.5 text-[13px]" style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)", borderRadius: "var(--badge-radius)" }}>{item.category}</span>
              {lowLiq && <LowLiquidityBadge />}
            </div>
            <p className="m-0 mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>선정 사유: {item.reason}</p>
          </div>
          <div className="text-right">
            <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>등록 평균가 (최신 수집)</div>
            <div className="t-numeral" style={{ color: "var(--text-primary)" }}>
              {fmtGold(last?.avgPrice)}<span className="ml-1 text-[15px] font-semibold" style={{ color: "var(--text-secondary)" }}>골드</span>
            </div>
            <div className="num mt-0.5 text-[18px] font-bold"
                 style={{ color: todayChange == null ? "var(--text-muted)" : todayChange > 0 ? "var(--up)" : todayChange < 0 ? "var(--down)" : "var(--neutral)" }}>
              {todayChange == null ? "전일 비교 전" : `전일 대비 ${fmtSignedPct(todayChange)}`}
            </div>
          </div>
        </div>
        {lowLiq && (
          <p className="m-0 border-t px-4 py-2 text-[13px]" style={{ color: "var(--warn)", borderColor: "var(--hairline)" }}>
            저유동 품목입니다. 매물 {last?.listing}건으로 기준 {llBelow}건 미만이라,
            소수 등록·거래만으로 지표가 크게 움직일 수 있습니다. 변동 해석에 주의가 필요합니다.
          </p>
        )}
      </div>

      {/* 보조 지표 */}
      <div className="rise rise-1 grid grid-cols-3 gap-2.5">
        <StatCard label="등록 최저가">{fmtGold(last?.minPrice)}{last?.minPrice != null && <span className="text-[13px] font-normal"> 골드</span>}</StatCard>
        <StatCard label="실거래 평균(24시간)">{fmtGold(last?.soldAvg)}{last?.soldAvg != null && <span className="text-[13px] font-normal"> 골드</span>}</StatCard>
        <StatCard label="매물 수">{last?.listing != null ? `${last.listing.toLocaleString()}` : "미수집"}{last?.listing != null && <span className="text-[13px] font-normal"> 건</span>}</StatCard>
      </div>

      {/* 히어로 차트 */}
      <div className="card rise rise-2 p-3">
        <h2 className="t-section m-0 px-2">시세 추이</h2>
        <p className="m-0 mb-1 px-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          하루 6회 수집(KST 02·07·11·15·19·23시 회차). 결손 회차는 공백으로 표기합니다.
          {hasBackfill && " 수집 시작 전 실거래는 과거 판매완료 내역을 일 단위로 소급 수집했습니다."}
        </p>
        <PriceChart series={series} events={inRange} height={340} />
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
                  <span className="num text-[13px]" style={{ color: "var(--text-secondary)" }}>{a.date}</span>
                  <span className="text-[13px]">{a.metric === "avgPrice" ? "평균가" : "매물 수"} · {a.basis === "ma7" ? "7일 평균 이탈" : "전일 대비"}</span>
                  <Change value={a.change_pct} />
                  <SeverityBadge severity={a.severity} />
                  {a.lowLiquidity && <LowLiquidityBadge />}
                </div>
                {a.ai_hypothesis && (
                  <div className="mt-2 rounded p-2 text-[13px]" style={{ background: "var(--bg-sunken)" }}>
                    <span className="mr-1 font-semibold" style={{ color: "var(--text-secondary)" }}>AI 가설</span>
                    <ConfidenceBadge confidence={a.ai_hypothesis.confidence} />
                    <p className="m-0 mt-1" style={{ color: "var(--text-primary)" }}>{a.ai_hypothesis.text}</p>
                    {a.ai_hypothesis.evidence_urls?.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 text-[13px]">근거 공지 ↗</a>
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
