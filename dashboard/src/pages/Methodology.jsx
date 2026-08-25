// 화면 4 — 방법론·데이터 정책: 수집 구조, 이상 탐지 기준 공개, 품목 선정 근거, 출처 고지
import { Link } from "react-router-dom";

function Box({ children, accent }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center text-xs font-medium"
         style={{ borderColor: accent ? "var(--accent)" : "var(--border)", background: "var(--bg-surface)", color: accent ? "var(--accent)" : "var(--text-primary)" }}>
      {children}
    </div>
  );
}
function Arrow() {
  return <div className="text-center text-sm" style={{ color: "var(--text-muted)" }}>↓</div>;
}

export default function Methodology({ data }) {
  const { items, thresholds } = data;
  const dod = thresholds.dayOverDay;
  const ma = thresholds.movingAverage;
  const ll = thresholds.lowLiquidity;
  const byCategory = {};
  for (const it of items) (byCategory[it.category] ??= []).push(it);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold">방법론·데이터 정책</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          이 시스템은 시세 "조회 도구"가 아니라, 수집→탐지→해석→브리핑을 무인 자동화한 <b>분석 시스템</b>입니다.
          기준과 한계를 아래에 그대로 공개합니다.
        </p>
        <p className="mt-2 rounded px-3 py-2 text-xs" style={{ background: "#E9F0FA", color: "var(--accent)" }}>
          본 대시보드는 매일 자동으로 데이터가 추가되는 <b>운영 중 시스템</b>입니다.
          수집 시작일 2026-08-25, 하루 6회(KST 03·07·11·15·19·23시) 자동 수집, 심야 자동 분석·브리핑 발행.
        </p>
      </div>

      {/* 수집 구조 다이어그램 */}
      <section className="card p-4">
        <h2 className="text-sm font-bold">수집·분석 구조</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          Neople 오픈 API는 시세 히스토리를 제공하지 않습니다. GitHub Actions cron이 하루 6회(KST 03·07·11·15·19·23시)
          스냅샷을 수집해 저장소에 시계열을 직접 축적합니다. 심야 슬롯에서 탐지·해석·브리핑을 통합 실행합니다.
          수집 시작(2026-08-25) 이전 구간은 판매완료 내역 API(최근 100건)를 소급해 <b>실거래만 일 단위로 백필</b>했으며
          — 등록가·매물수는 소급이 불가능해 백필하지 않았습니다 — 차트에서 백필 구간임을 구분 표기합니다.
        </p>
        <div className="mx-auto mt-3 max-w-sm space-y-1">
          <Box>Neople 오픈 API (경매장 등록가·판매 완료)</Box>
          <Arrow />
          <Box>GitHub Actions cron — 하루 6회 스냅샷 (31품목, 호출 62회/회)</Box>
          <Arrow />
          <Box>시계열 병합 (data/timeseries.json, 슬롯 중복 방지)</Box>
          <Arrow />
          <Box>규칙 기반 이상 탐지 → 이상 항목만 AI 해석 (±3일 공지 교차)</Box>
          <Arrow />
          <Box accent>데일리 브리핑 자동 발행 → 이 대시보드</Box>
        </div>
      </section>

      {/* 이상 탐지 기준 공개 */}
      <section className="card p-4">
        <h2 className="text-sm font-bold">이상 탐지 기준 (전체 공개)</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs" style={{ color: "var(--text-primary)" }}>
            <thead>
              <tr className="text-left" style={{ color: "var(--text-secondary)" }}>
                <th className="py-1 pr-3">규칙</th><th className="py-1 pr-3">지표</th>
                <th className="py-1 pr-3">낮음</th><th className="py-1 pr-3">중간</th><th className="py-1 pr-3">높음</th>
              </tr>
            </thead>
            <tbody className="num">
              <tr><td className="py-1 pr-3">전일 대비</td><td className="pr-3">평균 등록가</td><td>±{dod.avgPrice.low}%</td><td>±{dod.avgPrice.mid}%</td><td>±{dod.avgPrice.high}%</td></tr>
              <tr><td className="py-1 pr-3">전일 대비</td><td className="pr-3">매물 수</td><td>±{dod.listingCount.low}%</td><td>±{dod.listingCount.mid}%</td><td>±{dod.listingCount.high}%</td></tr>
              <tr><td className="py-1 pr-3">{ma.windowDays}일 이동평균 이탈*</td><td className="pr-3">평균 등록가</td><td>—</td><td>±{ma.avgPrice.mid}%</td><td>±{ma.avgPrice.high}%</td></tr>
              <tr><td className="py-1 pr-3">{ma.windowDays}일 이동평균 이탈*</td><td className="pr-3">매물 수</td><td>—</td><td>±{ma.listingCount.mid}%</td><td>±{ma.listingCount.high}%</td></tr>
            </tbody>
          </table>
        </div>
        <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          <li>* 이동평균 규칙은 품목별 데이터가 {ma.minDaysRequired}일 이상 축적된 구간에서만 자동 적용됩니다 (그 전에는 전일 대비만).</li>
          <li>· 저유동 보정: 매물 {ll.listingCountBelow}건 미만 품목은 당일 연속 {ll.minConsecutiveSlots}슬롯 지속 변동일 때만 "중간" 이상으로 분류하고, 화면에 <b>저유동</b> 뱃지로 해석 주의를 안내합니다.</li>
          <li>· 매물 {thresholds.guards.minListingCountForPriceSignal}건 미만이 이틀 연속이면 가격 신호 자체를 채택하지 않습니다. 이상 항목은 하루 최대 {thresholds.guards.maxAnomaliesPerDay}건.</li>
        </ul>
      </section>

      {/* AI 해석 정책 */}
      <section className="card p-4">
        <h2 className="text-sm font-bold">AI 해석·정직성 정책</h2>
        <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          <li>· LLM 호출은 <b>이상 탐지된 항목에만</b> 수행합니다 (전 품목 호출 금지, 이상 0건인 날은 무비용 규칙 기반 브리핑).</li>
          <li>· 가설은 수동 큐레이션한 공식 공지·이벤트(±3일)만 근거로 하며, 근거 URL과 신뢰도(확정/추정)를 반드시 병기합니다.</li>
          <li>· 근거가 없으면 "원인 미상, 관찰 지속"으로 남깁니다. 시점 일치를 인과로 단정하지 않습니다.</li>
          <li>· 수집 실패 슬롯은 차트에 공백으로 그대로 표기합니다. 데이터를 지어내지 않습니다.</li>
          <li>· 비용 실측: 해석(claude-haiku-4-5) 건당 약 $0.001, 브리핑(claude-opus-5) 회당 약 $0.013 — 일 상한 $0.3 초과 시 실행 중단.</li>
        </ul>
      </section>

      {/* 품목 선정 근거 */}
      <section className="card p-4">
        <h2 className="text-sm font-bold">추적 품목 선정 근거 ({items.length}종)</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          전 품목이 아니라 시장 대표성이 있는 품목을 카테고리별로 선정하고 근거를 문서화했습니다.
          API 호출 절제(품목 수 상한·호출 간 대기·하루 3회)도 설계 원칙입니다.
        </p>
        <div className="mt-3 space-y-3">
          {Object.entries(byCategory).map(([cat, list]) => (
            <div key={cat}>
              <h3 className="text-xs font-bold" style={{ color: "var(--accent)" }}>{cat} ({list.length})</h3>
              <ul className="mt-1 space-y-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                {list.map((it) => (
                  <li key={it.itemId}>
                    <Link to={`/item/${it.itemId}`} className="font-medium">{it.name}</Link> — {it.reason}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 출처·한계 */}
      <section className="card p-4">
        <h2 className="text-sm font-bold">데이터 출처·한계 고지</h2>
        <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
          <li>· 시세 데이터: <a href="https://developers.neople.co.kr" target="_blank" rel="noreferrer">Neople 오픈 API</a> (경매장 등록·판매 완료). 원본 응답을 저장하지 않고 집계 수치만 축적합니다.</li>
          <li>· 매물 수는 API 조회 상한(400건) 내 집계, 실거래는 최근 100건 상한 내 24시간 집계입니다 — 실제보다 적게 잡힐 수 있습니다.</li>
          <li>· 이벤트·패치 정보는 던전앤파이터 공식 공지에서 수동 큐레이션합니다 (자동 수집 미사용).</li>
          <li>· 본 사이트는 <b>비공식 팬메이드 포트폴리오</b>이며 ㈜네오플·넥슨과 무관합니다. 게임 아트워크·로고를 사용하지 않습니다.</li>
        </ul>
      </section>
    </div>
  );
}
