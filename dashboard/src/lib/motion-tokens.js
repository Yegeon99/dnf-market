// 모션이 보간하는 값들의 단일 출처.
//
// Motion은 box-shadow·backgroundColor를 숫자 단위로 보간한다. 여기에 var(--x)를
// 넣으면 보간이 끊겨 값이 툭 튀므로, CSS 토큰 대신 이 파일에서 실제 값을 관리한다.
// index.css의 --card-shadow-lift와 같은 계열 값이다.

/** 클릭 가능한 카드가 떠오를 때 */
export const LIFT_SHADOW = "0 8px 22px rgba(27, 33, 48, 0.14)";
/** 떠오르기 전 기본 상태. 같은 형식이어야 보간이 매끄럽다 */
export const REST_SHADOW = "0 0 0 rgba(27, 33, 48, 0)";
/** 주목 요소가 등장할 때 한 번만 켜졌다 꺼지는 바탕색 */
export const FLASH_ON = "rgba(184, 79, 74, 0.18)";
export const FLASH_OFF = "rgba(184, 79, 74, 0)";
/** 이상 변동 카드 등장 시 한 번만 켜졌다 꺼지는 안쪽 테두리 */
export const RING_ON = "inset 0 0 0 2px rgba(184, 79, 74, 0.45)";
export const RING_OFF = "inset 0 0 0 2px rgba(184, 79, 74, 0)";
