// 화면 4 — 방법론·데이터 정책: 수집 구조 다이어그램, 이상 탐지 기준 공개, 품목 선정 근거, 출처 고지
import { Link } from "react-router-dom";
import HeatLegend from "../components/HeatLegend";

/** 수집 파이프라인 다이어그램: GitHub Actions 무인 자동 체인을 강조한 SVG */
function PipelineDiagram() {
  const nodes = [
    { y: 10, h: 46, lines: ["Neople 오픈 API", "경매장 등록가 · 판매 완료"], kind: "src" },
    { y: 106, h: 46, lines: ["하루 6회 스냅샷 수집", "KST 03·07·11·15·19·23시, 31품목"], kind: "auto" },
    { y: 170, h: 32, lines: ["시계열 병합 (회차 중복 방지)"], kind: "auto" },
    { y: 220, h: 32, lines: ["규칙 기반 이상 탐지"], kind: "auto" },
    { y: 270, h: 46, lines: ["AI 원인 해석 (이상 항목만)", "±3일 공식 공지 교차 · 근거 URL 병기"], kind: "auto" },
    { y: 334, h: 32, lines: ["데일리 브리핑 자동 발행"], kind: "auto" },
    { y: 420, h: 46, lines: ["자동 커밋 · Vercel 재배포", "이 대시보드가 스스로 갱신"], kind: "out" },
  ];
  const cx = 210;
  const fill = (k) => (k === "out" ? "var(--accent)" : "var(--bg-surface)");
  const stroke = (k) => (k === "out" ? "var(--accent)" : k === "src" ? "var(--hairline-strong)" : "var(--accent)");
  const textFill = (k) => (k === "out" ? "#FFFFFF" : "var(--text-primary)");
  const subFill = (k) => (k === "out" ? "rgba(255,255,255,0.85)" : "var(--text-muted)");

  return (
    <svg viewBox="0 0 420 476" className="mx-auto block w-full max-w-[470px]" role="img"
         aria-label="수집 파이프라인 다이어그램: Neople API에서 수집, 병합, 탐지, 해석, 브리핑, 배포까지 자동으로 이어진다">
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0.5 7 4 0 7.5z" fill="var(--hairline-strong)" />
        </marker>
      </defs>

      {/* GitHub Actions 무인 자동 체인 강조 박스 (수집~발행) */}
      <rect x="14" y="74" width="392" height="304" rx="8" fill="var(--gold-soft)" fillOpacity="0.45"
            stroke="var(--gold)" strokeWidth="1.1" strokeDasharray="5 4" />
      <text x="26" y="94" fontSize="13" fontWeight="700" letterSpacing="0.06em" fill="var(--gold-text)">
        GITHUB ACTIONS 무인 자동 체인
      </text>

      {/* 화살표 */}
      {nodes.slice(0, -1).map((n, i) => {
        const next = nodes[i + 1];
        return (
          <line key={i} x1={cx} y1={n.y + n.h} x2={cx} y2={next.y - 3}
                stroke="var(--hairline-strong)" strokeWidth="1.4" markerEnd="url(#arrow)" />
        );
      })}

      {/* 노드 */}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={cx - 170} y={n.y} width="340" height={n.h} rx="5"
                fill={fill(n.kind)} stroke={stroke(n.kind)} strokeWidth={n.kind === "src" ? 1 : 1.2} />
          <text x={cx} y={n.y + (n.lines.length > 1 ? 19 : n.h / 2 + 5)} textAnchor="middle"
                fontSize="13.5" fontWeight="600" fill={textFill(n.kind)}>{n.lines[0]}</text>
          {n.lines[1] && (
            <text x={cx} y={n.y + 36} textAnchor="middle" fontSize="13" fill={subFill(n.kind)}>{n.lines[1]}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function Methodology({ data }) {
  const { items, thresholds } = data;
  const dod = thresholds.dayOverDay;
  const ma = thresholds.movingAverage;
  const ll = thresholds.lowLiquidity;
  const byCategory = {};
  for (const it of items) (byCategory[it.category] ??= []).push(it);

  return (
    <div className="space-y-4">
      <div className="rise">
        <h1 className="t-title m-0">방법론·데이터 정책</h1>
        <p className="t-lead m-0 mt-1.5" style={{ maxWidth: 680 }}>
          이 시스템은 시세 조회 도구가 아닙니다.
          수집, 탐지, 해석, 브리핑을 사람 손 없이 이어 붙인 <b>분석 시스템</b>입니다.
          판단 기준과 한계를 아래에 그대로 공개합니다.
        </p>
        <p className="m-0 mt-2 rounded px-3 py-2 text-[13px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          본 대시보드는 매일 자동으로 데이터가 쌓이는 <b>운영 중 시스템</b>입니다.
          수집 시작일은 2026-08-25이며, 하루 6회(KST 03·07·11·15·19·23시) 자동 수집하고 심야에 분석과 브리핑을 자동 발행합니다.
        </p>
      </div>

      {/* 수집 구조 다이어그램 */}
      <section className="card p-4">
        <h2 className="t-section m-0">수집·분석 구조</h2>
        <p className="m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)", maxWidth: 680, lineHeight: 1.7 }}>
          Neople 오픈 API는 시세 히스토리를 제공하지 않습니다.
          그래서 GitHub Actions 예약 실행이 하루 6회 스냅샷을 수집해 저장소에 시계열을 직접 쌓습니다.
          심야 회차에서 탐지, 해석, 브리핑까지 한 번에 실행합니다.
        </p>
        <p className="m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)", maxWidth: 680, lineHeight: 1.7 }}>
          수집 시작일(2026-08-25) 이전 구간은 판매완료 내역 API(최근 100건)를 거슬러 올라가
          <b> 과거 실거래만 일 단위로 소급 수집</b>했습니다.
          등록가와 매물 수는 과거 조회가 불가능해 소급하지 않았고, 차트에서 소급 구간을 점선으로 구분해 표기합니다.
        </p>
        <div className="mt-3">
          <PipelineDiagram />
        </div>
      </section>

      {/* 이상 탐지 기준 공개 */}
      <section className="card p-4">
        <h2 className="t-section m-0">이상 탐지 기준 (전체 공개)</h2>
        <div className="scroll-x mt-2.5">
          <table className="plain" style={{ minWidth: 430 }}>
            <thead>
              <tr>
                <th>규칙</th><th>지표</th>
                <th className="r">낮음</th><th className="r">중간</th><th className="r">높음</th>
              </tr>
            </thead>
            <tbody className="num">
              <tr><td>전일 대비</td><td>평균 등록가</td><td className="r">±{dod.avgPrice.low}%</td><td className="r">±{dod.avgPrice.mid}%</td><td className="r">±{dod.avgPrice.high}%</td></tr>
              <tr><td>전일 대비</td><td>매물 수</td><td className="r">±{dod.listingCount.low}%</td><td className="r">±{dod.listingCount.mid}%</td><td className="r">±{dod.listingCount.high}%</td></tr>
              <tr><td>{ma.windowDays}일 이동평균 이탈*</td><td>평균 등록가</td><td className="r">없음</td><td className="r">±{ma.avgPrice.mid}%</td><td className="r">±{ma.avgPrice.high}%</td></tr>
              <tr><td>{ma.windowDays}일 이동평균 이탈*</td><td>매물 수</td><td className="r">없음</td><td className="r">±{ma.listingCount.mid}%</td><td className="r">±{ma.listingCount.high}%</td></tr>
            </tbody>
          </table>
        </div>
        <ul className="m-0 mt-2.5 list-none space-y-1 p-0 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          <li>* 이동평균 규칙은 품목별 데이터가 {ma.minDaysRequired}일 이상 쌓인 구간에서만 자동 적용됩니다. 그 전에는 전일 대비만 봅니다.</li>
          <li>· 저유동 보정: 매물 {ll.listingCountBelow}건 미만 품목은 당일 연속 {ll.minConsecutiveSlots}회차 지속 변동일 때만 "중간" 이상으로 분류하고, 화면에 <b>저유동</b> 뱃지로 해석 주의를 안내합니다.</li>
          <li>· 매물 {thresholds.guards.minListingCountForPriceSignal}건 미만이 이틀 연속이면 가격 신호 자체를 채택하지 않습니다. 이상 항목은 하루 최대 {thresholds.guards.maxAnomaliesPerDay}건입니다.</li>
        </ul>
        <div className="mt-3">
          <div className="mb-1 text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>오버뷰 히트맵 색상 스케일 (전일 대비, 보합 ±0.5% 미만)</div>
          <HeatLegend width={360} />
        </div>
      </section>

      {/* AI 해석 정책 */}
      <section className="card p-4">
        <h2 className="t-section m-0">AI 해석·정직성 정책</h2>
        <ul className="m-0 mt-2.5 list-none space-y-1.5 p-0 text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          <li>· LLM 호출은 <b>이상 탐지된 항목에만</b> 수행합니다. 전 품목 호출은 하지 않으며, 이상 0건인 날은 무비용 규칙 기반 브리핑을 냅니다.</li>
          <li>· 가설은 수동 큐레이션한 공식 공지·이벤트(±3일)만 근거로 삼고, 근거 URL과 신뢰도(확정/추정)를 반드시 함께 적습니다.</li>
          <li>· 근거가 없으면 "원인 미상, 관찰 지속"으로 남깁니다. 시점이 겹친다는 이유만으로 인과를 단정하지 않습니다.</li>
          <li>· 수집 실패 회차는 차트에 공백으로 그대로 표기합니다. 데이터를 지어내지 않습니다.</li>
          <li>· 비용 실측: 해석(claude-haiku-4-5)은 건당 약 $0.001, 브리핑(claude-opus-5)은 회당 약 $0.013입니다. 하루 상한 $0.3을 넘으면 실행을 중단합니다.</li>
        </ul>
      </section>

      {/* 품목 선정 근거 */}
      <section className="card p-4">
        <h2 className="t-section m-0">추적 품목 선정 근거 ({items.length}종)</h2>
        <p className="m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)", maxWidth: 680, lineHeight: 1.7 }}>
          전 품목이 아니라 시장 대표성이 있는 품목을 카테고리별로 골라 근거를 문서화했습니다.
          API 호출 절제(품목 수 상한, 호출 간 대기, 하루 6회)도 설계 원칙입니다.
        </p>
        <div className="scroll-x mt-3">
          <table className="plain" style={{ minWidth: 480 }}>
            <thead>
              <tr><th style={{ width: "34%" }}>품목</th><th>선정 사유</th></tr>
            </thead>
            {Object.entries(byCategory).map(([cat, list]) => (
              <tbody key={cat}>
                <tr>
                  <td colSpan={2} className="pt-3" style={{ borderBottom: "1px solid var(--hairline-strong)" }}>
                    <span className="text-[13px] font-bold" style={{ color: "var(--accent)" }}>{cat}</span>
                    <span className="num ml-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>{list.length}종</span>
                  </td>
                </tr>
                {list.map((it) => (
                  <tr key={it.itemId}>
                    <td><Link to={`/item/${it.itemId}`} className="font-medium">{it.name}</Link></td>
                    <td>{it.reason}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      {/* 출처·한계 */}
      <section className="card p-4">
        <h2 className="t-section m-0">데이터 출처·한계 고지</h2>
        <ul className="m-0 mt-2.5 list-none space-y-1.5 p-0 text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          <li>· 시세 데이터: <a href="https://developers.neople.co.kr" target="_blank" rel="noreferrer">Neople 오픈 API</a> (경매장 등록·판매 완료). 원본 응답을 저장하지 않고 집계 수치만 쌓습니다.</li>
          <li>· 매물 수는 API 조회 상한(400건) 안에서, 실거래는 최근 100건 상한 안에서 24시간 집계합니다. 실제보다 적게 잡힐 수 있습니다.</li>
          <li>· 이벤트·패치 정보는 던전앤파이터 공식 공지에서 수동 큐레이션합니다. 자동 수집은 쓰지 않습니다.</li>
          <li>· 본 사이트는 <b>비공식 팬메이드 포트폴리오</b>이며 ㈜네오플·넥슨과 무관합니다. 게임 아트워크와 로고를 사용하지 않습니다.</li>
        </ul>
      </section>
    </div>
  );
}
