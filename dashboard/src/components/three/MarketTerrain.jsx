// 마켓 지형도: 31개 추적 품목을 3D 기둥 그리드로 표현한다.
// 높이 = 현재가(로그 스케일), 색 = 전일 등락 팔레트, 등락이 큰 기둥은 미세 발광.
// 장식이 아니라 데이터 표현이다. 실데이터(timeseries 최신값)만 그린다.
import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useNavigate } from "react-router-dom";
import { fmtGold, fmtSignedPct } from "../../lib/data";

// three는 CSS 변수를 읽지 못하므로 토큰 primitive 값을 그대로 대응시킨다 (index.css 참조)
const HEAT_HEX = {
  none: "#F3F2EE", flat: "#EFEEE9",
  up: ["#F7E5E3", "#EEC5C1", "#DE9490", "#B84F4A", "#A83B37"],
  down: ["#E3EAF6", "#C4D4EC", "#99B4DD", "#4F74B5", "#30549B"],
};
const INK = "#1B2130";

function heatHex(pct) {
  if (pct == null) return HEAT_HEX.none;
  const a = Math.abs(pct);
  if (a < 0.5) return HEAT_HEX.flat;
  const lv = a < 2 ? 0 : a < 5 ? 1 : a < 10 ? 2 : a < 20 ? 3 : 4;
  return (pct > 0 ? HEAT_HEX.up : HEAT_HEX.down)[lv];
}

const COLS = 7;
const GAP = 1.14;

function Bars({ cells, reduceMotion, onHover, onLeave, onPick }) {
  const group = useRef(null);
  const meshes = useRef([]);
  const [hovered, setHovered] = useState(-1);

  useFrame(({ clock }) => {
    if (group.current && !reduceMotion) {
      // 완만한 자동 요잉: 호버 중에는 멈춰 읽기 편하게
      if (hovered < 0) group.current.rotation.y = Math.sin(clock.elapsedTime * 0.14) * 0.22;
      // 등락 큰 기둥 펄스 발광
      for (const m of meshes.current) {
        if (m?.userData.pulse) {
          m.material.emissiveIntensity = 0.12 + 0.1 * Math.sin(clock.elapsedTime * 2.6 + m.userData.phase);
        }
      }
    }
  });

  return (
    <group ref={group} rotation={[0, 0, 0]}>
      {cells.map((c, i) => {
        const col = i % COLS, row = Math.floor(i / COLS);
        const x = (col - (COLS - 1) / 2) * GAP;
        const z = (row - 2) * GAP;
        const on = hovered === i;
        return (
          <mesh
            key={c.itemId}
            ref={(el) => { meshes.current[i] = el; }}
            position={[x, c.h / 2, z]}
            userData={{ pulse: Math.abs(c.changePct ?? 0) >= 10, phase: i * 0.7 }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(i); onHover(c, e); document.body.style.cursor = "pointer"; }}
            onPointerMove={(e) => { e.stopPropagation(); onHover(c, e); }}
            onPointerOut={() => { setHovered(-1); onLeave(); document.body.style.cursor = ""; }}
            onClick={(e) => { e.stopPropagation(); onPick(c); }}
          >
            <boxGeometry args={[0.78, c.h, 0.78]} />
            <meshStandardMaterial
              color={on ? INK : c.color}
              emissive={c.color}
              emissiveIntensity={on ? 0.25 : 0}
              roughness={0.55}
              metalness={0.08}
            />
          </mesh>
        );
      })}
      {/* 바닥판: 종이 톤 */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[COLS * GAP + 1.2, 0.12, 5 * GAP + 1.2]} />
        <meshStandardMaterial color="#F3F2EE" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

export default function MarketTerrain({ cells, reduceMotion = false }) {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null); // {c, x, y}

  const prepared = useMemo(() => {
    const prices = cells.map((c) => c.avgPrice).filter((v) => v != null && v > 0);
    const lo = Math.log10(Math.min(...prices)), hi = Math.log10(Math.max(...prices));
    return cells.map((c) => {
      const t = c.avgPrice > 0 ? (Math.log10(c.avgPrice) - lo) / Math.max(hi - lo, 0.01) : 0;
      return { ...c, h: 0.5 + t * 2.9, color: heatHex(c.changePct) };
    });
  }, [cells]);

  const onHover = (c, e) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ c, x: Math.min(e.clientX - r.left + 12, r.width - 190), y: Math.max(e.clientY - r.top - 76, 4) });
  };

  return (
    <div ref={wrapRef} className="relative h-full w-full" aria-label="마켓 지형도: 품목별 현재가 높이와 전일 등락 색상의 3D 그리드">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 6.4, 11.6], fov: 27 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.95} />
        <directionalLight position={[4, 9, 6]} intensity={1.15} />
        <directionalLight position={[-6, 4, -4]} intensity={0.3} />
        <group position={[0, -1.5, 0]} scale={0.95}>
          <Bars cells={prepared} reduceMotion={reduceMotion}
                onHover={onHover} onLeave={() => setTip(null)}
                onPick={(c) => navigate(`/item/${c.itemId}`)} />
        </group>
      </Canvas>
      {tip && (
        <div className="card pointer-events-none absolute z-10 px-2.5 py-1.5 text-[13px]"
             style={{ left: tip.x, top: tip.y, width: 178 }}>
          <div className="truncate font-semibold">{tip.c.name}</div>
          <div className="num" style={{ color: "var(--text-secondary)" }}>{fmtGold(tip.c.avgPrice)} 골드</div>
          <div className="num font-semibold"
               style={{ color: tip.c.changePct == null ? "var(--text-muted)" : tip.c.changePct > 0 ? "var(--up)" : tip.c.changePct < 0 ? "var(--down)" : "var(--neutral)" }}>
            {tip.c.changePct == null ? "비교 전" : fmtSignedPct(tip.c.changePct)}
          </div>
        </div>
      )}
    </div>
  );
}
