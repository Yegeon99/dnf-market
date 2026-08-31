import { useEffect, useState } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
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

function Shell({ children }) {
  return <div className="mx-auto w-full max-w-[1280px] px-4 py-5 lg:px-6">{children}</div>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-14" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-64" />
    </div>
  );
}

/** 오버뷰 전용 스켈레톤.
 *  실제 렌더 후 아래 요소가 밀리지 않도록 섹션 구조와 실측 높이(index.css의 sk-*)를
 *  그대로 예약한다. 예약을 안 하면 마운트 교체 때 푸터가 통째로 내려가 CLS가 튄다. */
function SkSection({ band, note, body }) {
  return (
    <section className={`sec${band ? " sec-band" : ""}`}>
      <div className="sec-inner">
        <div className="sec-head">
          <Skeleton className="h-[13px] w-24" />
          <Skeleton className="mt-1.5 h-7 w-52" />
          {note && <Skeleton className="mt-2 h-[14px] w-72 max-w-full" />}
        </div>
        <Skeleton className={body} />
      </div>
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <div className="sec-inner py-4"><Skeleton className="sk-hero" /></div>
      <div className="status-bar" />
      <SkSection body="sk-brief" />
      <SkSection band note body="sk-rank" />
      <SkSection body="sk-kpi" />
      <SkSection band note body="sk-heat" />
    </>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const isOverview = useLocation().pathname === "/";

  useEffect(() => {
    loadAll().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-40"
        style={{ background: "var(--nav-bg)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--hairline)" }}
      >
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 lg:px-6">
          <NavLink to="/" className="no-underline">
            <span className="t-eyebrow" style={{ color: "var(--accent)" }}>DNF MARKET</span>
          </NavLink>
          <nav className="flex items-center gap-1 text-sm" aria-label="화면 이동">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `nav-pill ${isActive ? "nav-pill-on" : ""}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <span className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 sm:flex" title="사람 손 없이 매일 자동 수집·발행 중">
              <span className="pulse inline-block h-2 w-2 rounded-full" style={{ background: "var(--statuslight-ok)" }} aria-hidden="true" />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>무인 운영 중</span>
            </span>
            <a href="https://github.com/Yegeon99/dnf-market" target="_blank" rel="noreferrer"
               title="GitHub 저장소" aria-label="GitHub 저장소" className="flex items-center">
              <svg viewBox="0 0 16 16" width="18" height="18" fill="var(--text-secondary)" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
              </svg>
            </a>
          </span>
        </div>
      </header>

      <main className="w-full flex-1">
        {error ? (
          <Shell><Empty>데이터를 불러오지 못했습니다: {error}</Empty></Shell>
        ) : !data ? (
          isOverview ? <OverviewSkeleton /> : <Shell><LoadingSkeleton /></Shell>
        ) : (
          <Routes>
            {/* 오버뷰만 풀폭 밴드를 직접 그리므로 컨테이너를 스스로 관리한다 */}
            <Route path="/" element={<Overview data={data} />} />
            <Route path="/item/:id" element={<Shell><ItemDetail data={data} /></Shell>} />
            <Route path="/briefings" element={<Shell><Briefings data={data} /></Shell>} />
            <Route path="/methodology" element={<Shell><Methodology data={data} /></Shell>} />
            <Route path="*" element={<Shell><Empty>페이지를 찾을 수 없습니다.</Empty></Shell>} />
          </Routes>
        )}
      </main>

      <footer style={{ borderTop: "1px solid var(--hairline)" }}>
        <div className="mx-auto max-w-[1280px] px-4 py-4 lg:px-6">
          <p className="t-small m-0">본 서비스는 Neople 오픈 API에서 제공받은 데이터를 일부 가공하여 활용하고 있습니다.</p>
          <p className="t-small m-0 mt-0.5">
            비공식 팬메이드 포트폴리오이며 ㈜네오플·넥슨과 무관합니다. 게임 그래픽은 Neople 오픈 API가 제공하는 아이템 아이콘만 사용합니다.
            시리즈의 다른 프로젝트: <a href="https://dnf-census.vercel.app" target="_blank" rel="noreferrer">DNF Census · 캐릭터 표본조사</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
