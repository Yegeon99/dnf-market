// B4 검수용 스크린샷: 데스크톱 1440 / 모바일 390, 화면 4종.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:4173";
const OUT = "../dev/shots";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["overview", "/"],
  ["briefings", "/briefings"],
  ["methodology", "/methodology"],
];
const SIZES = [["desktop", 1440, 1000], ["mobile", 390, 844]];

const browser = await chromium.launch();
const errors = [];
for (const [sizeName, width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${sizeName} ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${sizeName} ${e.message}`));

  for (const [name, path] of ROUTES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    // 가로 스크롤바가 생기면 안 된다 (본문이 화면 밖으로 새는 신호)
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) errors.push(`${sizeName} ${path}: 가로 넘침 ${overflow}px`);
    await page.screenshot({ path: `${OUT}/${sizeName}-${name}.png`, fullPage: true });
    console.log(`찍음: ${sizeName}-${name}.png (가로 넘침 ${overflow}px)`);
  }

  // 아이템 상세: 첫 히트맵 타일을 눌러 들어간다
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const tile = page.locator(".heat-tile").first();
  if (await tile.count()) {
    await tile.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${sizeName}-item.png`, fullPage: true });
    console.log(`찍음: ${sizeName}-item.png (${page.url().split("/").pop().slice(0, 12)}…)`);
  }

  // 키보드 접근 확인: Tab 첫 대상이 본문 바로가기인가
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => document.activeElement?.className + "|" + document.activeElement?.textContent?.trim().slice(0, 12));
  console.log(`${sizeName} 첫 Tab 대상: ${first}`);
  if (!String(first).includes("skip-link")) errors.push(`${sizeName}: 첫 Tab이 본문 바로가기가 아님`);

  await ctx.close();
}
await browser.close();

if (errors.length) {
  console.log("\n문제:\n" + errors.map((e) => "  - " + e).join("\n"));
  process.exit(1);
}
console.log("\n콘솔 오류 0건, 가로 넘침 0건, 본문 바로가기 정상");
