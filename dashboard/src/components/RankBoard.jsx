// 오늘의 등락 순위: 가격 기준 상승·하락 TOP 5 랭킹 보드 (좌우 2단).
// 1위는 테두리나 배지가 아니라 크기와 굵기로만 구분한다. 매물 수 급변은 제외
import { Link, useNavigate } from "react-router-dom";
import { fmtGold, fmtSignedPct } from "../lib/data";
import { Sparkline } from "./ui";

function Gauge({ ratio, color, height = 5 }) {
  return (
    <span className="block w-full overflow-hidden rounded-full" style={{ height, background: "var(--bg-sunken)" }} aria-hidden="true">
      <span className="gauge-fill block h-full rounded-full"
            style={{ width: `${Math.max(ratio * 100, 4)}%`, background: color }} />
    </span>
  );
}

function ChampionRow({ c, dir, trend }) {
  const navigate = useNavigate();
  const color = dir === "up" ? "var(--up)" : "var(--down)";
  return (
    <button
      onClick={() => navigate(`/item/${c.itemId}`)}
      className="card-lift flex w-full cursor-pointer items-center gap-3 rounded px-3 py-3 text-left"
    >
      <span className="num shrink-0 text-center text-[26px] font-extrabold" style={{ width: 30, color: "var(--accent-deep)" }}>1<span className="sr-only">위</span></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[18px] font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
          {c.name}
        </span>
        <span className="num block text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          {fmtGold(c.avgPrice)} 골드 · 최근 7일
        </span>
        {trend && trend.filter((v) => v != null).length >= 2 && (
          <span className="mt-1 block"><Sparkline values={trend} width={132} height={30} color={color} strokeWidth={1.8} area /></span>
        )}
      </span>
      <span className="t-numeral shrink-0" style={{ color, fontSize: "clamp(30px, 2.6vw, 38px)" }}>
        {fmtSignedPct(c.changePct)}
      </span>
    </button>
  );
}

function Row({ rank, c, dir, maxAbs }) {
  const navigate = useNavigate();
  const color = dir === "up" ? "var(--up)" : "var(--down)";
  const ratio = maxAbs > 0 ? Math.abs(c.changePct) / maxAbs : 0;
  return (
    <button
      onClick={() => navigate(`/item/${c.itemId}`)}
      className="card-lift flex w-full cursor-pointer items-center gap-3 rounded px-3 py-1.5 text-left"
    >
      <span className="num shrink-0 text-center text-[19px] font-medium" style={{ width: 30, color: "var(--text-muted)" }}>
        {rank}<span className="sr-only">위</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
          {c.name}
        </span>
        <span className="num block text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
          {fmtGold(c.avgPrice)} 골드
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1" style={{ width: 112 }}>
        <span className="num text-[18px] font-bold leading-none" style={{ color }}>
          {fmtSignedPct(c.changePct)}
        </span>
        <Gauge ratio={ratio} color={color} />
      </span>
    </button>
  );
}

function Column({ title, list, dir, trendFor }) {
  const maxAbs = list.length ? Math.max(...list.map((c) => Math.abs(c.changePct))) : 0;
  return (
    <div className="min-w-0">
      <h3 className="m-0 mb-2 text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h3>
      {list.length === 0 ? (
        <p className="m-0 px-3 py-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
          오늘 {dir === "up" ? "상승" : "하락"} 품목이 없습니다.
        </p>
      ) : (
        <div className="space-y-1">
          <ChampionRow c={list[0]} dir={dir} trend={trendFor ? trendFor(list[0].itemId) : null} />
          {list.slice(1).map((c, i) => <Row key={c.itemId} rank={i + 2} c={c} dir={dir} maxAbs={maxAbs} />)}
        </div>
      )}
    </div>
  );
}

export default function RankBoard({ ups, downs, trendFor }) {
  return (
    <div className="card px-3 py-3">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Column title="가장 많이 오른 품목 TOP 5" list={ups.slice(0, 5)} dir="up" trendFor={trendFor} />
        <Column title="가장 많이 내린 품목 TOP 5" list={downs.slice(0, 5)} dir="down" trendFor={trendFor} />
      </div>
      <p className="m-0 mt-2.5 border-t px-1 pt-2 text-[13px]" style={{ color: "var(--text-muted)", borderColor: "var(--hairline)" }}>
        가격이 아닌 매물 수 변동은 여기서 제외합니다. <Link to="/briefings">브리핑의 이상 변동 목록</Link>에서 확인할 수 있습니다.
      </p>
    </div>
  );
}
