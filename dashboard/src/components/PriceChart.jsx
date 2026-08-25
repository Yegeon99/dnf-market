// 시세 차트 (SVG 직접 구현 — 의존성 없음)
// 요건: 등록가·실거래가 병기 / 이벤트 마커 오버레이(--warn 세로 점선, 호버 시 공지 제목·링크)
//       결손 슬롯 공백 표기(선 미연결) / 등락 색+부호 병기
import { useMemo, useRef, useState, useEffect } from "react";
import { slotLabel, fmtGold } from "../lib/data";

const M = { top: 14, right: 12, bottom: 22, left: 52 };

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

export default function PriceChart({ series, events = [], height = 260 }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null); // {i, x}
  const [evHover, setEvHover] = useState(null); // event index

  const lines = [
    { key: "avgPrice", label: "등록 평균가", color: "var(--accent)" },
    { key: "soldAvg", label: "실거래 평균가(24h)", color: "#3B8A6E" },
  ];

  const model = useMemo(() => {
    const iw = Math.max(width - M.left - M.right, 10);
    const ih = height - M.top - M.bottom;
    const n = series.length;
    const xAt = (i) => M.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const vals = series.flatMap((s) => lines.map((l) => s[l.key])).filter((v) => v != null);
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
    // 이벤트 → 해당 날짜의 첫 슬롯 위치
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

  const { xAt, yAt, ticks, evMarks } = model;
  const yTicks = 4;
  const capped = series.some((s) => s.soldCapped);

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

  return (
    <div ref={wrapRef} className="relative">
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* y 그리드·눈금 */}
        {Array.from({ length: yTicks + 1 }, (_, k) => {
          const v = model.y0 + ((model.y1 - model.y0) * k) / yTicks;
          return (
            <g key={k}>
              <line x1={M.left} x2={width - M.right} y1={yAt(v)} y2={yAt(v)} stroke="var(--border)" strokeWidth="1" />
              <text x={M.left - 6} y={yAt(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)" className="num">
                {model.y1 - model.y0 < 10 ? v.toFixed(1) : fmtGold(v)}
              </text>
            </g>
          );
        })}
        {/* x 날짜 틱 */}
        {ticks.map((t) => (
          <text key={t.i} x={xAt(t.i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--text-muted)" className="num">
            {t.date.slice(5)}
          </text>
        ))}
        {/* 호버 가이드 */}
        {hover && <line x1={hover.x} x2={hover.x} y1={M.top} y2={height - M.bottom} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2 3" />}
        {/* 데이터 라인 (결손 구간 미연결) + 고립점 표시 */}
        {lines.map((l) => {
          const pts = series.map((s, i) => ({ x: xAt(i), y: s[l.key] }));
          return (
            <g key={l.key}>
              {segments(pts).map((seg, si) =>
                seg.length === 1 ? (
                  <circle key={si} cx={seg[0].x} cy={yAt(seg[0].y)} r="3" fill={l.color} />
                ) : (
                  <path
                    key={si}
                    d={seg.map((p, pi) => `${pi ? "L" : "M"}${p.x},${yAt(p.y)}`).join(" ")}
                    fill="none" stroke={l.color} strokeWidth="1.8"
                  />
                )
              )}
              {pts.map((p, i) => p.y != null && (
                <circle key={i} cx={p.x} cy={yAt(p.y)} r={hover?.i === i ? 3.5 : 2} fill={l.color} />
              ))}
            </g>
          );
        })}
        {/* 이벤트 마커: --warn 세로 점선 + 상단 다이아몬드 */}
        {evMarks.map((ev, k) => (
          <g key={k}
             onMouseEnter={() => setEvHover(k)} onMouseLeave={() => setEvHover(null)}
             style={{ cursor: "pointer" }}>
            <line x1={xAt(ev.i)} x2={xAt(ev.i)} y1={M.top} y2={height - M.bottom}
                  stroke="var(--warn)" strokeWidth="1.2" strokeDasharray="4 3" />
            <rect x={xAt(ev.i) - 4} y={M.top - 4} width="8" height="8"
                  transform={`rotate(45 ${xAt(ev.i)} ${M.top})`} fill="var(--warn)" />
            {/* 호버 판정 넓힘 */}
            <rect x={xAt(ev.i) - 6} y={M.top - 8} width="12" height={height - M.top - M.bottom + 8} fill="transparent" />
          </g>
        ))}
      </svg>

      {/* 이벤트 툴팁: 공지 제목 + 링크 */}
      {evHover != null && evMarks[evHover] && (
        <div
          className="card absolute z-10 px-3 py-2 text-xs"
          style={{ left: Math.min(xAt(evMarks[evHover].i) + 8, width - 230), top: 6, width: 220 }}
          onMouseEnter={() => setEvHover(evHover)} onMouseLeave={() => setEvHover(null)}
        >
          <div style={{ color: "var(--warn)" }} className="font-semibold">{evMarks[evHover].date} · {evMarks[evHover].type}</div>
          <div className="mt-0.5" style={{ color: "var(--text-primary)" }}>{evMarks[evHover].title}</div>
          <a href={evMarks[evHover].url} target="_blank" rel="noreferrer" className="mt-1 inline-block">공지 열기 ↗</a>
        </div>
      )}

      {/* 데이터 툴팁 */}
      {h && evHover == null && (
        <div className="card absolute z-10 px-3 py-2 text-xs pointer-events-none"
             style={{ left: Math.min(hover.x + 10, width - 190), top: 10, width: 180 }}>
          <div className="font-semibold num">{h.date} {slotLabel(h.slot)}</div>
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between"><span style={{ color: "var(--accent)" }}>등록 평균</span><span className="num">{fmtGold(h.avgPrice)}</span></div>
            <div className="flex justify-between"><span style={{ color: "#3B8A6E" }}>{h.backfill ? "실거래(일 평균)" : "실거래(24h)"}</span><span className="num">{fmtGold(h.soldAvg)}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>매물 수</span><span className="num">{h.listing ?? "—"}</span></div>
          </div>
          {h.backfill ? (
            <div className="mt-1" style={{ color: "var(--text-muted)" }}>소급 백필 — 등록가·매물수는 소급 불가</div>
          ) : h.avgPrice == null && (
            <div className="mt-1" style={{ color: "var(--text-muted)" }}>결손 슬롯 (수집 실패·미수집)</div>
          )}
        </div>
      )}

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 px-2 pt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
        {lines.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <span style={{ background: l.color, width: 14, height: 3, display: "inline-block", borderRadius: 2 }} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span style={{ borderLeft: "2px dashed var(--warn)", height: 12, display: "inline-block" }} />
          이벤트·패치
        </span>
        {capped && <span style={{ color: "var(--text-muted)" }}>* 실거래는 API 상한(최근 100건) 내 집계</span>}
        {series.some((s) => s.backfill) && (
          <span style={{ color: "var(--text-muted)" }}>* 수집 시작 전 실거래는 판매완료 내역 소급 백필(일 평균) — 등록가·매물수는 소급 불가로 공백</span>
        )}
      </div>
    </div>
  );
}
