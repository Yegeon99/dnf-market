// 오늘의 등락 순위: 가격 기준 상승·하락 TOP 5 랭킹 보드 (좌우 2단)
// 매물 수 급변은 제외하고 평균 등록가 변동만 순위화한다
import { Link, useNavigate } from "react-router-dom";
import { fmtGold, fmtSignedPct } from "../lib/data";

function Row({ rank, c, dir, maxAbs }) {
  const navigate = useNavigate();
  const first = rank === 1;
  const color = dir === "up" ? "var(--up)" : "var(--down)";
  const tint = dir === "up" ? "var(--heat-up-1)" : "var(--heat-down-1)";
  const ratio = maxAbs > 0 ? Math.abs(c.changePct) / maxAbs : 0;
  return (
    <button
      onClick={() => navigate(`/item/${c.itemId}`)}
      className="card-lift flex w-full cursor-pointer items-center gap-3 rounded px-3 text-left"
      style={{ background: first ? tint : "transparent", paddingTop: first ? 10 : 6, paddingBottom: first ? 10 : 6 }}
      aria-label={`${rank}위 ${c.name}, 전일 대비 ${fmtSignedPct(c.changePct)}`}
    >
      <span className="num shrink-0 text-center font-bold"
            style={{ width: 26, fontSize: first ? 24 : 19, color: first ? color : "var(--text-muted)" }}>
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold leading-snug"
              style={{ fontSize: first ? 18 : 16, color: "var(--text-primary)" }}>
          {c.name}
        </span>
        <span className="num block text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          {fmtGold(c.avgPrice)} 골드
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1" style={{ width: 108 }}>
        <span className="num font-bold leading-none" style={{ fontSize: first ? 20 : 18, color }}>
          {fmtSignedPct(c.changePct)}
        </span>
        <span className="block h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--bg-sunken)" }} aria-hidden="true">
          <span className="block h-full rounded-full"
                style={{ width: `${Math.max(ratio * 100, 4)}%`, background: color, marginLeft: "auto" }} />
        </span>
      </span>
    </button>
  );
}

function Column({ title, list, dir }) {
  const maxAbs = list.length ? Math.max(...list.map((c) => Math.abs(c.changePct))) : 0;
  return (
    <div className="min-w-0">
      <h3 className="m-0 mb-1.5 flex items-center gap-1.5 text-sm font-bold"
          style={{ color: dir === "up" ? "var(--up)" : "var(--down)" }}>
        {title}
      </h3>
      {list.length === 0 ? (
        <p className="m-0 px-3 py-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
          오늘 {dir === "up" ? "상승" : "하락"} 품목이 없습니다.
        </p>
      ) : (
        <div className="space-y-0.5">
          {list.map((c, i) => <Row key={c.itemId} rank={i + 1} c={c} dir={dir} maxAbs={maxAbs} />)}
        </div>
      )}
    </div>
  );
}

export default function RankBoard({ ups, downs }) {
  return (
    <section className="card rise px-3 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h2 className="t-section m-0">오늘의 등락 순위 <span className="text-[13px] font-normal" style={{ color: "var(--text-muted)", fontFamily: "Pretendard Variable, Pretendard, sans-serif" }}>(전일 대비 평균 등록가 기준, 클릭 시 상세)</span></h2>
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Column title="가장 많이 오른 품목 TOP 5" list={ups.slice(0, 5)} dir="up" />
        <Column title="가장 많이 내린 품목 TOP 5" list={downs.slice(0, 5)} dir="down" />
      </div>
      <p className="m-0 mt-2.5 border-t px-1 pt-2 text-[13px]" style={{ color: "var(--text-muted)", borderColor: "var(--hairline)" }}>
        가격이 아닌 매물 수 변동은 여기서 제외합니다. <Link to="/briefings">브리핑의 이상 변동 목록</Link>에서 확인할 수 있습니다.
      </p>
    </section>
  );
}
