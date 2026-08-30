// 오버뷰 마스트헤드: 좌측 프로젝트명 + 한 줄 정의, 우측 등락 스택 바와 기준일.
// 3D 지형도를 걷어내고 높이를 절반 이하로 줄인 자리다.
import ChangeStackBar from "./ChangeStackBar";
import { collectionStats } from "../lib/data";

export default function HeroBand({ cells, date, rows = [] }) {
  // "하루 6회"는 예약된 횟수일 뿐이다. 예약 실행이 밀리거나 점검과 겹치면 회차가 빈다.
  // 화면에는 실제로 수집에 성공한 회차만 말한다.
  const st = collectionStats(rows);
  const today = st.perDay[date] ?? 0;
  return (
    <section className="sec-inner grid items-end gap-x-10 gap-y-4 py-4 sm:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <h1
          className="t-title m-0"
          style={{ fontSize: "clamp(1.4rem, 2.2vw, 1.75rem)", lineHeight: 1.2 }}
        >
          아라드 거래소 관제실
        </h1>
        <p className="m-0 mt-1 text-sm leading-snug" style={{ color: "var(--text-secondary)", maxWidth: 520 }}>
          던전앤파이터 경매장 31품목을 하루 최대 6회 수집해 이상 변동을 해석하는 무인 분석 시스템.
        </p>
      </div>
      <div className="min-w-0">
        <ChangeStackBar cells={cells} />
        <p className="num m-0 mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          기준일 {date ?? "집계 전"} · 오늘 {today}회 수집 (누적 {st.slots}회 / {st.days}일)
        </p>
      </div>
    </section>
  );
}
