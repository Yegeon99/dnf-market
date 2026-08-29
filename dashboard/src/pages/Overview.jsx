// 화면 1 — 마켓 오버뷰: "오늘 무슨 일이 있었나"에 3초 안에 답하는 구성.
// 마스트헤드 → 상태 바 → 브리핑 → 등락 순위 → 핵심 지표 → 히트맵.
// 섹션 라벨과 제목은 항상 카드 바깥, 짝수 섹션은 풀폭 밴드로 리듬을 만든다.
import { useState } from "react";
import { m, useReducedMotion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import {
  dailySeries, dodChanges, publishChanges, latestDate, lastCollectedLabel, fmtGold,
  fmtPct, fmtSignedPct, heatColor, pctColor, isLowLiquidity,
} from "../lib/data";
import { Change, CountUpNum, Empty, Sparkline } from "../components/ui";
import Reveal from "../components/reveal";
import { highlight, itemNamePool } from "../components/rich";
import HeatLegend from "../components/HeatLegend";
import HeroBand from "../components/HeroBand";
import StatusStrip from "../components/StatusStrip";
import RankBoard from "../components/RankBoard";

function Section({ label, title, note, band, index = 0, children }) {
  return (
    <section className={`sec${band ? " sec-band" : ""}`}>
      <div className="sec-inner">
        <Reveal index={index}>
          <header className="sec-head">
            <span className="sec-label">{label}</span>
            <h2 className="sec-title">{title}</h2>
            {note && <p className="sec-note">{note}</p>}
          </header>
          {children}
        </Reveal>
      </div>
    </section>
  );
}

/** alert를 켜면 등장할 때 딱 한 번 바탕색이 옅게 켜졌다 꺼진다 (반복 없음) */
function KpiCell({ label, caption, spark, sparkColor, alert = false, children }) {
  const reduce = useReducedMotion();
  const flash = alert && !reduce;
  return (
    <m.div
      className="min-w-0"
      initial={flash ? { backgroundColor: "rgba(184, 79, 74, 0.18)" } : false}
      animate={flash ? { backgroundColor: "rgba(184, 79, 74, 0)" } : undefined}
      transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }}
    >
      <div className="text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="num text-[26px] font-bold leading-tight">{children}</div>
        {/* 좁은 화면에서는 스파크라인이 품목명을 밀어내므로 접는다 */}
        {spark && <span className="hidden sm:block"><Sparkline values={spark} color={sparkColor ?? "var(--accent)"} /></span>}
      </div>
      {caption && <div className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>{caption}</div>}
    </m.div>
  );
}

// 2컬럼 그룹 배치: 좌(강화·스킬/성장/레어 1세대), 우(증폭/마법부여/레어 2세대/일반)
// 클릭 가능한 카드에만 떠오르는 호버 반응을 준다 (단순 정보 카드에는 넣지 않는다)
const MotionLink = m.create(Link);

const LEFT_GROUPS = ["강화·스킬 재료", "성장 재료", "레어 클론 아바타 1세대"];

function Tile({ c, it, onEnter, onLeave, onClick }) {
  const noCompare = c.changePct == null;
  const { bg, fg } = heatColor(c.changePct);
  return (
    <button
      onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}
      className="heat-tile relative w-[132px] shrink-0 cursor-pointer px-2 py-1.5 text-left"
      style={{ background: bg, color: fg }}
      title={c.name}
    >
      <div className="truncate text-[14px] font-medium leading-snug">{it?.shortName ?? c.name}</div>
      <div className="num text-[13px] leading-snug">{fmtGold(c.avgPrice)}</div>
      <div className="min-h-[24px] num text-[16px] font-bold leading-snug">
        {noCompare ? "" : fmtSignedPct(c.changePct)}
      </div>
      {noCompare && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--text-muted)" }} title="전일 비교 대기" />
      )}
    </button>
  );
}

function Heatmap({ changes, items, llBelow }) {
  const navigate = useNavigate();
  const [tip, setTip] = useState(null); // {x, y, c}
  const byId = Object.fromEntries(items.map((it) => [it.itemId, it]));

  const groups = [];
  for (const c of changes) {
    const g = byId[c.itemId]?.displayGroup ?? c.category;
    const last = groups[groups.length - 1];
    if (last?.name === g) last.cells.push(c);
    else groups.push({ name: g, cells: [c] });
  }
  const left = groups.filter((g) => LEFT_GROUPS.includes(g.name));
  const right = groups.filter((g) => !LEFT_GROUPS.includes(g.name));

  const onEnter = (e, c) => {
    const wrap = e.currentTarget.closest("[data-heat]").getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top, c });
  };

  const renderGroups = (list) => (
    <div className="space-y-2.5">
      {list.map((g) => (
        <div key={g.name} className="rounded-[5px] border px-2 pb-2 pt-1.5"
             style={{ borderColor: "var(--hairline-faint)", background: "var(--bg-base)" }}>
          <div className="mb-1.5 flex items-baseline gap-1.5">
            <span className="text-[13px] font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>{g.name}</span>
            <span className="num text-[13px]" style={{ color: "var(--text-muted)" }}>{g.cells.length}종</span>
          </div>
          <div className="flex flex-wrap gap-[5px]">
            {g.cells.map((c) => (
              <Tile key={c.itemId} c={c} it={byId[c.itemId]}
                    onClick={() => navigate(`/item/${c.itemId}`)}
                    onEnter={(e) => onEnter(e, c)} onLeave={() => setTip(null)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative" data-heat>
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {renderGroups(left)}
        {renderGroups(right)}
      </div>

      {tip && (
        <div className="card pointer-events-none absolute z-10 px-3 py-2 text-[13px]"
             style={{ left: Math.max(0, Math.min(tip.x - 100, 1000)), top: Math.max(0, tip.y - 100), width: 216, boxShadow: "var(--card-shadow-lift)" }}>
          <div className="font-semibold">{tip.c.name}</div>
          <div className="mt-0.5 flex justify-between"><span style={{ color: "var(--text-secondary)" }}>등록 평균가</span><span className="num">{fmtGold(tip.c.avgPrice)} 골드</span></div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-secondary)" }}>전일 대비</span>
            {tip.c.changePct == null
              ? <span style={{ color: "var(--text-muted)" }}>비교 대기</span>
              : <span className="num font-semibold" style={{ color: pctColor(tip.c.changePct) }}>{fmtPct(tip.c.changePct)}</span>}
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-secondary)" }}>매물 수</span>
            <span className="num">{tip.c.listing != null ? `${tip.c.listing.toLocaleString()}건` : "미수집"}{isLowLiquidity(tip.c.listing, tip.c.listingPrev, llBelow) ? " (저유동)" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** 데일리 브리핑 카드: 품목명은 bold, 등락색은 헤드라인(첫 문장)에만.
 *  우측 미니 차트도 본문과 같은 "발행 시점" 기준을 쓴다 (최신 수집 기준은 아래 순위 보드 담당) */
function BriefingHero({ briefing, items, topUp, trend }) {
  const names = itemNamePool(items);
  return (
    <MotionLink
      to="/briefings"
      className="card block px-4 py-3.5 no-underline"
      whileHover={{ y: -3, boxShadow: "0 8px 22px rgba(27, 33, 48, 0.14)" }}
      whileTap={{ y: -1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ color: "inherit", boxShadow: "0 0 0 rgba(27, 33, 48, 0)" }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        <span className="num whitespace-nowrap">{briefing.date}</span>
        <span>{briefing.collectionFailed ? "심야 회차 수집 실패, 전일 데이터 기준" : "심야 회차 발행 시점까지의 수집분 기준"}</span>
        <span className="ml-auto whitespace-nowrap" style={{ color: "var(--accent)" }}>아카이브 →</span>
      </div>
      <div className={`mt-1.5 grid gap-x-6 gap-y-3 ${topUp && trend ? "sm:grid-cols-[minmax(0,1fr)_212px]" : ""}`}>
        <div className="min-w-0">
          <h3 className="t-section headline-nums m-0" style={{ fontSize: 25, lineHeight: 1.4 }}>
            {highlight(briefing.headline)}
          </h3>
          <ul className="m-0 mt-2.5 list-none space-y-1.5 p-0 text-sm" style={{ color: "var(--text-secondary)" }}>
            {briefing.summary_3lines.map((l, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--hairline-strong)" }} aria-hidden="true" />
                <span>{highlight(l, names, { colorNums: false })}</span>
              </li>
            ))}
          </ul>
        </div>
        {topUp && trend && (
          <div className="rounded px-3 py-2.5" style={{ background: "var(--bg-sunken)" }}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-secondary)" }}>발행 시점 상승 1위 · 최근 7일 추이</div>
            <div className="mt-0.5 truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>{topUp.name}</div>
            <div className="num mt-0.5 text-[18px] font-bold" style={{ color: "var(--up)" }}>{fmtSignedPct(topUp.changePct)}</div>
            <div className="mt-1.5">
              <Sparkline values={trend} width={180} height={52} color="var(--up)" strokeWidth={2} area />
            </div>
          </div>
        )}
      </div>
    </MotionLink>
  );
}

export default function Overview({ data }) {
  const { rows, anomalies, briefings, items, thresholds, backfill, collection } = data;
  const date = latestDate(rows);
  const changes = dodChanges(rows, items, date);
  const todayAnomalies = anomalies.filter((a) => a.date === date);
  const withChange = changes.filter((c) => c.changePct != null);
  const ups = [...withChange].sort((a, b) => b.changePct - a.changePct).filter((c) => c.changePct > 0);
  const downs = [...withChange].sort((a, b) => a.changePct - b.changePct).filter((c) => c.changePct < 0);
  const latestBriefing = briefings[0];
  const llBelow = thresholds?.lowLiquidity?.listingCountBelow ?? 0;
  const hasCompare = withChange.length > 0;

  const byId = Object.fromEntries(items.map((it) => [it.itemId, it]));
  const itemSpark = (id) => dailySeries(rows, id).slice(-7).map((d) => d.avgPrice);
  const collectedLabel = lastCollectedLabel(rows);

  // 순위 보드 안내문: 브리핑이 어느 날짜를 인용했는지와 순위 보드 기준일을 직접 비교한다.
  // 심야 회차가 실패한 날은 브리핑이 전일을 인용하는데, 이후 회차가 성공하면
  // 순위 보드 기준일만 당일로 넘어가 둘이 갈린다.
  const briefBasisDate = latestBriefing?.collectionFailed
    ? [...new Set(rows.map((r) => r.date))].sort().filter((d) => d < latestBriefing.date).at(-1) ?? null
    : null;
  const base = `최신 수집(${collectedLabel ?? "집계 전"}) 기준 평균 등록가.`;
  const rankNote = !latestBriefing?.collectionFailed
    ? `${base} 위 브리핑은 심야 회차 발행 시점까지의 수집분 기준이라 같은 날이어도 순위와 수치가 다릅니다.`
    : briefBasisDate === date
      ? `${base} 위 브리핑은 심야 회차 수집이 실패해 같은 ${date} 데이터를 인용하므로 수치가 일치합니다.`
      : `${base} 위 브리핑은 심야 회차 수집 실패로 ${briefBasisDate} 데이터를 인용하므로 아래 순위와 기준일이 다릅니다.`;

  // 브리핑 카드 미니 차트: 본문과 같은 발행 시점(심야 회차) 기준 상승 1위.
  // 최신 수집 기준 1위는 아래 순위 보드가 맡는다 — 한 카드 안에 두 기준을 섞지 않는다.
  const pubTop = latestBriefing
    ? publishChanges(rows, items, latestBriefing.date)
        .filter((c) => c.changePct != null && c.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct)[0] ?? null
    : null;

  // 비교 불가 구간 대체 KPI: 오늘 실거래 최다 / 소급 수집 확보 기간 (데이터 생기면 자동 전환)
  let topSold = null;
  if (!hasCompare && date) {
    const best = {};
    for (const r of rows) {
      if (r.date !== date || r.soldCount24h == null) continue;
      if (!best[r.itemId] || r.soldCount24h > best[r.itemId]) best[r.itemId] = r.soldCount24h;
    }
    const top = Object.entries(best).sort((a, b) => b[1] - a[1])[0];
    if (top) topSold = { name: byId[top[0]]?.shortName ?? top[0], fullName: byId[top[0]]?.name, count: top[1] };
  }
  const bfDates = backfill.map((r) => r.date);
  const bfRange = bfDates.length
    ? { min: bfDates.reduce((a, b) => (a < b ? a : b)), max: bfDates.reduce((a, b) => (a > b ? a : b)) }
    : null;
  const bfDays = bfRange
    ? Math.round((new Date(bfRange.max) - new Date(bfRange.min)) / 86400000) + 1
    : 0;

  return (
    <>
      <Reveal index={0}><HeroBand cells={changes} date={date} /></Reveal>
      <Reveal index={1}><StatusStrip rows={rows} briefings={briefings} collection={collection} /></Reveal>

      <Section index={2} label="오늘의 이야기" title="데일리 브리핑">
        {latestBriefing ? (
          <BriefingHero briefing={latestBriefing} items={items}
                        topUp={pubTop}
                        trend={pubTop ? itemSpark(pubTop.itemId) : null} />
        ) : (
          <Empty>브리핑이 아직 발행되지 않았습니다.</Empty>
        )}
      </Section>

      <Section index={3} band label="전일 대비" title="오늘의 등락 순위"
               note={rankNote}>
        {hasCompare ? (
          <RankBoard ups={ups} downs={downs} trendFor={itemSpark} />
        ) : (
          <Empty>전일 비교 데이터가 쌓이면 등락 순위가 표시됩니다.</Empty>
        )}
      </Section>

      <Section index={4} label="한눈에" title="핵심 지표">
        <div className="card kpi-strip">
          <KpiCell label="추적 품목">
            <CountUpNum value={items.length} />
            <span className="ml-0.5 text-[15px] font-semibold" style={{ color: "var(--text-secondary)" }}>종</span>
          </KpiCell>
          <KpiCell label="오늘 이상 변동" alert={todayAnomalies.length > 0}
                   caption={todayAnomalies.length === 0 ? "전일 대비 기준" : null}>
            <CountUpNum value={todayAnomalies.length} />
            <span className="ml-0.5 text-[15px] font-semibold" style={{ color: "var(--text-secondary)" }}>건</span>
          </KpiCell>
          {hasCompare ? (
            <>
              <KpiCell label="상승 1위"
                       spark={ups[0] ? itemSpark(ups[0].itemId) : null} sparkColor="var(--up)"
                       caption={ups[0] ? "최근 7일 평균가 추이" : null}>
                {ups[0]
                  ? <span className="text-[16px]"><span title={byId[ups[0].itemId]?.name}>{byId[ups[0].itemId]?.shortName}</span> <Change value={ups[0].changePct} countUp /></span>
                  : <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>상승 없음</span>}
              </KpiCell>
              <KpiCell label="하락 1위"
                       spark={downs[0] ? itemSpark(downs[0].itemId) : null} sparkColor="var(--down)"
                       caption={downs[0] ? "최근 7일 평균가 추이" : null}>
                {downs[0]
                  ? <span className="text-[16px]"><span title={byId[downs[0].itemId]?.name}>{byId[downs[0].itemId]?.shortName}</span> <Change value={downs[0].changePct} countUp /></span>
                  : <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>하락 없음</span>}
              </KpiCell>
            </>
          ) : (
            <>
              <KpiCell label="오늘 실거래 최다 (24시간)">
                {topSold
                  ? <span className="text-[16px]"><span title={topSold.fullName}>{topSold.name}</span> <span className="num">{topSold.count.toLocaleString()}건</span></span>
                  : <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>집계 중</span>}
              </KpiCell>
              <KpiCell label="과거 실거래 소급 수집 기간">
                {bfRange
                  ? <span className="num text-[16px]">{bfDays}일 <span style={{ color: "var(--text-muted)" }}>({bfRange.min.slice(5)}~{bfRange.max.slice(5)})</span></span>
                  : <span className="text-[16px]" style={{ color: "var(--text-muted)" }}>없음</span>}
              </KpiCell>
            </>
          )}
        </div>
      </Section>

      <Section index={5} band label="품목 전체" title="카테고리별 등락 히트맵"
               note="전일 대비 평균 등록가. 회색 바탕에 우상단 점은 비교 대기 상태입니다. 타일을 누르면 상세로 갑니다.">
        <div className="card px-3 py-3">
          <div className="mb-2 flex justify-end">
            <HeatLegend />
          </div>
          <Heatmap changes={changes} items={items} llBelow={llBelow} />
        </div>
      </Section>
    </>
  );
}
