// 공용 소형 컴포넌트: 등락 텍스트, 뱃지, 스켈레톤, 빈 상태, 카운트업, 스파크라인
import { useEffect, useRef, useState } from "react";
import { fmtPct, pctColor } from "../lib/data";

export function Change({ value, className = "" }) {
  return (
    <span className={`num font-semibold ${className}`} style={{ color: pctColor(value) }}>
      {fmtPct(value)}
    </span>
  );
}

const SEV_LABEL = { high: "높음", mid: "중간", low: "낮음" };
export function SeverityBadge({ severity }) {
  const bg = { high: "var(--raw-red-050)", mid: "var(--gold-soft)", low: "var(--bg-sunken)" }[severity] || "var(--bg-sunken)";
  const fg = { high: "var(--up)", mid: "var(--gold-text)", low: "var(--text-secondary)" }[severity];
  return (
    <span className="px-1.5 py-0.5 text-[13px] font-medium" style={{ background: bg, color: fg, borderRadius: "var(--badge-radius)" }}>
      심각도 {SEV_LABEL[severity] || severity}
    </span>
  );
}

export function LowLiquidityBadge() {
  return (
    <span
      className="px-1.5 py-0.5 text-[13px] font-medium"
      style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)", border: "1px solid var(--hairline)", borderRadius: "var(--badge-radius)" }}
      title="매물 수가 적어 소수 등록·거래만으로 지표가 크게 움직일 수 있는 품목입니다. 변동 해석에 주의하세요."
    >
      저유동
    </span>
  );
}

export function ConfidenceBadge({ confidence }) {
  const strong = confidence === "확정";
  return (
    <span
      className="px-1.5 py-0.5 text-[13px] font-medium"
      style={{
        background: strong ? "var(--accent-soft)" : "var(--bg-sunken)",
        color: strong ? "var(--accent)" : "var(--text-secondary)",
        borderRadius: "var(--badge-radius)",
      }}
    >
      {confidence}
    </span>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />;
}

export function Empty({ children }) {
  return (
    <div className="card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
      {children}
    </div>
  );
}

/** 숫자 카운트업: 0에서 목표값까지 짧게 올라간다. 모션 축소 설정이면 즉시 표시 */
export function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (target == null || done.current) { setValue(target ?? 0); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target); done.current = true; return;
    }
    done.current = true;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function CountUpNum({ value, className = "" }) {
  const v = useCountUp(value);
  return <span className={`num ${className}`}>{value == null ? "집계 전" : v.toLocaleString()}</span>;
}

/** 미니 스파크라인: 최근 값 추세를 한 줄로. 점 2개 미만이면 그리지 않는다 */
export function Sparkline({ values = [], width = 80, height = 26, color = "var(--accent)", strokeWidth = 1.5, area = false }) {
  const pts = values.filter((v) => v != null);
  if (pts.length < 2) return null;
  const lo = Math.min(...pts), hi = Math.max(...pts);
  const span = hi - lo || 1;
  const step = width / (pts.length - 1);
  const yAt = (v) => height - 4 - ((v - lo) / span) * (height - 8);
  const path = pts.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  const lastY = yAt(pts[pts.length - 1]);
  return (
    <svg width={width} height={height} aria-hidden="true" className="shrink-0">
      {area && (
        <path d={`${path} L${width},${height} L0,${height} Z`} fill={color} opacity="0.1" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.9" />
      <circle cx={width} cy={lastY} r={strokeWidth + 1} fill={color} />
    </svg>
  );
}
