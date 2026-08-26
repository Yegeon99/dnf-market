// 오버뷰 히어로 밴드: 좌측 프로젝트 정체성 + 파이프라인 상태, 우측 3D 마켓 지형도.
// 3D는 뷰포트 진입 + 유휴 시점에만 로드하고, reduced-motion·모바일·WebGL 미지원은
// 정적 미니 히트맵으로 폴백한다 (같은 실데이터).
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusStrip from "./StatusStrip";
import { heatColor, fmtSignedPct } from "../lib/data";

const MarketTerrain = lazy(() => import("./three/MarketTerrain"));

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 폴백: 같은 데이터를 정적 미니 히트맵 그리드로 */
function StaticTerrain({ cells }) {
  const navigate = useNavigate();
  return (
    <div className="grid h-full content-center gap-[3px] px-2" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
         aria-label="품목별 전일 등락 미니 히트맵">
      {cells.map((c) => {
        const { bg } = heatColor(c.changePct);
        return (
          <button key={c.itemId} onClick={() => navigate(`/item/${c.itemId}`)}
                  className="heat-tile aspect-square w-full cursor-pointer"
                  style={{ background: bg }}
                  title={`${c.name} ${c.changePct == null ? "비교 전" : fmtSignedPct(c.changePct)}`}
                  aria-label={`${c.name} ${c.changePct == null ? "비교 전" : fmtSignedPct(c.changePct)}`} />
        );
      })}
    </div>
  );
}

function TerrainSlot({ cells }) {
  const ref = useRef(null);
  const [mode, setMode] = useState("wait"); // wait | 3d | static
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.innerWidth < 768;
    setReduceMotion(reduce);
    if (reduce || narrow || !webglAvailable()) { setMode("static"); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        io.disconnect();
        const start = () => setMode("3d");
        if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 1200 });
        else setTimeout(start, 180);
      }
    }, { rootMargin: "80px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative h-[236px] w-full sm:h-full">
      {mode === "3d" ? (
        <Suspense fallback={<StaticTerrain cells={cells} />}>
          <MarketTerrain cells={cells} reduceMotion={reduceMotion} />
        </Suspense>
      ) : (
        <StaticTerrain cells={cells} />
      )}
    </div>
  );
}

export default function HeroBand({ cells, rows, briefings, date }) {
  return (
    <section className="card hero-grid-bg rise overflow-hidden">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-w-0 flex-col gap-2.5 px-4 py-4">
          <div>
            <h1 className="t-title m-0" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)" }}>아라드 거래소 관제실</h1>
            <p className="m-0 mt-1 text-sm" style={{ color: "var(--text-secondary)", maxWidth: 460 }}>
              던전앤파이터 경매장 31품목을 하루 6회 수집하고, 이상 변동을 AI가 해석해
              매일 브리핑을 발행하는 무인 분석 시스템입니다.
            </p>
            <p className="m-0 mt-1 text-[13px] num" style={{ color: "var(--text-muted)" }}>
              기준일 {date ?? "집계 전"} · KST 하루 6회 수집
            </p>
          </div>
          <div className="mt-auto">
            <StatusStrip rows={rows} briefings={briefings} bare />
          </div>
        </div>
        <div className="relative border-t sm:border-l sm:border-t-0" style={{ borderColor: "var(--hairline)" }}>
          <div className="absolute left-3 top-2 z-10 text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>
            마켓 지형도 <span className="font-normal">높이 = 현재가 · 색 = 전일 등락</span>
          </div>
          <TerrainSlot cells={cells} />
        </div>
      </div>
    </section>
  );
}
