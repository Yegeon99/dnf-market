// 화면 4 — 방법론·데이터 정책: 인터랙티브 파이프라인 다이어그램, 이상 탐지 기준 공개, 품목 선정 근거, 출처 고지
import { useState } from "react";
import { Link } from "react-router-dom";
import HeatLegend from "../components/HeatLegend";
import { collectionStats, slotLabel } from "../lib/data";

const PIPE_NODES = [
  { y: 10, h: 46, lines: ["Neople 오픈 API", "경매장 등록가 · 판매 완료"], kind: "src",
    desc: "공식 오픈 API에서 경매장 등록가와 판매 완료 내역을 받아옵니다. 원본 응답은 저장하지 않고 집계 수치만 씁니다." },
  { y: 106, h: 46, lines: ["하루 최대 6회 스냅샷 수집", "KST 02·07·11·15·19·23시, 31품목"], kind: "auto",
    desc: "GitHub Actions 예약 실행이 하루 6회 예약돼 있습니다. 예약 실행이 30~110분 밀리거나 게임 점검과 겹치면 그 회차는 빕니다. 실제 성공 회차는 히어로와 상태 바에 실측값으로 표시합니다. 호출 간 0.3초 대기, 재시도는 2회까지(30초·120초 간격)로 제한합니다." },
  { y: 170, h: 32, lines: ["시계열 병합 (회차 중복 방지)"], kind: "auto",
    desc: "스냅샷을 시계열 파일에 합칩니다. 같은 날짜와 회차가 두 번 실행돼도 중복 기록되지 않습니다." },
  { y: 220, h: 32, lines: ["규칙 기반 이상 탐지"], kind: "auto",
    desc: "전일 대비와 7일 이동평균 이탈 규칙으로 이상 변동을 찾습니다. 임계치는 아래 표에 전부 공개되어 있습니다." },
  { y: 270, h: 46, lines: ["AI 원인 해석 (이상 항목만)", "±3일 공식 공지 교차 · 근거 URL 병기"], kind: "auto",
    desc: "이상으로 판정된 항목만 AI가 해석합니다. 근거가 없으면 원인 미상으로 남기고, 시점 일치를 인과로 단정하지 않습니다." },
  { y: 334, h: 32, lines: ["데일리 브리핑 자동 발행"], kind: "auto",
    desc: "매일 심야 회차(KST 02:17)에서 헤드라인과 3줄 요약을 발행합니다. 이상 0건인 날은 무비용 규칙 기반 브리핑입니다." },
  { y: 420, h: 46, lines: ["자동 커밋 · Vercel 재배포", "이 대시보드가 스스로 갱신"], kind: "out",
    desc: "Actions 봇이 데이터만 커밋하면 Vercel이 자동 재배포합니다. 사람 손이 닿는 단계가 없습니다." },
];

/** 수집 파이프라인 다이어그램: 단계 호버 시 설명, 데이터 흐름 점선 애니메이션 */
function PipelineDiagram() {
  const [active, setActive] = useState(null);
  const cx = 210;
  const fill = (k) => (k === "out" ? "var(--accent)" : "var(--bg-surface)");
  const stroke = (k, on) => (on ? "var(--accent-deep)" : k === "out" ? "var(--accent)" : k === "src" ? "var(--hairline-strong)" : "var(--accent)");
  const textFill = (k) => (k === "out" ? "#FFFFFF" : "var(--text-primary)");
  const subFill = (k) => (k === "out" ? "rgba(255,255,255,0.85)" : "var(--text-muted)");
  const shown = active != null ? PIPE_NODES[active] : null;

  return (
    <div>
      <svg viewBox="0 0 420 476" className="mx-auto block w-full max-w-[470px]" role="img"
           aria-label="수집 파이프라인 다이어그램: Neople API에서 수집, 병합, 탐지, 해석, 브리핑, 배포까지 자동으로 이어진다. 각 단계에 마우스를 올리면 설명이 보인다">
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

        {/* 데이터 흐름: 애니메이션 점선 화살표 */}
        {PIPE_NODES.slice(0, -1).map((n, i) => {
          const next = PIPE_NODES[i + 1];
          return (
            <line key={i} x1={cx} y1={n.y + n.h} x2={cx} y2={next.y - 3}
                  className="flow-dash" strokeDasharray="4 3.5"
                  stroke="var(--hairline-strong)" strokeWidth="1.5" markerEnd="url(#arrow)" />
          );
        })}

        {/* 노드: 호버·포커스 시 아래 설명 카드 */}
        {PIPE_NODES.map((n, i) => {
          const on = active === i;
          return (
            <g key={i} tabIndex={0} role="button" aria-label={`${n.lines[0]} 단계 설명 보기`}
               onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
               onFocus={() => setActive(i)} onBlur={() => setActive(null)}
               style={{ cursor: "help", outline: "none" }}>
              <rect x={cx - 170} y={n.y} width="340" height={n.h} rx="5"
                    fill={fill(n.kind)} stroke={stroke(n.kind, on)} strokeWidth={on ? 1.8 : n.kind === "src" ? 1 : 1.2} />
              <text x={cx} y={n.y + (n.lines.length > 1 ? 19 : n.h / 2 + 5)} textAnchor="middle"
                    fontSize="13.5" fontWeight="600" fill={textFill(n.kind)}>{n.lines[0]}</text>
              {n.lines[1] && (
                <text x={cx} y={n.y + 36} textAnchor="middle" fontSize="13" fill={subFill(n.kind)}>{n.lines[1]}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mx-auto mt-2 max-w-[470px] rounded px-3 py-2 text-[13px]"
           style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)", minHeight: 58 }}
           aria-live="polite">
        {shown ? (
          <>
            <b style={{ color: "var(--text-primary)" }}>{shown.lines[0]}</b>
            <span className="ml-1.5">{shown.desc}</span>
          </>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>각 단계에 마우스를 올리거나 키보드로 이동하면 설명이 여기에 보입니다.</span>
        )}
      </div>
    </div>
  );
}

export default function Methodology({ data }) {
  const { items, thresholds, collection, rows, llmCosts } = data;
  // 비용은 표기하지 않고 원장에서 실측값을 읽는다. 손으로 적은 숫자는 금방 낡는다.
  const costDays = Object.values(llmCosts ?? {});
  const brief = costDays.map((d) => d?.byCaller?.briefing?.costUsd).filter((v) => v != null);
  const briefAvg = brief.length ? brief.reduce((a, b) => a + b, 0) / brief.length : null;
  const interpretCalls = costDays.reduce((a, d) => a + (d?.byCaller?.interpret?.calls ?? 0), 0);
  const stat = collectionStats(rows ?? []);
  // 실패 회차 원칙에 붙일 실제 사례. 하드코딩하지 않고 수집 기록에서 최근 실패를 집어 온다
  const lastFail = [...(collection?.attempts ?? [])].reverse().find((a) => a.okCount === 0) ?? null;
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
          수집 시작일은 2026-08-25이며, 하루 최대 6회(KST 02·07·11·15·19·23시) 자동 수집하고 심야 회차에 분석과 브리핑을 자동 발행합니다.
          예약 실행 지연과 게임 점검 때문에 회차가 빌 수 있어, 지금까지 <b className="num">{stat.days}일간 {stat.slots}회</b>를 실제로 수집했습니다(예약 기준 {stat.expected}회).
        </p>
      </div>

      {/* 수집 구조 다이어그램 */}
      <section className="card p-4">
        <h2 className="t-section m-0">수집·분석 구조</h2>
        <p className="m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)", maxWidth: 680, lineHeight: 1.7 }}>
          Neople 오픈 API는 시세 히스토리를 제공하지 않습니다.
          그래서 GitHub Actions 예약 실행이 하루 최대 6회 스냅샷을 수집해 저장소에 시계열을 직접 쌓습니다.
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
          <li>· 매물 {thresholds.guards.minListingCountForPriceSignal}건 미만이 이틀 연속이면 가격 신호 자체를 채택하지 않습니다.</li>
          <li>· 이상 항목은 하루 최대 {thresholds.guards.maxAnomaliesPerDay}건까지만 목록에 싣습니다. 상한에 걸린 날은 브리핑 화면에 <b>실제 탐지 건수</b>를 함께 표시해, 목록에 실린 수를 그날의 전부로 읽지 않게 합니다.</li>
          <li>· 등록 대표가는 매물 단가의 <b>중앙값</b>입니다. 경매장에는 시세와 동떨어진 가격의 매물이 상시 섞여 있어, 매물이 몇 건뿐인 품목은 평균이 그 한 건에 끌려갑니다(실측: 매물 2건 품목의 평균가가 실거래가의 10배). 2026-08-30 이전에 수집한 회차는 중앙값 기록이 없어 평균을 그대로 씁니다.</li>
          <li>· 전일 대비는 <b>두 날에 모두 수집된 회차</b>로만 비교합니다. 회차 구성이 다른 날을 그대로 비교하면 시간대 차이가 변동률로 둔갑합니다.</li>
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
          <li>· 가설은 수동 큐레이션한 공식 공지·이벤트(±3일)만 근거로 삼고, 근거 URL과 신뢰도(확정/추정)를 반드시 함께 적습니다. 개별 공지 주소가 없는 이벤트는 독자가 확인할 수 없으므로 근거 후보에서 제외합니다.</li>
          <li>· 근거가 없으면 "원인 미상, 관찰 지속"으로 남깁니다. 시점이 겹친다는 이유만으로 인과를 단정하지 않습니다.</li>
          <li>
            · 수집 실패 회차는 시계열에 넣지 않고 차트에 공백으로 그대로 표기합니다. 데이터를 지어내지 않습니다.
            {lastFail && (
              <span className="mt-0.5 block" style={{ color: "var(--text-muted)" }}>
                실제 사례: <span className="num">{lastFail.date} {slotLabel(lastFail.slot)}</span> 회차는 오픈 API가
                전 품목 오류를 반환해 {lastFail.itemCount}종 모두 수집에 실패했습니다.
                해당 회차는 시계열에 병합하지 않았고, 오버뷰 상태 바에 실패로 표시됩니다.
                다음 회차부터 자동으로 다시 수집합니다.
              </span>
            )}
          </li>
          <li>
            · 비용은 호출 원장에서 그대로 읽습니다.
            {briefAvg != null
              ? <> 브리핑(claude-opus-5) 실측 평균은 회당 <b className="num">${briefAvg.toFixed(4)}</b>입니다({brief.length}회 기준).</>
              : <> 아직 브리핑 호출 기록이 없습니다.</>}
            {interpretCalls === 0
              ? " 해석(claude-haiku-4-5)은 지금까지 호출된 적이 없습니다. 근거로 쓸 공지가 ±3일 안에 없으면 호출하지 않고 원인 미상으로 남기기 때문입니다."
              : ` 해석(claude-haiku-4-5)은 누적 ${interpretCalls}건 호출했습니다.`}
            {" 하루 상한 $0.3을 넘으면 실행을 중단합니다."}
          </li>
        </ul>
      </section>

      {/* 지표 정의 변경 이력 */}
      <section className="card p-4">
        <h2 className="t-section m-0">지표 정의 변경 이력</h2>
        <p className="m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)", maxWidth: 680, lineHeight: 1.7 }}>
          수치를 계산하는 방식이 바뀐 적이 있습니다. 언제 무엇을 왜 바꿨는지 여기에 남깁니다.
          <b> 2026-08-31 발행분부터</b> 아래 방식이 적용됐고, 그 이전 브리핑은 발행 당시 방식으로 쓰였습니다.
        </p>
        <div className="scroll-x mt-2.5">
          <table className="plain" style={{ minWidth: 460 }}>
            <thead>
              <tr><th style={{ width: "17%" }}>적용</th><th style={{ width: "30%" }}>바뀐 것</th><th>바꾼 이유</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="num">2026-08-31</td>
                <td>등록 대표가를 매물 단가의 평균에서 <b>중앙값</b>으로</td>
                <td>경매장에는 시세와 동떨어진 가격의 매물이 상시 섞여 있습니다.
                    매물이 몇 건뿐인 품목은 그 한 건이 평균을 통째로 끌고 갑니다.
                    실측으로 매물 2건짜리 품목의 평균가가 실거래가의 10배였습니다.</td>
              </tr>
              <tr>
                <td className="num">2026-08-31</td>
                <td>회차 라벨을 <b>수집 시각 기준으로 다시 매김</b></td>
                <td>하루 수집을 3회에서 6회로 늘리면서 옛 라벨과 새 라벨이 섞였습니다.
                    같은 시간대끼리 비교되도록 저장된 수집 시각으로 라벨을 다시 계산합니다.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="m-0 mt-2.5 list-none space-y-1 p-0 text-[13px]" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
          <li>· <b>과거 발행분은 고치지 않습니다.</b> 그날 발행된 글을 나중에 손보면 아카이브가 기록이 아니게 됩니다.
              대신 해당 브리핑에 발행 당시 기준이라는 고지를 붙입니다.</li>
          <li>· 그래서 정의 변경 이전 브리핑의 일부 수치는 지금 데이터로 다시 계산해도 그대로 나오지 않습니다.
              자동 감사도 이 구간을 실패로 세지 않고 별도 목록으로 표시합니다.</li>
          <li>· 차트에서도 2026-08-30 이전에 수집한 회차는 중앙값 기록이 없어 평균값을 그대로 씁니다.</li>
        </ul>
      </section>

      {/* 품목 선정 근거 */}
      <section className="card p-4">
        <h2 className="t-section m-0">추적 품목 선정 근거 ({items.length}종)</h2>
        <p className="m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-secondary)", maxWidth: 680, lineHeight: 1.7 }}>
          전 품목이 아니라 시장 대표성이 있는 품목을 카테고리별로 골라 근거를 문서화했습니다.
          분류와 선정 사유는 Neople 오픈 API가 주는 <b>공식 아이템 설명</b>에 적힌 사용처를 기준으로 적었고,
          설명에 사용처가 없는 품목은 용도를 단정하지 않았습니다.
          API 호출 절제(품목 수 상한, 호출 간 대기, 하루 최대 6회)도 설계 원칙입니다.
        </p>
        <p className="m-0 mt-2 rounded px-3 py-2 text-[13px]"
           style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)", lineHeight: 1.7, maxWidth: 680 }}>
          <b>이름이 같은 별개 아이템 안내.</b> 클론 아바타 일부는 게임 안 이름이 완전히 같은데
          거래소에서는 서로 다른 아이템으로 취급됩니다. 공개 API가 주는 이름·등급·분류·설명·세트가
          모두 같아 무엇이 다른지 구분할 근거가 없습니다. 그래서 이 화면은 <b>(동일명 1)</b>,
          <b> (동일명 2)</b>처럼 등록 순서로 번호만 붙였습니다.
          게임에 없는 "1세대·2세대" 같은 표현은 쓰지 않습니다.
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
          <li>· 본 사이트는 <b>비공식 팬메이드 포트폴리오</b>이며 ㈜네오플·넥슨과 무관합니다. 게임 그래픽은 Neople 오픈 API가 제공하는 아이템 아이콘만 사용합니다.</li>
        </ul>
      </section>
    </div>
  );
}
