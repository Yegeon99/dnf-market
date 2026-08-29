// 시세 차트 (SVG 직접 구현, 의존성 없음)
// 등록가·실거래가 병기, 라인 아래 옅은 영역 그라데이션, 호버 크로스헤어와 리치 툴팁,
// 이벤트 마커는 아이콘 칩, 결손 회차는 공백(선 미연결), 과거 소급 수집 구간은 점선으로 구분
import { useMemo, useRef, useState, useEffect } from "react";
import { slotLabel, fmtGold, fmtComma } from "../lib/data";

const M = { top: 32, right: 12, bottom: 26, left: 66 };
// 날짜 라벨("08-30")은 가운데 정렬이라 양 끝에서 잘린다. 절반 폭만큼 안쪽으로 물린다
const TICK_HALF = 18;

function useWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** 결손(null)을 사이에 둔 구간은 선을 잇지 않는다 → 공백으로 표기 */
function segments(points) {
  const segs = [];
  let cur = [];
  for (const p of points) {
    if (p.y == null) {
      if (cur.length) segs.push(cur);
      cur = [];
    } else cur.push(p);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

const LINES = [
  { key: "avgPrice", label: "등록 평균가", color: "var(--chart-line-listed)" },
  { key: "soldAvg", label: "실거래 평균가(24시간)", color: "var(--chart-line-sold)" },
];

export default function PriceChart({ series, events = [], height = 280 }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null); // {i, x}
  const [evHover, setEvHover] = useState(null); // event index

  // 날짜별 등록 평균가 일 대표값 → 전일 대비 (툴팁용)
  const dailyChange = useMemo(() => {
    const byDate = {};
    for (const s of series) {
      if (s.backfill || s.avgPrice == null) continue;
      (byDate[s.date] ??= []).push(s.avgPrice);
    }
    const days = Object.entries(byDate)
      .map(([date, v]) => ({ date, avg: v.reduce((a, b) => a + b, 0) / v.length }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const map = {};
    days.forEach((d, i) => {
      map[d.date] = i > 0 && days[i - 1].avg ? ((d.avg - days[i - 1].avg) / days[i - 1].avg) * 100 : null;
    });
    return map;
  }, [series]);

  const model = useMemo(() => {
    const iw = Math.max(width - M.left - M.right, 10);
    const ih = height - M.top - M.bottom;
    const n = series.length;
    const xAt = (i) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const vals = series.flatMap((s) => LINES.map((l) => s[l.key])).filter((v) => v != null);
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 1;
    const pad = (hi - lo) * 0.12 || hi * 0.05 || 1;
    const y0 = lo - pad, y1 = hi + pad;
    const yAt = (v) => M.top + ih - ((v - y0) / (y1 - y0)) * ih;
    // 날짜 경계 틱 (날짜가 많으면 솎아냄)
    let ticks = [];
    series.forEach((s, i) => {
      if (i === 0 || s.date !== series[i - 1].date) ticks.push({ i, date: s.date });
    });
    if (ticks.length > 10) {
      const step = Math.ceil(ticks.length / 8);
      ticks = ticks.filter((_, k) => k % step === 0 || k === ticks.length - 1);
    }
    // 이벤트 → 해당 날짜의 첫 회차 위치
    const evMarks = events
      .map((ev) => {
        const i = series.findIndex((s) => s.date === ev.date);
        return i >= 0 ? { ...ev, i } : null;
      })
      .filter(Boolean);
    return { iw, ih, xAt, yAt, y0, y1, ticks, evMarks, n };
  }, [series, events, width, height]);

  if (!series.length) {
    return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>표시할 시세 데이터가 없습니다.</div>;
  }

  const { xAt, yAt, ticks, evMarks, ih } = model;
  const yTicks = 4;
  const capped = series.some((s) => s.soldCapped);
  const hasBackfill = series.some((s) => s.backfill);
  const baseY = M.top + ih;

  const onMove = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0, bd = Infinity;
    series.forEach((_, i) => {
      const d = Math.abs(xAt(i) - px);
      if (d < bd) { bd = d; best = i; }
    });
    setHover({ i: best, x: xAt(best) });
  };

  const h = hover ? series[hover.i] : null;
  const hChange = h && !h.backfill ? dailyChange[h.date] : null;

  // 실거래 라인: 소급 수집 구간과 실측 구간을 나눠 그린다 (경계점 공유로 연결 유지)
  const soldPts = series.map((s, i) => ({ x: xAt(i), y: s.soldAvg, backfill: s.backfill }));
  const lastBfIdx = soldPts.reduce((acc, p, i) => (p.backfill ? i : acc), -1);
  const bfPts = lastBfIdx >= 0 ? soldPts.slice(0, lastBfIdx + 2) : []; // 경계점 1개 포함
  const livePts = lastBfIdx >= 0 ? soldPts.slice(lastBfIdx + 1) : soldPts;

  const renderLine = (pts, color, dash, opacity = 1) =>
    segments(pts).map((seg, si) =>
      seg.length === 1 ? (
        <circle key={si} cx={seg[0].x} cy={yAt(seg[0].y)} r="3" fill={color} opacity={opacity} />
      ) : (
        <path key={si}
              d={seg.map((p, pi) => `${pi ? "L" : "M"}${p.x},${yAt(p.y)}`).join(" ")}
              fill="none" stroke={color} strokeWidth="1.8" strokeDasharray={dash} opacity={opacity} />
      )
    );

  return (
    <div ref={wrapRef} className="relative">
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
           role="img" aria-label="시세 추이 차트: 등록 평균가와 실거래 평균가">
        <defs>
          <linearGradient id="areaListed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--raw-blue-600)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--raw-blue-600)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 축 단위 라벨 */}
        <text x={M.left - 54} y={13} fontSize="13" fill="var(--chart-axis-text)">단위: 골드</text>

        {/* y 그리드·눈금 */}
        {Array.from({ length: yTicks + 1 }, (_, k) => {
          const v = model.y0 + ((model.y1 - model.y0) * k) / yTicks;
          return (
            <g key={k}>
              <line x1={M.left} x2={width - M.right} y1={yAt(v)} y2={yAt(v)} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={M.left - 6} y={yAt(v) + 4} textAnchor="end" fontSize="13" fill="var(--chart-axis-text)" className="num">
                {model.y1 - model.y0 < 10 ? v.toFixed(1) : fmtGold(v)}
              </text>
            </g>
          );
        })}
        {/* x 날짜 틱 */}
        {ticks.map((t) => (
          <text key={t.i} x={Math.min(Math.max(xAt(t.i), TICK_HALF), width - TICK_HALF)} y={height - 6} textAnchor="middle" fontSize="13" fill="var(--chart-axis-text)" className="num">
            {t.date.slice(5)}
          </text>
        ))}

        {/* 등록가 영역 그라데이션 */}
        {segments(series.map((s, i) => ({ x: xAt(i), y: s.avgPrice }))).map((seg, si) =>
          seg.length > 1 && (
            <path key={si}
                  d={`${seg.map((p, pi) => `${pi ? "L" : "M"}${p.x},${yAt(p.y)}`).join(" ")} L${seg[seg.length - 1].x},${baseY} L${seg[0].x},${baseY} Z`}
                  fill="url(#areaListed)" />
          )
        )}

        {/* 호버 크로스헤어 */}
        {hover && (
          <line x1={hover.x} x2={hover.x} y1={M.top} y2={baseY} stroke="var(--chart-crosshair)" strokeWidth="1" strokeDasharray="2 3" />
        )}
        {h?.avgPrice != null && (
          <line x1={M.left} x2={width - M.right} y1={yAt(h.avgPrice)} y2={yAt(h.avgPrice)}
                stroke="var(--chart-crosshair)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
        )}

        {/* 등록가 라인 */}
        {renderLine(series.map((s, i) => ({ x: xAt(i), y: s.avgPrice })), "var(--chart-line-listed)")}
        {series.map((s, i) => s.avgPrice != null && (
          <circle key={`a${i}`} cx={xAt(i)} cy={yAt(s.avgPrice)} r={hover?.i === i ? 3.5 : 2} fill="var(--chart-line-listed)" />
        ))}

        {/* 실거래 라인: 소급 수집(점선·연하게) + 실측(실선) */}
        {renderLine(bfPts, "var(--chart-line-sold)", "5 4", 0.55)}
        {renderLine(livePts, "var(--chart-line-sold)")}
        {soldPts.map((p, i) => p.y != null && (
          <circle key={`s${i}`} cx={p.x} cy={yAt(p.y)} r={hover?.i === i ? 3.5 : 2}
                  fill="var(--chart-line-sold)" opacity={p.backfill ? 0.55 : 1} />
        ))}

        {/* 이벤트 마커: 골드 세로 점선 + 상단 아이콘 칩 */}
        {evMarks.map((ev, k) => {
          const cx = xAt(ev.i);
          const chipW = Math.min(Math.max(ev.type.length * 14 + 24, 48), 92);
          return (
            <g key={k}
               onMouseEnter={() => setEvHover(k)} onMouseLeave={() => setEvHover(null)}
               onFocus={() => setEvHover(k)} onBlur={() => setEvHover(null)}
               tabIndex={0} role="button" aria-label={`이벤트 ${ev.date} ${ev.type}: ${ev.title}`}
               style={{ cursor: "pointer" }}>
              <line x1={cx} x2={cx} y1={M.top - 2} y2={baseY}
                    stroke="var(--chart-event)" strokeWidth="1.2" strokeDasharray="4 3" />
              <rect x={cx - chipW / 2} y={3} width={chipW} height="20" rx="10"
                    fill="var(--gold-soft)" stroke="var(--chart-event)" strokeWidth="0.8" />
              <circle cx={cx - chipW / 2 + 11} cy={13} r="2.4" fill="var(--chart-event)" />
              <text x={cx - chipW / 2 + 18} y={17.5} fontSize="13" fontWeight="600" fill="var(--chart-event-text)">{ev.type}</text>
              {/* 호버 판정 넓힘 */}
              <rect x={cx - chipW / 2} y={0} width={chipW} height={height - M.bottom} fill="transparent" />
            </g>
          );
        })}
      </svg>

      {/* 이벤트 툴팁: 공지 제목 + 링크 */}
      {evHover != null && evMarks[evHover] && (
        <div
          className="card absolute z-10 px-3 py-2 text-[13px]"
          style={{ left: Math.min(xAt(evMarks[evHover].i) + 8, width - 246), top: 26, width: 236 }}
          onMouseEnter={() => setEvHover(evHover)} onMouseLeave={() => setEvHover(null)}
        >
          <div style={{ color: "var(--chart-event-text)" }} className="font-semibold">{evMarks[evHover].date} · {evMarks[evHover].type}</div>
          <div className="mt-0.5" style={{ color: "var(--text-primary)" }}>{evMarks[evHover].title}</div>
          <a href={evMarks[evHover].url} target="_blank" rel="noreferrer" className="mt-1 inline-block">공지 열기 ↗</a>
        </div>
      )}

      {/* 데이터 툴팁: 날짜·등록가·실거래가·매물 수·전일 대비 */}
      {h && evHover == null && (
        <div className="card pointer-events-none absolute z-10 px-3 py-2 text-[13px]"
             style={{ left: Math.min(hover.x + 10, width - 232), top: 28, width: 222 }}>
          <div className="font-semibold num">{h.date} {slotLabel(h.slot)}</div>
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between"><span style={{ color: "var(--chart-line-listed)" }}>등록 평균</span><span className="num">{h.avgPrice != null ? `${fmtComma(h.avgPrice)} 골드` : "미수집"}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--chart-line-sold)" }}>{h.backfill ? "실거래(일 평균)" : "실거래(24시간)"}</span><span className="num">{h.soldAvg != null ? `${fmtComma(h.soldAvg)} 골드` : "없음"}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>매물 수</span><span className="num">{h.listing != null ? `${h.listing.toLocaleString()}건` : "미수집"}</span></div>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-secondary)" }}>전일 대비</span>
              <span className="num" style={{ color: hChange == null ? "var(--text-muted)" : hChange > 0 ? "var(--up)" : hChange < 0 ? "var(--down)" : "var(--neutral)" }}>
                {hChange == null ? "비교 전" : `${hChange > 0 ? "+" : ""}${hChange.toFixed(1)}%`}
              </span>
            </div>
          </div>
          {h.backfill ? (
            <div className="mt-1" style={{ color: "var(--text-muted)" }}>과거 실거래 소급 수집 구간. 등록가·매물 수는 소급 불가</div>
          ) : h.avgPrice == null && (
            <div className="mt-1" style={{ color: "var(--text-muted)" }}>결손 회차 (수집 실패 또는 미수집)</div>
          )}
        </div>
      )}

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {LINES.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <span style={{ background: l.color, width: 14, height: 3, display: "inline-block", borderRadius: 2 }} />
            {l.label}
          </span>
        ))}
        {hasBackfill && (
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke="var(--chart-line-sold)" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.55" /></svg>
            실거래(과거 소급 수집 구간)
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span style={{ borderLeft: "2px dashed var(--chart-event)", height: 12, display: "inline-block" }} />
          이벤트·패치
        </span>
        {capped && <span style={{ color: "var(--text-muted)" }}>* 실거래는 API 상한(최근 100건) 내 집계</span>}
        {hasBackfill && (
          <span style={{ color: "var(--text-muted)" }}>* 수집 시작 전 실거래는 판매완료 내역을 일 단위로 소급 수집. 등록가·매물 수는 소급이 불가능해 공백</span>
        )}
      </div>
    </div>
  );
}
