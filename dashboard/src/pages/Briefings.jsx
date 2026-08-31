// 화면 3 — 브리핑 아카이브: 날짜 목록(그날 최대 등락 병기) + 읽기 좋은 카드 상세.
// 같은 사유의 이상 변동은 그룹 카드로 접고, 변동률 게이지 바로 시각 비교
import { useMemo, useState } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Link, useSearchParams } from "react-router-dom";
import { publishChanges, fmtSignedPct, DEFINITION_CHANGED_AT } from "../lib/data";
import { ConfidenceBadge, Empty, SeverityBadge, Change, LowLiquidityBadge } from "../components/ui";
import { highlight, itemNamePool } from "../components/rich";
import { LIFT_SHADOW, REST_SHADOW, RING_OFF, RING_ON } from "../lib/motion-tokens";

function BulletIcon() {
  return (
    <svg viewBox="0 0 12 12" width="13" height="13" className="mt-[5px] shrink-0" aria-hidden="true">
      <path d="M2 6h6M5.5 3.5 8 6 5.5 8.5" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 변동률 크기 게이지 바 */
function Gauge({ pct, maxAbs, width = 96 }) {
  const ratio = maxAbs > 0 ? Math.abs(pct) / maxAbs : 0;
  const color = pct > 0 ? "var(--up)" : pct < 0 ? "var(--down)" : "var(--neutral)";
  return (
    <span className="inline-block h-[6px] overflow-hidden rounded-full align-middle"
          style={{ width, background: "var(--bg-sunken)" }} aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${Math.max(ratio * 100, 4)}%`, background: color }} />
    </span>
  );
}

const METRIC_LABEL = { avgPrice: "가격", listingCount: "매물 수" };

// 생성 방식 표기. template-fallback은 AI 호출이 형식을 어겨 규칙 기반으로 대체 발행한 날이다
const GEN_LABEL = {
  template: "규칙 기반(무비용)",
  "template-fallback": "규칙 기반 대체(AI 생성 실패)",
};

/** 같은 사유(지표·심각도·저유동·가설 문구)의 이상 변동을 그룹으로 묶는다 */
function groupAnomalies(list) {
  const map = new Map();
  for (const a of list) {
    const key = [a.metric, a.severity, !!a.lowLiquidity, a.ai_hypothesis?.text ?? ""].join("|");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }
  return [...map.values()].sort((a, b) => b.length - a.length);
}

function AnomalyRow({ a, maxAbs }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
      <Link to={`/item/${a.itemId}`} className="min-w-0 flex-1 truncate text-sm font-semibold">{a.itemName}</Link>
      <Change value={a.change_pct} className="t-body-lg" />
      <Gauge pct={a.change_pct} maxAbs={maxAbs} />
    </div>
  );
}

/** 주목해야 하는 요소라 등장할 때 한 번만 테두리가 켜졌다 꺼진다 (반복 깜빡임 없음) */
function AnomalyGroupCard({ group, maxAbs }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const listId = `anomaly-group-${group[0].id}`;
  const first = group[0];
  const hyp = first.ai_hypothesis;
  const title = `${first.lowLiquidity ? "저유동 " : ""}${METRIC_LABEL[first.metric] ?? first.metric} 변동 ${group.length}건`;
  const range = [...group].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
  return (
    <m.div className="rounded p-3" style={{ background: "var(--bg-sunken)" }}
      initial={reduce ? false : { boxShadow: RING_ON }}
      animate={{ boxShadow: RING_OFF }}
      transition={{ duration: 1.2, delay: 0.35, ease: "easeOut" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{title}</span>
        <SeverityBadge severity={first.severity} />
        {first.lowLiquidity && <LowLiquidityBadge />}
        {hyp && <ConfidenceBadge confidence={hyp.confidence} />}
      </div>
      {hyp && (
        <p className="m-0 mt-1 t-micro" style={{ color: "var(--text-secondary)" }}>
          {hyp.text}. 최대 변동은 <b>{range[0].itemName}</b> <Change value={range[0].change_pct} />.
          {hyp.evidence_urls?.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="ml-2"
               aria-label={`${title} 근거 공지 열기 (새 창)`}>근거 ↗</a>
          ))}
        </p>
      )}
      <button type="button" className="disclose mt-2" aria-expanded={open}
              aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        {open ? "품목별 목록 접기" : `품목별 목록 펼치기 (${group.length})`}
      </button>
      {open && (
        <div id={listId} className="mt-1.5 border-t pt-1.5" style={{ borderColor: "var(--hairline)" }}>
          {range.map((a) => <AnomalyRow key={a.id} a={a} maxAbs={maxAbs} />)}
        </div>
      )}
    </m.div>
  );
}

function AnomalySingleCard({ a, maxAbs }) {
  const reduce = useReducedMotion();
  return (
    <m.div className="rounded p-3" style={{ background: "var(--bg-sunken)" }}
      initial={reduce ? false : { boxShadow: RING_ON }}
      animate={{ boxShadow: RING_OFF }}
      transition={{ duration: 1.2, delay: 0.35, ease: "easeOut" }}>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/item/${a.itemId}`} className="text-sm font-semibold">{a.itemName}</Link>
        <span className="t-micro">{METRIC_LABEL[a.metric] ?? a.metric}</span>
        <Change value={a.change_pct} className="t-body-lg" />
        <Gauge pct={a.change_pct} maxAbs={maxAbs} />
        <SeverityBadge severity={a.severity} />
        {a.lowLiquidity && <LowLiquidityBadge />}
        {a.ai_hypothesis && <ConfidenceBadge confidence={a.ai_hypothesis.confidence} />}
      </div>
      {a.ai_hypothesis && (
        <p className="m-0 mt-1 t-micro" style={{ color: "var(--text-secondary)" }}>
          {a.ai_hypothesis.text}
          {a.ai_hypothesis.evidence_urls?.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className="ml-2"
               aria-label={`${a.itemName} 근거 공지 열기 (새 창)`}>근거 ↗</a>
          ))}
        </p>
      )}
    </m.div>
  );
}

export default function Briefings({ data }) {
  const reduce = useReducedMotion();
  const { briefings, anomalies, rows, items, anomalyTotals } = data;
  const [params, setParams] = useSearchParams();
  const selected = params.get("date") ?? briefings[0]?.date ?? null;
  const setSelected = (d) => setParams({ date: d }, { replace: true });
  const cur = briefings.find((b) => b.date === selected) ?? briefings[0];
  const linked = cur ? anomalies.filter((a) => a.date === cur.date) : [];
  const totals = cur ? anomalyTotals?.[cur.date] : null;
  const cut = totals ? Math.max(totals.detected - linked.length, 0) : 0;
  const names = useMemo(() => itemNamePool(items), [items]);

  // 날짜 목록용: 그날 브리핑이 본 것과 같은 발행 시점 기준 최대 등락.
  // 최신 수집 기준을 쓰면 옆의 브리핑 본문과 1위·수치가 어긋난다.
  const maxByDate = useMemo(() => {
    const map = {};
    for (const b of briefings) {
      const withChange = publishChanges(rows, items, b.date).filter((c) => c.changePct != null);
      if (!withChange.length) continue;
      map[b.date] = withChange.reduce((best, c) =>
        Math.abs(c.changePct) > Math.abs(best.changePct) ? c : best);
    }
    return map;
  }, [briefings, rows, items]);

  const maxAbs = linked.length ? Math.max(...linked.map((a) => Math.abs(a.change_pct))) : 0;
  const groups = groupAnomalies(linked);

  if (!briefings.length) return (
    <div className="space-y-3">
      <h1 className="t-title m-0">브리핑 아카이브</h1>
      <Empty>발행된 브리핑이 아직 없습니다. 심야 회차(KST 02:17)에 자동 발행됩니다.</Empty>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rise">
        <h1 className="t-title m-0">브리핑 아카이브</h1>
        <p className="t-lead m-0 mt-1">매일 심야에 자동 발행되는 데일리 브리핑입니다. 사람 손을 거치지 않습니다.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[224px_1fr]">
        {/* 과거 브리핑 타임라인 레일: 그날의 최대 등락을 함께 보여 흐름이 보이게 */}
        <nav className="relative pl-4" aria-label="브리핑 날짜 목록">
          <span className="absolute bottom-2 left-[5px] top-2 w-px" style={{ background: "var(--hairline-strong)" }} aria-hidden="true" />
          <div className="space-y-1.5">
            {briefings.map((b) => {
              const on = cur?.date === b.date;
              const ext = maxByDate[b.date];
              return (
                <div key={b.date} className="relative">
                  <span className="absolute -left-[13.5px] top-4 h-2 w-2 rounded-full"
                        style={{ background: on ? "var(--accent)" : "var(--hairline-strong)", outline: on ? "3px solid var(--accent-soft)" : "none" }}
                        aria-hidden="true" />
                  <m.button onClick={() => setSelected(b.date)}
                    aria-current={on ? "true" : undefined}
                    className="card block w-full cursor-pointer p-2.5 text-left"
                    whileHover={{ y: -3, boxShadow: on ? `inset 2px 0 0 var(--accent), ${LIFT_SHADOW}` : LIFT_SHADOW }}
                    whileTap={{ y: -1 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    style={on
                      ? { borderColor: "var(--accent)", boxShadow: "inset 2px 0 0 var(--accent)" }
                      : { boxShadow: REST_SHADOW }}>
                    <span className="num text-sm" style={{ color: on ? "var(--accent)" : "var(--text-primary)", fontWeight: on ? 700 : 500 }}>{b.date}</span>
                    <span className="mt-0.5 flex items-center gap-2 t-micro" style={{ color: "var(--text-muted)" }}>
                      <span>이상 {anomalyTotals?.[b.date]?.detected
                        ?? anomalies.filter((a) => a.date === b.date).length}건</span>
                      {ext && (
                        <span className="num" style={{ color: ext.changePct > 0 ? "var(--up)" : "var(--down)" }}>
                          최대 {fmtSignedPct(ext.changePct)}
                        </span>
                      )}
                    </span>
                  </m.button>
                </div>
              );
            })}
          </div>
        </nav>

        {/* 상세: 조간 리포트 1면 */}
        {/* 날짜를 바꾸면 이전 브리핑이 사라진 뒤 새 브리핑이 올라온다 */}
        <AnimatePresence mode="wait">
        {cur && (
          <m.article key={cur.date} className="card p-4 sm:p-5"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ borderTop: "3px solid var(--text-primary)" }} />
            <div className="mt-[3px]" style={{ borderTop: "1px solid var(--hairline-strong)" }} />
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="t-eyebrow" style={{ color: "var(--gold-text)" }}>오늘의 조간 리포트</span>
              <span className="t-kicker num">
                {cur.date} {cur.collectionFailed ? "심야 회차 수집 실패, 전일 데이터 기준" : "심야 회차 발행 기준"} · 생성 {GEN_LABEL[cur.generatedBy] ?? cur.generatedBy}
                {cur.costUsd > 0 && <span> · LLM 비용 ${cur.costUsd.toFixed(4)}</span>}
              </span>
            </div>
            <h2 className="t-section headline-nums m-0 mt-2" style={{ fontSize: "clamp(1.5rem, 2.6vw, 1.9rem)", lineHeight: 1.4 }}>
              {highlight(cur.headline)}
            </h2>
            {cur.date < DEFINITION_CHANGED_AT && (
              <p className="m-0 mt-2 rounded px-3 py-2 t-micro"
                 style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)" }}>
                이 브리핑은 발행 당시 기준입니다. 이후 수치를 계산하는 방식이 바뀌어
                지금 데이터와는 다르게 보일 수 있습니다.
                발행된 글은 기록이라서 고치지 않습니다.
                무엇이 언제 바뀌었는지는 <Link to="/methodology">방법론·정책</Link>에 적어 두었습니다.
              </p>
            )}
            <hr className="rule mt-3 mb-3" />
            <ul className="m-0 list-none space-y-2 p-0 t-body-lg" style={{ color: "var(--text-primary)" }}>
              {cur.summary_3lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <BulletIcon />
                  <span>{highlight(l, names)}</span>
                </li>
              ))}
            </ul>

            {cur.notable?.length > 0 && (
              <div className="mt-5">
                <h3 className="t-kicker m-0">주목 변동</h3>
                <ul className="m-0 mt-1.5 list-none space-y-1.5 p-0 text-sm">
                  {cur.notable.map((n, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                      <b style={{ color: "var(--text-primary)" }}>{n.itemName}</b>
                      <span style={{ color: "var(--text-secondary)" }}>{highlight(n.comment)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {linked.length > 0 && (
              <div className="mt-5 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
                <h3 className="t-kicker m-0">연결된 이상 변동·가설</h3>
                {cut > 0 && (
                  <p className="m-0 mt-1.5 t-micro" style={{ color: "var(--text-secondary)" }}>
                    이 날 실제로 탐지된 이상은 <b className="num">{totals.detected}건</b>입니다.
                    표시 상한 때문에 심각도와 변동 폭이 큰 <b className="num">{linked.length}건</b>만 아래에 싣습니다.
                    위 브리핑 본문이 건수를 다르게 말한다면 이 수치가 기준입니다.
                  </p>
                )}
                <div className="mt-2 space-y-2">
                  {groups.map((g, i) =>
                    g.length > 1
                      ? <AnomalyGroupCard key={i} group={g} maxAbs={maxAbs} />
                      : <AnomalySingleCard key={g[0].id} a={g[0]} maxAbs={maxAbs} />
                  )}
                </div>
              </div>
            )}
          </m.article>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
