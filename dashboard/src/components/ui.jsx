// 공용 소형 컴포넌트: 등락 텍스트(색+부호 병기), 뱃지, 스켈레톤, 빈 상태
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
  const bg = { high: "#F6E3E3", mid: "#F3EAD8", low: "#E9EDF3" }[severity] || "#E9EDF3";
  const fg = { high: "var(--up)", mid: "var(--warn)", low: "var(--text-secondary)" }[severity];
  return (
    <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ background: bg, color: fg }}>
      심각도 {SEV_LABEL[severity] || severity}
    </span>
  );
}

export function LowLiquidityBadge() {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ background: "#EEF1F6", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
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
      className="rounded px-1.5 py-0.5 text-xs font-medium"
      style={{
        background: strong ? "#E2EAF7" : "#F1F2F5",
        color: strong ? "var(--accent)" : "var(--text-secondary)",
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
