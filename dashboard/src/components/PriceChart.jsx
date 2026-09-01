// 시세 차트 (SVG 직접 구현, 의존성 없음)
//
// 읽기 어려웠던 원인과 처방:
//  1. x축이 "회차 순번" 기준이라 하루 1회 수집한 날과 6회 수집한 날의 가로 폭이 6배 달랐다.
//     → x축을 실제 시간 기준으로 바꿨다. 회차가 빈 구간은 그만큼 빈 자리로 남는다
//  2. 회차를 전부 찍으면 하루 안에서 오르내리는 톱니가 며칠치 흐름을 덮었다.
//     → 기본 보기를 일 단위 대표값으로 바꾸고, 회차별 보기는 선택으로 뺐다
//  3. 소급 수집 구간(하루 1점)과 실측 구간(하루 최대 6점)이 한 축에서 밀도가 달라 끊겨 보였다.
//     → 일 단위로 맞추면 두 구간이 같은 간격이 된다
//  4. 이벤트 칩이 서로 겹쳐 글자를 가렸다. → 가까운 이벤트는 하나로 묶어 개수로 표시한다
//
// 결손 회차를 잇지 않는 원칙은 그대로다. 없는 값은 선을 끊어 공백으로 남긴다.
import { useMemo, useRef, useState } from "react";
import { slotLabel, fmtGold, fmtComma } from "../lib/data";
import { useWidth } from "../lib/use-width";
import { AXIS, buildPoints, dayNum, xScale } from "../lib/chart-points";

const M = { top: 34, right: AXIS.right, bottom: 28, left: AXIS.left };
// 날짜 라벨("08-30")은 가운데 정렬이라 양 끝에서 잘린다. 절반 폭만큼 안쪽으로 물린다
const TICK_HALF = 18;

const LINES = [
  { key: "avgPrice", label: "등록 대표가", color: "var(--chart-line-listed)" },
  { key: "soldAvg", label: "실거래 대표가", color: "var(--chart-line-sold)" },
];

/** 실거래 집계 구간 라벨. API가 최근 100건만 주므로 상한에 걸리면 24시간이 아니다 */
function soldWindowLabel(s) {
  if (s?.backfill) return "실거래(일 평균)";
  if (s?.mode === "day") return "실거래(일 평균)";
  if (!s?.soldCapped) return "실거래(24시간)";
  return s.soldWindowHours != null
    ? `실거래(최근 100건, 약 ${s.soldWindowHours}시간)`
    : "실거래(최근 100건)";
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

export default function PriceChart({ series, events = [], height = 340,
                                    mode = "day", rangeDays = 14, tableOpen = false }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);    // {i, x}
  const [evHover, setEvHover] = useState(null);

  const points = useMemo(() => buildPoints(series, mode, rangeDays),
                         [series, mode, rangeDays]);

  const model = useMemo(() => {
    const { iw, xAt } = xScale(points, width);
    const ih = height - M.top - M.bottom;

    const vals = points.flatMap((p) => LINES.map((l) => p[l.key])).filter((v) => v != null);
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 1;
    const pad = (hi - lo) * 0.12 || hi * 0.05 || 1;
    const y0 = lo - pad, y1 = hi + pad;
    const yAt = (v) => M.top + ih - ((v - y0) / (y1 - y0)) * ih;

    // 날짜 눈금: 시간 축이라 균등 간격으로 뽑는다
    const days = [...new Set(points.map((p) => p.date))];
    const want = Math.max(2, Math.min(7, Math.floor(iw / 90)));
    const step = Math.max(1, Math.ceil(days.length / want));
    const picked = days.filter((_, k) => k % step === 0 || k === days.length - 1)
      .map((date) => ({ date, t: dayNum(date) + 0.5 }));
    // 마지막 눈금이 앞 눈금에 붙으면 글자가 겹친다. 최소 간격을 못 지키면 버린다
    const ticks = picked.filter((tk, k) =>
      k === 0 || xAt(tk.t) - xAt(picked[k - 1].t) >= 64);

    // 이벤트: 가까이 붙은 것끼리 묶어 하나로 (칩이 서로 겹쳐 글자를 가리던 문제)
    const visible = events
      .filter((ev) => points.some((p) => p.date === ev.date))
      .map((ev) => ({ ...ev, t: dayNum(ev.date) + 0.5 }))
      .sort((a, b) => a.t - b.t);
    const clusters = [];
    for (const ev of visible) {
      const last = clusters[clusters.length - 1];
      if (last && Math.abs(xAt(ev.t) - xAt(last.items[0].t)) < 58) last.items.push(ev);
      else clusters.push({ items: [ev] });
    }
    return { iw, ih, xAt, yAt, y0, y1, ticks, clusters };
  }, [points, width, height, events]);

  if (!series.length) {
    return <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>표시할 시세 데이터가 없습니다.</div>;
  }

  const { xAt, yAt, ticks, clusters, ih } = model;
  const yTicks = 4;
  const capped = points.some((p) => p.soldCapped);
  const hasBackfill = points.some((p) => p.backfill);
  const baseY = M.top + ih;
  const h = hover ? points[hover.i] : null;

  const pick = (clientX) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xAt(p.t) - px);
      if (d < bd) { bd = d; best = i; }
    });
    if (points[best]) setHover({ i: best, x: xAt(points[best].t) });
  };

  const onMove = (e) => pick(e.clientX);
  // 터치: 손가락을 대거나 끌면 같은 지점을 고른다 (마우스 없는 기기 대응)
  const onTouch = (e) => {
    const t = e.touches[0];
    if (t) pick(t.clientX);
  };

  // 키보드: 좌우로 이동, 처음·끝으로 점프, Esc로 해제
  const onKeyDown = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    let next = null;
    if (step != null) next = Math.min(Math.max((hover?.i ?? 0) + step, 0), points.length - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = points.length - 1;
    else if (e.key === "Escape") { setHover(null); return; }
    else return;
    e.preventDefault();
    setHover({ i: next, x: xAt(points[next].t) });
  };

  const pointName = (p) => p == null ? "" : `${p.date}${p.slot ? ` ${slotLabel(p.slot)}` : ""}`;
  const pointLabel = (p) => p == null ? "회차를 선택하지 않음"
    : `${pointName(p)}, 등록 대표가 `
      + (p.avgPrice != null ? `${fmtComma(Math.round(p.avgPrice))} 골드` : "미수집")
      + ", 실거래 " + (p.soldAvg != null ? `${fmtComma(Math.round(p.soldAvg))} 골드` : "없음")
      + ", 매물 " + (p.listing != null ? `${Math.round(p.listing).toLocaleString()}건` : "미수집");

  // 실거래 라인: 소급 수집 구간과 실측 구간을 나눠 그린다 (경계점 공유로 연결 유지)
  const soldPts = points.map((p) => ({ x: xAt(p.t), y: p.soldAvg, backfill: p.backfill }));
  const lastBfIdx = soldPts.reduce((acc, p, i) => (p.backfill ? i : acc), -1);
  const bfPts = lastBfIdx >= 0 ? soldPts.slice(0, lastBfIdx + 2) : [];
  const livePts = lastBfIdx >= 0 ? soldPts.slice(lastBfIdx + 1) : soldPts;

  const renderLine = (pts, color, dash, opacity = 1) =>
    segments(pts).map((seg, si) =>
      seg.length === 1 ? (
        // 양옆이 결손이라 선이 될 수 없는 값. 점 하나로 남기고 흰 링으로 띄운다
        <circle key={si} cx={seg[0].x} cy={yAt(seg[0].y)} r="4" fill={color} opacity={opacity}
                stroke="var(--card-bg)" strokeWidth="2" />
      ) : (
        <path key={si}
              d={seg.map((p, pi) => `${pi ? "L" : "M"}${p.x},${yAt(p.y)}`).join(" ")}
              fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
              strokeLinejoin="round" strokeDasharray={dash} opacity={opacity} />
      )
    );

  const listedPts = points.map((p) => ({ x: xAt(p.t), y: p.avgPrice }));
  const lastListed = [...points].reverse().find((p) => p.avgPrice != null);

  return (
    <div>
      <div
        ref={wrapRef}
        className="chart-focus relative"
        tabIndex={0}
        role="group"
        aria-label="시세 추이 차트. 좌우 방향키로 지점을 옮기며 값을 읽을 수 있습니다"
        onKeyDown={onKeyDown}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHover(null); }}
      >
        {/* 지금 고른 지점을 소리로 읽어 준다. 차트 그림 자체는 보조기술에서 감춘다 */}
        <span className="sr-only" role="status" aria-live="polite">{pointLabel(h)}</span>
        <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)}
             onTouchStart={onTouch} onTouchMove={onTouch}
             aria-hidden="true" style={{ touchAction: "pan-y" }}>
          <defs>
            <linearGradient id="areaListed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--raw-blue-600)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--raw-blue-600)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <text x={M.left - 54} y={15} fontSize="13" fill="var(--chart-axis-text)">단위: 골드</text>

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
          {/* x 날짜 눈금 */}
          {ticks.map((t) => (
            <text key={t.date} x={Math.min(Math.max(xAt(t.t), TICK_HALF), width - TICK_HALF)}
                  y={height - 8} textAnchor="middle" fontSize="13"
                  fill="var(--chart-axis-text)" className="num">
              {t.date.slice(5)}
            </text>
          ))}

          {/* 등록가 영역: 라인 아래 옅은 워시 */}
          {segments(listedPts).map((seg, si) =>
            seg.length > 1 && (
              <path key={si}
                    d={`${seg.map((p, pi) => `${pi ? "L" : "M"}${p.x},${yAt(p.y)}`).join(" ")} L${seg[seg.length - 1].x},${baseY} L${seg[0].x},${baseY} Z`}
                    fill="url(#areaListed)" />
            )
          )}

          {/* 호버 크로스헤어 */}
          {hover && (
            <line x1={hover.x} x2={hover.x} y1={M.top} y2={baseY} stroke="var(--chart-crosshair)" strokeWidth="1" />
          )}

          {/* 실거래: 소급 수집(점선·연하게) + 실측(실선) */}
          {renderLine(bfPts, "var(--chart-line-sold)", "5 4", 0.6)}
          {renderLine(livePts, "var(--chart-line-sold)")}
          {/* 등록가 */}
          {renderLine(listedPts, "var(--chart-line-listed)")}

          {/* 선택한 지점만 점으로 (모든 점에 마커를 찍으면 흐름이 묻힌다) */}
          {h && LINES.map((l) => h[l.key] != null && (
            <circle key={l.key} cx={xAt(h.t)} cy={yAt(h[l.key])} r="4.5" fill={l.color}
                    stroke="var(--card-bg)" strokeWidth="2" />
          ))}

          {/* 이벤트: 가까운 것끼리 묶은 칩 + 세로 안내선 */}
          {clusters.map((cl, k) => {
            const cx = xAt(cl.items[0].t);
            const single = cl.items.length === 1;
            const text = single ? cl.items[0].type : `${cl.items.length}건`;
            const chipW = Math.min(Math.max(text.length * 13 + 22, 44), 88);
            const cxClamped = Math.min(Math.max(cx, M.left + chipW / 2), width - M.right - chipW / 2);
            return (
              <g key={k}
                 onMouseEnter={() => setEvHover(k)} onMouseLeave={() => setEvHover(null)}
                 onFocus={() => setEvHover(k)} onBlur={() => setEvHover(null)}
                 tabIndex={0} role="button" className="pipe-node"
                 aria-label={`이벤트 ${cl.items.map((e) => `${e.date} ${e.type} ${e.title}`).join(", ")}`}
                 style={{ cursor: "pointer" }}>
                <line x1={cx} x2={cx} y1={M.top} y2={baseY}
                      stroke="var(--chart-event)" strokeWidth="1" opacity="0.55" />
                <rect x={cxClamped - chipW / 2} y={4} width={chipW} height="19" rx="9.5"
                      fill="var(--gold-soft)" stroke="var(--chart-event)" strokeWidth="0.8" />
                <circle cx={cxClamped - chipW / 2 + 10} cy={13.5} r="2.4" fill="var(--chart-event)" />
                <text x={cxClamped - chipW / 2 + 17} y={18} fontSize="13" fontWeight="600"
                      fill="var(--chart-event-text)">{text}</text>
                <rect x={cxClamped - chipW / 2} y={0} width={chipW} height={height - M.bottom} fill="transparent" />
              </g>
            );
          })}
        </svg>

        {/* 이벤트 툴팁: 공지 제목 + 링크 */}
        {evHover != null && clusters[evHover] && (
          <div
            className="card absolute z-10 px-3 py-2 t-micro"
            style={{ left: Math.min(xAt(clusters[evHover].items[0].t) + 8, Math.max(width - 250, 0)), top: 26, width: 240 }}
            onMouseEnter={() => setEvHover(evHover)} onMouseLeave={() => setEvHover(null)}
          >
            {clusters[evHover].items.map((ev, i) => (
              <div key={ev.date + ev.title} className={i ? "mt-2 border-t pt-2" : ""}
                   style={i ? { borderColor: "var(--hairline)" } : undefined}>
                <div style={{ color: "var(--chart-event-text)" }} className="font-semibold">{ev.date} · {ev.type}</div>
                <div className="mt-0.5" style={{ color: "var(--text-primary)" }}>{ev.title}</div>
                {ev.url
                  ? <a href={ev.url} target="_blank" rel="noreferrer" className="mt-1 inline-block"
                       aria-label={`${ev.title} 공지 열기 (새 창)`}>공지 열기 ↗</a>
                  : <span className="mt-1 inline-block" style={{ color: "var(--text-muted)" }}>개별 공지 주소 미확보</span>}
              </div>
            ))}
          </div>
        )}

        {/* 데이터 툴팁 */}
        {h && evHover == null && (
          <div className="card pointer-events-none absolute z-10 px-3 py-2 t-micro"
               style={{ left: Math.min(hover.x + 10, Math.max(width - 232, 0)), top: 30, width: 222 }}>
            <div className="font-semibold num">{pointName(h)}
              {h.mode === "day" && h.slotCount ? ` · ${h.slotCount}회차 평균` : ""}</div>
            <div className="mt-1 space-y-0.5">
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5">
                  <span style={{ background: "var(--chart-line-listed)", width: 12, height: 2, display: "inline-block", borderRadius: 1 }} />
                  <span style={{ color: "var(--text-secondary)" }}>등록 대표가</span>
                </span>
                <span className="num font-semibold">{h.avgPrice != null ? `${fmtComma(Math.round(h.avgPrice))} 골드` : "미수집"}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-1.5">
                  <span style={{ background: "var(--chart-line-sold)", width: 12, height: 2, display: "inline-block", borderRadius: 1 }} />
                  <span style={{ color: "var(--text-secondary)" }}>{soldWindowLabel(h)}</span>
                </span>
                <span className="num font-semibold">{h.soldAvg != null ? `${fmtComma(Math.round(h.soldAvg))} 골드` : "없음"}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>등록 건수</span>
                <span className="num">{h.listing != null ? `${Math.round(h.listing).toLocaleString()}건` : "미수집"}</span>
              </div>
            </div>
            {h.backfill ? (
              <div className="mt-1" style={{ color: "var(--text-muted)" }}>과거 실거래 소급 수집 구간. 등록가·매물 수는 소급 불가</div>
            ) : h.missing ? (
              <div className="mt-1" style={{ color: "var(--text-muted)" }}>이 날은 수집 회차가 없습니다</div>
            ) : null}
          </div>
        )}
      </div>

      {/* 범례 + 마지막 값 직접 표기 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1.5 t-micro" style={{ color: "var(--text-secondary)" }}>
        {LINES.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <span style={{ background: l.color, width: 14, height: 2, display: "inline-block", borderRadius: 1 }} />
            {l.label}
          </span>
        ))}
        {hasBackfill && (
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke="var(--chart-line-sold)" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.6" /></svg>
            실거래(과거 소급 수집 구간)
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span style={{ borderLeft: "2px solid var(--chart-event)", height: 12, display: "inline-block", opacity: 0.55 }} />
          이벤트·패치
        </span>
        {lastListed && (
          <span className="ml-auto num" style={{ color: "var(--text-primary)" }}>
            최근 등록 대표가 <b>{fmtGold(lastListed.avgPrice)}</b> 골드 ({lastListed.date.slice(5)})
          </span>
        )}
      </div>

      <div className="px-2 pt-1 t-micro" style={{ color: "var(--text-muted)" }}>
        {mode === "day"
          ? "일 단위 보기는 그날 수집한 회차들의 평균입니다. 회차가 없는 날은 선을 잇지 않고 비워 둡니다."
          : "회차별 보기는 수집 회차 하나하나를 시각 위치에 그대로 찍습니다. 빠진 회차는 공백입니다."}
        {capped && " 실거래는 API 상한(최근 100건) 안에서 집계합니다."}
        {" 등록 대표가는 매물 단가의 중앙값입니다 (2026-08-30 이전 회차는 평균)."}
      </div>

      {/* 표 보기: 툴팁 없이도 모든 값을 읽을 수 있게 */}
      {tableOpen && (
        <div className="scroll-x mt-2 max-h-[320px] overflow-y-auto">
          <table className="plain" style={{ minWidth: 460 }}>
            <thead>
              <tr>
                <th>{mode === "day" ? "날짜" : "회차"}</th>
                <th className="r">등록 대표가</th>
                <th className="r">실거래 대표가</th>
                <th className="r">등록 건수</th>
              </tr>
            </thead>
            <tbody className="num">
              {[...points].reverse().map((p) => (
                <tr key={`${p.date}|${p.slot ?? "day"}`}>
                  <td>{pointName(p)}{p.backfill ? " (소급)" : ""}</td>
                  <td className="r">{p.avgPrice != null ? fmtComma(Math.round(p.avgPrice)) : "미수집"}</td>
                  <td className="r">{p.soldAvg != null ? fmtComma(Math.round(p.soldAvg)) : "없음"}</td>
                  <td className="r">{p.listing != null ? Math.round(p.listing).toLocaleString() : "미수집"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
