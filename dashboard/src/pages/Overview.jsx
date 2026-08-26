// 화면 1 — 마켓 오버뷰: 파이프라인 상태 스트립, KPI, 카테고리 히트맵, 최신 브리핑
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  dailySeries, dodChanges, latestDate, fmtGold, fmtPct, fmtSignedPct, heatColor,
  pctColor,
} from "../lib/data";
import { Change, CountUpNum, Empty, Sparkline } from "../components/ui";
import HeatLegend from "../components/HeatLegend";
import StatusStrip from "../components/StatusStrip";

// 아이콘: 게임 아트워크 없이 선 아이콘만 사용
const ICONS = {
  items: <path d="M2.5 2.5h4.4v4.4H2.5zM9.1 2.5h4.4v4.4H9.1zM2.5 9.1h4.4v4.4H2.5zM9.1 9.1h4.4v4.4H9.1z" />,
  alert: <path d="M8 1.8 14.6 13H1.4L8 1.8zM8 6.2v3.2M8 11.4v.7" />,
  up: <path d="M2 12.5 6.2 8l2.6 2.4L14 4.6M14 4.6h-3.4M14 4.6V8" />,
  down: <path d="M2 3.5 6.2 8l2.6-2.4L14 11.4M14 11.4h-3.4M14 11.4V8" />,
  sold: <path d="M2.5 13.5v-4.2M6.2 13.5V6.5M9.9 13.5V9M13.5 13.5V3.5" />,
  archive: <path d="M2.5 4h11M2.5 4v9h11V4M5.5 7h5" />,
};

function KpiIcon({ name, color = "var(--text-muted)" }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke={color}
         strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function Kpi({ icon, iconColor, label, caption, spark, sparkColor, children }) {
  return (
    <div className="card rise px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
        <KpiIcon name={icon} color={iconColor} />
        {label}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="text-lg font-bold num leading-tight">{children}</div>
        {spark && <Sparkline values={spark} color={sparkColor ?? "var(--accent)"} />}
      </div>
      {caption && <div className="mt-0.5 text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>{caption}</div>}
    </div>
  );
}

// 2컬럼 그룹 배치: 좌(강화·스킬/성장/레어 1세대), 우(증폭/마법부여/레어 2세대/일반)
const LEFT_GROUPS = ["강화·스킬 재료", "성장 재료", "레어 클론 아바타 1세대"];

function Tile({ c, it, onEnter, onLeave, onClick }) {
  const noCompare = c.changePct == null;
  const { bg, fg } = heatColor(c.changePct);
  return (
    <button
      onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}
      className="heat-tile relative w-[118px] shrink-0 cursor-pointer px-1.5 py-1 text-left"
      style={{ background: bg, color: fg }}
    >
      <div className="truncate text-[13px] font-medium leading-snug">{it?.shortName ?? c.name}</div>
      <div className="num text-xs leading-snug">{fmtGold(c.avgPrice)}</div>
      <div className="min-h-[22px] num text-[15px] font-bold leading-snug">
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
        <div key={g.name}>
          <div className="mb-1 flex items-baseline gap-1.5 border-b pb-0.5" style={{ borderColor: "var(--hairline)" }}>
            <span className="text-[11px] font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>{g.name}</span>
            <span className="num text-[10px]" style={{ color: "var(--text-muted)" }}>{g.cells.length}종</span>
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
      <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        {renderGroups(left)}
        {renderGroups(right)}
      </div>

      {tip && (
        <div className="card pointer-events-none absolute z-10 px-2.5 py-1.5 text-xs"
             style={{ left: Math.max(0, Math.min(tip.x - 90, 1040)), top: Math.max(0, tip.y - 92), width: 200 }}>
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
            <span className="num">{tip.c.listing != null ? `${tip.c.listing.toLocaleString()}건` : "미수집"}{llBelow > 0 && tip.c.listing != null && tip.c.listing < llBelow ? " (저유동)" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Overview({ data }) {
  const { rows, anomalies, briefings, items, thresholds, backfill } = data;
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

  // 스파크라인 데이터: 최근 7일
  const allDates = [...new Set(rows.map((r) => r.date))].sort().slice(-7);
  const anomalySpark = allDates.map((d) => anomalies.filter((a) => a.date === d).length);
  const itemSpark = (id) => dailySeries(rows, id).slice(-7).map((d) => d.avgPrice);

  // 비교 불가 구간 대체 KPI: 오늘 실거래 최다 / 소급 수집 확보 기간 (데이터 생기면 자동 전환)
  let topSold = null;
  if (!hasCompare && date) {
    const best = {};
    for (const r of rows) {
      if (r.date !== date || r.soldCount24h == null) continue;
      if (!best[r.itemId] || r.soldCount24h > best[r.itemId]) best[r.itemId] = r.soldCount24h;
    }
    const top = Object.entries(best).sort((a, b) => b[1] - a[1])[0];
    if (top) topSold = { name: byId[top[0]]?.shortName ?? top[0], count: top[1] };
  }
  const bfDates = backfill.map((r) => r.date);
  const bfRange = bfDates.length
    ? { min: bfDates.reduce((a, b) => (a < b ? a : b)), max: bfDates.reduce((a, b) => (a > b ? a : b)) }
    : null;
  const bfDays = bfRange
    ? Math.round((new Date(bfRange.max) - new Date(bfRange.min)) / 86400000) + 1
    : 0;

  return (
    <div className="space-y-4">
      <div className="rise">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="t-title m-0">마켓 오버뷰</h1>
          <span className="text-xs num" style={{ color: "var(--text-muted)" }}>
            기준일 {date ?? "집계 전"} · KST 하루 6회 수집
          </span>
        </div>
      </div>

      {/* 파이프라인 상태 스트립: 무인 운영이 한눈에 보이게 */}
      <StatusStrip rows={rows} briefings={briefings} />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi icon="items" label="추적 품목">
          <CountUpNum value={items.length} />종
        </Kpi>
        <Kpi icon="alert" iconColor={todayAnomalies.length ? "var(--gold-text)" : undefined}
             label="오늘 이상 변동"
             caption={todayAnomalies.length === 0 ? "전일 대비 기준. 데이터 이틀째부터 적용" : "최근 7일 추이"}
             spark={anomalySpark} sparkColor="var(--gold)">
          <span style={{ color: todayAnomalies.length ? "var(--warn)" : "var(--text-primary)" }}>
            <CountUpNum value={todayAnomalies.length} />건
          </span>
        </Kpi>
        {hasCompare ? (
          <>
            <Kpi icon="up" iconColor="var(--up)" label="상승 1위 (전일 대비)"
                 spark={ups[0] ? itemSpark(ups[0].itemId) : null} sparkColor="var(--up)"
                 caption={ups[0] ? "최근 7일 평균가 추이" : null}>
              {ups[0]
                ? <span className="text-sm">{byId[ups[0].itemId]?.shortName} <Change value={ups[0].changePct} /></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>상승 없음</span>}
            </Kpi>
            <Kpi icon="down" iconColor="var(--down)" label="하락 1위 (전일 대비)"
                 spark={downs[0] ? itemSpark(downs[0].itemId) : null} sparkColor="var(--down)"
                 caption={downs[0] ? "최근 7일 평균가 추이" : null}>
              {downs[0]
                ? <span className="text-sm">{byId[downs[0].itemId]?.shortName} <Change value={downs[0].changePct} /></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>하락 없음</span>}
            </Kpi>
          </>
        ) : (
          <>
            <Kpi icon="sold" label="오늘 실거래 최다 (24시간)">
              {topSold
                ? <span className="text-sm">{topSold.name} <span className="num">{topSold.count.toLocaleString()}건</span></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>집계 중</span>}
            </Kpi>
            <Kpi icon="archive" label="과거 실거래 소급 수집 기간">
              {bfRange
                ? <span className="text-sm num">{bfDays}일 <span style={{ color: "var(--text-muted)" }}>({bfRange.min.slice(5)}~{bfRange.max.slice(5)})</span></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>없음</span>}
            </Kpi>
          </>
        )}
      </div>

      {/* 최신 브리핑 */}
      {latestBriefing ? (
        <Link to="/briefings" className="card card-lift block px-3 py-2.5 no-underline" style={{ color: "inherit" }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="num">{latestBriefing.date}</span>
            <span>데일리 브리핑</span>
            <span className="ml-auto" style={{ color: "var(--accent)" }}>아카이브 →</span>
          </div>
          <div className="t-section mt-0.5">{latestBriefing.headline}</div>
          <ul className="mt-1 list-none space-y-0.5 p-0 text-xs" style={{ color: "var(--text-secondary)" }}>
            {latestBriefing.summary_3lines.map((l, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </Link>
      ) : (
        <Empty>브리핑이 아직 발행되지 않았습니다.</Empty>
      )}

      {/* 히트맵 */}
      <div className="card px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="t-section m-0">카테고리별 등락 히트맵 <span className="text-xs font-normal" style={{ color: "var(--text-muted)", fontFamily: "Pretendard Variable, Pretendard, sans-serif" }}>(전일 대비 평균 등록가 · 클릭 시 상세)</span></h2>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>회색 바탕에 우상단 점이 있으면 전일 비교 대기 상태로 현재가만 표시합니다. 탭이나 클릭으로 매물 수와 상세를 볼 수 있습니다.</div>
          </div>
          <HeatLegend />
        </div>
        <Heatmap changes={changes} items={items} llBelow={llBelow} />
      </div>
    </div>
  );
}
