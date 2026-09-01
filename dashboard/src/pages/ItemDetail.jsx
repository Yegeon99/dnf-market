// 화면 2 — 아이템 상세: 품목 아이덴티티 헤더 + 히어로 차트 + 이상 변동 이력 (딥링크 /item/:id)
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { itemSeries, dailySeries, fmtGold, dailyChangeMap, latestDate, isLowLiquidity } from "../lib/data";
import PriceChart from "../components/PriceChart";
import ListingChart from "../components/ListingChart";
import { Change, ConfidenceBadge, CountUpPct, CountUpValue, Empty, LowLiquidityBadge, SeverityBadge } from "../components/ui";

function StatCard({ label, children }) {
  return (
    <div className="card p-3">
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="t-stat font-bold num leading-tight">{children}</div>
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
      width={56} height={56} fetchPriority="high"
      className="shrink-0 rounded border"
      style={{ borderColor: "var(--hairline-strong)", background: "var(--bg-sunken)", imageRendering: "pixelated" }}
      onError={() => setOk(false)}
    />
  );
}

const RANGES = [
  { days: 14, label: "최근 14일" },
  { days: 30, label: "최근 30일" },
  { days: 0, label: "전체" },
];

const ctrlStyle = (on) => ({
  background: on ? "var(--accent-soft)" : "transparent",
  color: on ? "var(--accent)" : "var(--text-secondary)",
  borderColor: on ? "var(--accent)" : "var(--hairline-strong)",
});

export default function ItemDetail({ data }) {
  const { id } = useParams();
  const [mode, setMode] = useState("day");       // day | slot
  const [rangeDays, setRangeDays] = useState(14);
  const [tableOpen, setTableOpen] = useState(false);
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
            <Link to="/" className="t-micro no-underline" style={{ color: "var(--text-secondary)" }}>← 마켓 오버뷰</Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="t-title m-0">{item.name}</h1>
              <span className="px-1.5 py-0.5 t-micro" style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)", borderRadius: "var(--badge-radius)" }}>{item.category}</span>
              {lowLiq && <LowLiquidityBadge />}
            </div>
            <p className="m-0 mt-1 t-micro" style={{ color: "var(--text-muted)" }}>선정 사유: {item.reason}</p>
          </div>
          <div className="text-right">
            <div className="t-micro" style={{ color: "var(--text-secondary)" }}>등록 대표가 (최신 수집)</div>
            <div className="t-numeral" style={{ color: "var(--text-primary)" }}>
              <CountUpValue value={last?.avgPrice} format={fmtGold} /><span className="ml-1 t-body-lg font-semibold" style={{ color: "var(--text-secondary)" }}>골드</span>
            </div>
            <div className="num mt-0.5 t-figure font-bold"
                 style={{ color: todayChange == null ? "var(--text-muted)" : todayChange > 0 ? "var(--up)" : todayChange < 0 ? "var(--down)" : "var(--neutral)" }}>
              {todayChange == null ? "전일 비교 전" : <>전일 대비 <CountUpPct value={todayChange} signed /></>}
            </div>
          </div>
        </div>
        {lowLiq && (
          <p className="m-0 border-t px-4 py-2 t-micro" style={{ color: "var(--warn)", borderColor: "var(--hairline)" }}>
            저유동 품목입니다. 매물 {last?.listing != null ? `${last.listing.toLocaleString()}건` : "수 미수집"}으로 기준 {llBelow}건 미만이라,
            소수 등록·거래만으로 지표가 크게 움직일 수 있습니다. 변동 해석에 주의가 필요합니다.
          </p>
        )}
      </div>

      {/* 보조 지표 */}
      <div className="rise rise-1 grid grid-cols-3 gap-2.5">
        <StatCard label="등록 최저가">{fmtGold(last?.minPrice)}{last?.minPrice != null && <span className="t-micro font-normal"> 골드</span>}</StatCard>
        <StatCard label={last?.soldCapped ? "실거래 대표가 (최근 100건)" : "실거래 대표가 (24시간)"}>{fmtGold(last?.soldAvg)}{last?.soldAvg != null && <span className="t-micro font-normal"> 골드</span>}</StatCard>
        <StatCard label="등록 건수">{last?.listing != null ? `${last.listing.toLocaleString()}` : "미수집"}{last?.listing != null && <span className="t-micro font-normal"> 건{last?.listingQty != null ? ` (${last.listingQty.toLocaleString()}개)` : ""}</span>}</StatCard>
      </div>

      {/* 히어로 차트 */}
      <div className="card rise rise-2 p-3">
        <h2 className="t-section m-0 px-2">시세 추이</h2>
        <p className="m-0 mb-2 px-2 t-micro" style={{ color: "var(--text-muted)" }}>
          하루 최대 6회 수집(KST 02·07·11·15·19·23시 회차)이며, 예약 실행이 밀리거나 점검과 겹치면 회차가 빕니다. 결손 회차는 공백으로 표기합니다.
          {hasBackfill && " 수집 시작 전 실거래는 과거 판매완료 내역을 일 단위로 소급 수집했습니다."}
        </p>
        {/* 보기 조절은 두 차트를 함께 바꾼다. 그래서 차트 안이 아니라 위에 한 줄로 둔다 */}
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2">
          <div className="flex items-center gap-1" role="group" aria-label="표시 기간">
            {RANGES.map((r) => (
              <button key={r.days} type="button" className="chart-ctrl" style={ctrlStyle(rangeDays === r.days)}
                      aria-pressed={rangeDays === r.days} onClick={() => setRangeDays(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="표시 단위">
            {[["day", "일 단위"], ["slot", "회차별"]].map(([k, label]) => (
              <button key={k} type="button" className="chart-ctrl" style={ctrlStyle(mode === k)}
                      aria-pressed={mode === k} onClick={() => setMode(k)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="disclose ml-auto" aria-expanded={tableOpen}
                  onClick={() => setTableOpen((v) => !v)}>
            {tableOpen ? "표 닫기" : "표로 보기"}
          </button>
        </div>
        <PriceChart series={series} events={inRange} height={340}
                    mode={mode} rangeDays={rangeDays} tableOpen={tableOpen} />
        <div className="mt-2 border-t pt-1.5" style={{ borderColor: "var(--hairline)" }}>
          <ListingChart series={series} mode={mode} rangeDays={rangeDays} />
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
                  <span className="num t-micro" style={{ color: "var(--text-secondary)" }}>{a.date}</span>
                  <span className="t-micro">{a.metric === "avgPrice" ? "평균가" : "매물 수"} · {a.basis === "ma7" ? "7일 평균 이탈" : "전일 대비"}</span>
                  <Change value={a.change_pct} />
                  <SeverityBadge severity={a.severity} />
                  {a.lowLiquidity && <LowLiquidityBadge />}
                </div>
                {a.ai_hypothesis && (
                  <div className="mt-2 rounded p-2 t-micro" style={{ background: "var(--bg-sunken)" }}>
                    <span className="mr-1 font-semibold" style={{ color: "var(--text-secondary)" }}>AI 가설</span>
                    <ConfidenceBadge confidence={a.ai_hypothesis.confidence} />
                    <p className="m-0 mt-1" style={{ color: "var(--text-primary)" }}>{a.ai_hypothesis.text}</p>
                    {a.ai_hypothesis.evidence_urls?.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="mr-2 t-micro">근거 공지 ↗</a>
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
