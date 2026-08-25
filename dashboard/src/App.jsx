import { useEffect, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { loadAll } from "./lib/data";
import { Skeleton, Empty } from "./components/ui";
import Overview from "./pages/Overview";
import ItemDetail from "./pages/ItemDetail";
import Briefings from "./pages/Briefings";
import Methodology from "./pages/Methodology";

const NAV = [
  { to: "/", label: "마켓 오버뷰", end: true },
  { to: "/briefings", label: "브리핑" },
  { to: "/methodology", label: "방법론·정책" },
];

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAll().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
          <NavLink to="/" className="no-underline">
            <span className="text-base font-extrabold" style={{ color: "var(--text-primary)" }}>
              DNF <span style={{ color: "var(--accent)" }}>Market Analyst</span>
            </span>
          </NavLink>
          <nav className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className="no-underline"
                style={({ isActive }) => ({
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: isActive ? 700 : 400,
                })}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <a href="https://github.com/Yegeon99/dnf-market-analyst" target="_blank" rel="noreferrer"
             className="ml-auto" title="GitHub 저장소" aria-label="GitHub 저장소">
            <svg viewBox="0 0 16 16" width="20" height="20" fill="var(--text-secondary)" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
            </svg>
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4">
        {error ? (
          <Empty>데이터 로드 실패: {error}</Empty>
        ) : !data ? (
          <LoadingSkeleton />
        ) : (
          <Routes>
            <Route path="/" element={<Overview data={data} />} />
            <Route path="/item/:id" element={<ItemDetail data={data} />} />
            <Route path="/briefings" element={<Briefings data={data} />} />
            <Route path="/methodology" element={<Methodology data={data} />} />
            <Route path="*" element={<Empty>페이지를 찾을 수 없습니다.</Empty>} />
          </Routes>
        )}
      </main>

      <footer style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}>
        <div className="mx-auto max-w-[1400px] px-4 py-4 text-xs" style={{ color: "var(--text-muted)" }}>
          <p>본 서비스는 Neople 오픈 API에서 제공받은 데이터를 일부 가공하여 활용하고 있습니다.</p>
          <p className="mt-0.5">비공식 팬메이드 포트폴리오 — ㈜네오플·넥슨과 무관합니다. 게임 IP 아트워크를 사용하지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
}
