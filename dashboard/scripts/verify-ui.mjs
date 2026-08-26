// 게이트 3 검증: 4화면 × 2뷰포트 스크린샷 + 콘솔 오류 수집 + 수치 정합성 검사
// 실행: npm run build 후 `node scripts/verify-ui.mjs` (vite preview를 스스로 띄운다)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const shotDir = join(root, "..", "dev", "screenshots");
mkdirSync(shotDir, { recursive: true });

const BASE = "http://localhost:4173";
const data = {
  items: JSON.parse(readFileSync(join(root, "public/data/items.json"), "utf-8")).items,
  anomalies: JSON.parse(readFileSync(join(root, "public/data/anomalies.json"), "utf-8")).anomalies,
  briefings: JSON.parse(readFileSync(join(root, "public/data/briefings.json"), "utf-8")).briefings,
  ts: JSON.parse(readFileSync(join(root, "public/data/timeseries.json"), "utf-8")).rows,
};
const latestDate = data.ts.map((r) => r.date).sort().at(-1);
const latestBriefing = [...data.briefings].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
const firstItem = data.items[0];

// fmtGold와 동일 공식 (정합성 비교용)
function fmtGold(v) {
  if (v == null) return "미수집";
  if (v >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1)}억`;
  if (v >= 1e4) return `${Math.round(v / 1e4).toLocaleString()}만`;
  return Math.round(v).toLocaleString();
}
// 아이템 상세 카드 기대값: 해당 품목의 마지막 유효 슬롯 avgUnitPrice
function lastAvgPrice(itemId) {
  const order = { night: 0, am: 1, pm: 2 };
  const mine = data.ts
    .filter((r) => r.itemId === itemId && r.avgUnitPrice != null)
    .sort((a, b) => (a.date === b.date ? order[a.slot] - order[b.slot] : a.date < b.date ? -1 : 1));
  return mine.at(-1)?.avgUnitPrice ?? null;
}

const preview = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], {
  cwd: root, shell: true, stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 2500));

const pages = [
  { name: "overview", path: "/" },
  { name: "item-detail", path: `/item/${firstItem.itemId}` },
  { name: "briefings", path: "/briefings" },
  { name: "methodology", path: "/methodology" },
];
const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const consoleErrors = [];
const checks = [];
const browser = await chromium.launch();

try {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(`[${vp.name}] ${page.url()} — ${m.text()}`);
    });
    page.on("pageerror", (e) => consoleErrors.push(`[${vp.name}] ${page.url()} — pageerror: ${e.message}`));

    for (const p of pages) {
      await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(shotDir, `${p.name}_${vp.name}.png`), fullPage: true });
    }

    // 수치 정합성 (데스크톱 1회만)
    if (vp.name === "desktop-1440") {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      // 히트맵: 전 품목 타일 수 + 한 화면(뷰포트) 수납 여부
      const tiles = await page.$$eval("[data-heat] button", (els) => els.length);
      checks.push([`오버뷰: 히트맵 타일 ${data.items.length}개`, tiles === data.items.length]);
      // 정보 설계 개선(2026-08): 첫 화면(1440×900)은 "오늘의 이야기" = 브리핑 헤드라인 + 등락 순위 보드.
      // 히트맵은 스크롤 아래 배치를 허용한다 (가독성 우선).
      const fold = await page.evaluate(() => {
        const heads = [...document.querySelectorAll("h2")];
        const brief = heads.find((h) => h.textContent.includes("데일리 브리핑")) ??
          [...document.querySelectorAll("a")].find((a) => a.textContent.includes("데일리 브리핑"));
        const rank = heads.find((h) => h.textContent.includes("오늘의 등락 순위"));
        const inView = (el) => el && el.getBoundingClientRect().top < window.innerHeight - 60;
        return { brief: inView(brief), rank: inView(rank) };
      });
      checks.push(["오버뷰: 브리핑 카드 첫 화면 노출", fold.brief]);
      checks.push(["오버뷰: 등락 순위 보드 첫 화면 노출", fold.rank]);
      await page.screenshot({ path: join(shotDir, "overview_viewport-1440x900.png") });
      const body = await page.innerText("body");
      checks.push(["오버뷰: 추적 품목 수", body.includes(`${data.items.length}종`)]);
      const todayCnt = data.anomalies.filter((a) => a.date === latestDate).length;
      checks.push(["오버뷰: 오늘 이상 변동 수", body.includes(`${todayCnt}건`)]);
      checks.push(["오버뷰: 기준일 표기", body.includes(latestDate)]);
      checks.push(["오버뷰: 최신 브리핑 헤드라인", body.includes(latestBriefing.headline)]);

      await page.goto(`${BASE}/item/${firstItem.itemId}`, { waitUntil: "networkidle" });
      const detail = await page.innerText("body");
      checks.push(["상세: 품목명", detail.includes(firstItem.name)]);
      checks.push(["상세: 등록 평균가 표기", detail.includes(fmtGold(lastAvgPrice(firstItem.itemId)))]);

      await page.goto(`${BASE}/briefings`, { waitUntil: "networkidle" });
      const brf = await page.innerText("body");
      checks.push(["브리핑: 최신 헤드라인", brf.includes(latestBriefing.headline)]);
      checks.push(["브리핑: 3줄 요약 1행", brf.includes(latestBriefing.summary_3lines[0])]);

      await page.goto(`${BASE}/methodology`, { waitUntil: "networkidle" });
      const met = await page.innerText("body");
      checks.push(["방법론: 품목 수 명시", met.includes(`${data.items.length}종`)]);
      checks.push(["방법론: Neople API 고지", met.includes("Neople 오픈 API")]);
      checks.push(["푸터: 팬메이드 고지", met.includes("비공식 팬메이드")]);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  preview.kill();
  // Windows: npx가 자식으로 vite를 띄우므로 잔여 프로세스 정리
  spawn("taskkill", ["/F", "/T", "/PID", String(preview.pid)], { shell: true, stdio: "ignore" });
}

console.log("=== 수치 정합성 ===");
let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) fail++;
}
console.log(`\n=== 콘솔 오류 ${consoleErrors.length}건 ===`);
consoleErrors.forEach((e) => console.log(e));
console.log(`\n스크린샷 → ${shotDir}`);
process.exit(fail || consoleErrors.length ? 1 : 0);
