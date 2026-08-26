// 화면 1 — 마켓 오버뷰: KPI, 카테고리 히트맵(2컬럼 그룹 배치), 최신 브리핑
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  dodChanges, latestDate, fmtGold, fmtPct, fmtSignedPct, heatColor,
  lastCollectedLabel, pctColor,
} from "../lib/data";
import { Change, Empty } from "../components/ui";
import HeatLegend from "../components/HeatLegend";

function Kpi({ label, caption, children }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</div>
      <div className="mt-0.5 text-lg font-bold num leading-tight">{children}</div>
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
      className="relative w-[118px] shrink-0 cursor-pointer rounded px-1.5 py-1 text-left"
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
    <div className="space-y-2">
      {list.map((g) => (
        <div key={g.name}>
          <div className="mb-0.5 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{g.name}</div>
          <div className="flex flex-wrap gap-1">
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
      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {renderGroups(left)}
        {renderGroups(right)}
      </div>

      {tip && (
        <div className="card pointer-events-none absolute z-10 px-2.5 py-1.5 text-xs"
             style={{ left: Math.max(0, Math.min(tip.x - 90, 1160)), top: Math.max(0, tip.y - 92), width: 200 }}>
          <div className="font-semibold">{tip.c.name}</div>
          <div className="mt-0.5 flex justify-between"><span style={{ color: "var(--text-secondary)" }}>등록 평균가</span><span className="num">{fmtGold(tip.c.avgPrice)}</span></div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-secondary)" }}>전일 대비</span>
            {tip.c.changePct == null
              ? <span style={{ color: "var(--text-muted)" }}>비교 대기</span>
              : <span className="num font-semibold" style={{ color: pctColor(tip.c.changePct) }}>{fmtPct(tip.c.changePct)}</span>}
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-secondary)" }}>매물 수</span>
            <span className="num">{tip.c.listing ?? "—"}{llBelow > 0 && tip.c.listing != null && tip.c.listing < llBelow ? " (저유동)" : ""}</span>
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
  const lastCollected = lastCollectedLabel(rows);

  // 비교 불가 구간 대체 KPI: 오늘 실거래 최다 / 백필 확보 기간 (데이터 생기면 자동 전환)
  const byId = Object.fromEntries(items.map((it) => [it.itemId, it]));
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
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">마켓 오버뷰</h1>
        <span className="text-xs num" style={{ color: "var(--text-muted)" }}>
          기준일 {date ?? "—"} · KST 하루 6회 수집 · <span style={{ color: "var(--accent)" }}>● 운영 중</span>
          {lastCollected && <> · 최근 수집 {lastCollected}</>}
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="추적 품목">{items.length}종</Kpi>
        <Kpi label="오늘 이상 변동"
             caption={todayAnomalies.length === 0 ? "탐지 기준: 전일 대비 — 데이터 2일차부터 적용" : null}>
          <span style={{ color: todayAnomalies.length ? "var(--warn)" : "var(--text-primary)" }}>
            {todayAnomalies.length}건
          </span>
        </Kpi>
        {hasCompare ? (
          <>
            <Kpi label="상승 1위 (전일 대비)">
              {ups[0]
                ? <span className="text-sm">{byId[ups[0].itemId]?.shortName} <Change value={ups[0].changePct} /></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>상승 없음</span>}
            </Kpi>
            <Kpi label="하락 1위 (전일 대비)">
              {downs[0]
                ? <span className="text-sm">{byId[downs[0].itemId]?.shortName} <Change value={downs[0].changePct} /></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>하락 없음</span>}
            </Kpi>
          </>
        ) : (
          <>
            <Kpi label="오늘 실거래 최다 (24h)">
              {topSold
                ? <span className="text-sm">{topSold.name} <span className="num">{topSold.count}건</span></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>집계 중</span>}
            </Kpi>
            <Kpi label="백필 확보 기간 (실거래 소급)">
              {bfRange
                ? <span className="text-sm num">{bfDays}일 <span style={{ color: "var(--text-muted)" }}>({bfRange.min.slice(5)}~{bfRange.max.slice(5)})</span></span>
                : <span className="text-sm" style={{ color: "var(--text-muted)" }}>없음</span>}
            </Kpi>
          </>
        )}
      </div>

      {/* 최신 브리핑 */}
      {latestBriefing ? (
        <Link to="/briefings" className="card block px-3 py-2.5 no-underline" style={{ color: "inherit" }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="num">{latestBriefing.date}</span>
            <span>데일리 브리핑</span>
            <span className="ml-auto" style={{ color: "var(--accent)" }}>아카이브 →</span>
          </div>
          <div className="mt-0.5 text-sm font-bold">{latestBriefing.headline}</div>
          <ul className="mt-1 space-y-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            {latestBriefing.summary_3lines.map((l, i) => <li key={i} className="ml-4 list-disc">{l}</li>)}
          </ul>
        </Link>
      ) : (
        <Empty>브리핑이 아직 발행되지 않았습니다.</Empty>
      )}

      {/* 히트맵 */}
      <div className="card px-3 py-2.5">
        <div className="mb-2 flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold">카테고리별 등락 히트맵 <span className="font-normal text-xs" style={{ color: "var(--text-muted)" }}>(전일 대비 평균 등록가 · 클릭 시 상세)</span></h2>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>회색+우상단 점 = 전일 비교 대기(현재가 표시) · 탭/클릭 시 매물 수·실거래 상세</div>
          </div>
          <HeatLegend />
        </div>
        <Heatmap changes={changes} items={items} llBelow={llBelow} />
      </div>
    </div>
  );
}
