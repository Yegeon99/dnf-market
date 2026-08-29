// 첫 로드 등장 연출 (Motion). 화면 위쪽 블록부터 0.05초 간격으로 순서대로 올라온다.
// 마운트 시점에 전부 예약되므로 스크롤을 내리지 않아도 내용이 가려지지 않는다.
// (스크롤 진입 시점에 맞추면 아래쪽 수치가 화면 밖에서 숨겨진 채로 남는다)
// 새로고침하면 다시 실행되고, 그 뒤로는 다시 움직이지 않는다.
import { m, useReducedMotion } from "motion/react";

/** index 0부터 위→아래 순서. 0.05초 * index 만큼 늦게 등장한다.
 *  동작 줄이기 설정이면 연출을 건너뛰고 완료 상태로 바로 보여준다 */
export default function Reveal({ index = 0, className = "", children }) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </m.div>
  );
}
