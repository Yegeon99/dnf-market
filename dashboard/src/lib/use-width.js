// 컨테이너 실제 폭 추적 (차트 공용).
// 차트마다 ResizeObserver를 따로 두면 같은 코드가 갈라져 한쪽만 고쳐지는 일이 생긴다.
import { useEffect, useState } from "react";

export function useWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
