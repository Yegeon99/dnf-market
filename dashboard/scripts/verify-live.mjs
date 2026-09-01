// 배포본 최종 검수: 전 화면을 실제로 렌더해 옛 이름 잔존·깨진 링크·문구·폰트를 훑는다.
//
// 실행: node scripts/verify-live.mjs            (기본 https://dnf-market.vercel.app)
//       BASE=http://localhost:4173 node scripts/verify-live.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = (process.env.BASE ?? "https://dnf-market.vercel.app").replace(/\/$/, "");
const OUT = process.env.OUT ?? "../dev/shots/live";
mkdirSync(OUT, { recursive: true });

// 옛 이름 흔적. 화면 텍스트와 HTML 소스 양쪽에서 찾는다
const STALE = [
  ["DNF Market Analyst", /DNF\s*Market\s*Analyst/i],
  ["Market Analyst", /Market\s*Analyst/i],
  ["마켓 애널리스트", /마켓\s*애널리스트/],
  ["애널리스트", /애널리스트/],
  ["dnf-market-analyst", /dnf-market-analyst/i],
  ["arad-census", /arad-census/i],
];
// 줄표(em·en dash)와 하이픈 연결. 프로젝트 문구 규칙
const DASH = /[—–]/;
const SIZES = [["desktop", 1440, 1000], ["mobile", 390, 844]];

const problems = [];
const add = (where, msg) => problems.push(`${where}: ${msg}`);

const browser = await chromium.launch();
const ctx0 = await browser.newContext();
const probe = await ctx0.newPage();

// 화면 목록: 아이템 상세는 오버뷰에서 실제 타일을 눌러 얻는다
await probe.goto(`${BASE}/`, { waitUntil: "networkidle" });
await probe.waitForTimeout(600);
await probe.locator(".heat-tile").first().click();
await probe.waitForTimeout(800);
const itemPath = new URL(probe.url()).pathname;
await ctx0.close();

const ROUTES = [
  ["overview", "/"],
  ["item", itemPath],
  ["briefings", "/briefings"],
  ["methodology", "/methodology"],
];

for (const [sizeName, width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") add(sizeName, `콘솔 오류 ${m.text()}`); });
  page.on("pageerror", (e) => add(sizeName, `스크립트 오류 ${e.message}`));

  for (const [name, path] of ROUTES) {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    if (!res || res.status() >= 400) add(`${sizeName} ${path}`, `HTTP ${res?.status()}`);
    await page.waitForTimeout(700);

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);
    for (const [label, re] of STALE) {
      if (re.test(text)) add(`${sizeName} ${path}`, `화면 텍스트에 옛 이름 "${label}"`);
      if (re.test(html)) add(`${sizeName} ${path}`, `HTML 소스에 옛 이름 "${label}"`);
    }

    // 줄표 스캔: 화면에 실제로 보이는 문구만
    for (const line of text.split("\n")) {
      if (DASH.test(line)) add(`${sizeName} ${path}`, `줄표 사용 "${line.trim().slice(0, 60)}"`);
    }

    // 13px 미만 글자
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        if (!el.textContent?.trim() || el.children.length) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs && fs < 13) out.push(`${el.tagName} ${fs}px "${el.textContent.trim().slice(0, 24)}"`);
      }
      return [...new Set(out)].slice(0, 6);
    });
    small.forEach((s) => add(`${sizeName} ${path}`, `13px 미만 글자 ${s}`));

    // 깨진 이미지
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
    broken.forEach((src) => add(`${sizeName} ${path}`, `깨진 이미지 ${src}`));

    // 가로 넘침
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) add(`${sizeName} ${path}`, `가로 넘침 ${overflow}px`);

    await page.screenshot({ path: `${OUT}/${sizeName}-${name}.png`, fullPage: true });
    console.log(`찍음: ${sizeName}-${name}.png`);
  }
  await ctx.close();
}

// 링크 전수 확인 (오버뷰 + 방법론에 바깥 링크가 모여 있다)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const seen = new Set();
  for (const [, path] of ROUTES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, text: a.textContent.trim() })));
    for (const { href, text } of hrefs) {
      if (seen.has(href) || href.startsWith("mailto:")) continue;
      seen.add(href);
      try {
        const r = await page.request.get(href, { timeout: 20000, maxRedirects: 5 });
        const ok = r.status() < 400;
        console.log(`${ok ? "링크 OK " : "링크 실패"} ${r.status()} ${href}  「${text.slice(0, 24)}」`);
        if (!ok) add("링크", `${r.status()} ${href}`);
      } catch (e) {
        add("링크", `요청 실패 ${href} (${e.message.slice(0, 40)})`);
      }
    }
  }
  // OG 이미지
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const og = await page.evaluate(() =>
    document.querySelector('meta[property="og:image"]')?.content ?? null);
  const ogUrl = await page.evaluate(() =>
    document.querySelector('meta[property="og:url"]')?.content ?? null);
  console.log(`og:url = ${ogUrl}`);
  if (og) {
    const r = await page.request.get(og, { timeout: 20000 });
    console.log(`og:image ${r.status()} ${og}`);
    if (r.status() >= 400) add("OG", `og:image ${r.status()} ${og}`);
  } else add("OG", "og:image 태그 없음");
  if (ogUrl && !ogUrl.includes("dnf-market.vercel.app")) add("OG", `og:url이 새 도메인이 아님 ${ogUrl}`);
  await ctx.close();
}

await browser.close();

if (problems.length) {
  console.log(`\n문제 ${problems.length}건:`);
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("\n옛 이름 잔존 0, 콘솔 오류 0, 깨진 이미지·링크 0, 줄표 0, 13px 미만 0, 가로 넘침 0");
