# B1 UI 감사 결과 — dashboard/src 전체

기준: Web Interface Guidelines (vercel-labs/web-interface-guidelines, 2026-09-01 조회)
범위: `App.jsx`, `main.jsx`, `index.html`, `index.css`, `pages/` 4종, `components/` 9종
방식: 규칙 대조 정적 검토. **수정은 하지 않았다.**

심각도: **Blocker** 접근성·기능 차단 / **권장** 품질 저하 / **참고** 사소

---

## Blocker

App.jsx:107 - `<main>`에 id 없음, 본문 바로가기(skip link) 부재. 키보드 사용자가 페이지마다 내비를 다시 통과해야 함
App.jsx:76 - sticky 헤더인데 heading·포커스 대상에 `scroll-margin-top` 없음. 앵커 이동·포커스 스크롤 시 헤더가 대상을 덮음
components/PriceChart.jsx:146 - 데이터 툴팁이 `onMouseMove` 전용. 키보드·터치 대안 없음 (차트 수치를 마우스 없이 읽을 수 없음)
components/PriceChart.jsx:147 - `role="img"` svg 안에 `tabIndex={0} role="button"` 이벤트 마커(214~217). role=img가 자식을 보조기술에서 감춰 마커가 존재하지 않는 것으로 읽힘
pages/Methodology.jsx:36 - 위와 동일 충돌. `role="img"` 다이어그램 안에 포커스 가능한 노드(65~68)
pages/Overview.jsx:104 - 히트맵 타일 툴팁이 hover 전용(`onEnter`/`onLeave`). 타일은 `<button>`이라 포커스는 가는데 `onFocus`/`onBlur`가 없어 키보드로는 상세를 볼 수 없음

## 권장

pages/Methodology.jsx:68 - `outline: "none"`. 대체 표시(테두리 강조)는 있으나 전역 `:focus-visible` 링을 지움
components/HeatLegend.jsx:18 - role 없는 `<div>`에 `aria-label`. 보조기술이 무시함 (`role="img"` 또는 `<figure>`+캡션 필요)
pages/Briefings.jsx:163 - role 없는 `<div>`에 `aria-label="브리핑 날짜 목록"`. `<nav>` 또는 목록 role 필요
pages/Briefings.jsx:76 - "근거 ↗" 링크가 여러 개인데 접근명이 전부 동일. 링크 목록에서 구분 불가 (ItemDetail.jsx:137 동일)
pages/Briefings.jsx:80 - 펼치기 버튼에 `aria-expanded`는 있으나 `aria-controls` 없음
index.css:349 - `.flow-dash` 무한 반복(`stroke-dashoffset`). 5초 초과 자동 재생인데 정지 수단 없음. 페인트 유발 속성
index.css:355 - `.pulse` 무한 반복. 위와 같은 5초 초과 문제 (opacity라 성능은 무해). 둘 다 `prefers-reduced-motion`에서는 꺼짐 (357~360)
pages/Overview.jsx:43 - `backgroundColor` 애니메이션. 합성 친화 속성(transform/opacity) 아님
pages/Overview.jsx:169 - `boxShadow` 호버 애니메이션 (RankBoard.jsx:26·62, Briefings.jsx:63·96·177 동일)
components/StatusStrip.jsx:46 - 가로 스크롤 컨테이너(`min-w-[600px]`)에 `tabIndex` 없음. 키보드로 스크롤 불가
components/ui.jsx:30 - 저유동 뱃지 설명이 `title` 속성뿐. 터치·키보드에서 안 보임
pages/ItemDetail.jsx:89 - `매물 {last?.listing}건`에 `toLocaleString` 미적용(다른 화면과 표기 불일치). 값이 없으면 "매물 건"으로 렌더
index.css:130 - `min-height: 100vh`. 모바일 주소창 구간에서 잘림, `100dvh` 권장
index.css:128 - `-webkit-tap-highlight-color` 미설정 (가이드라인은 의도적 지정 요구)
index.html:10 - 웹폰트에 `rel="preload" as="font"` 없음. `media="print"` 스왑만 사용
pages/ItemDetail.jsx:34 - 첫 화면 히어로 아이콘에 `loading="lazy"`. 위쪽 이미지는 `fetchpriority="high"` 쪽
App.jsx:109 - 오류 문구가 문제만 알리고 다음 조치를 말하지 않음

## 참고

pages/Methodology.jsx:167 - 직선 따옴표 `"중간"` → 곡선 따옴표 (225행 `"1세대·2세대"` 동일)
pages/Overview.jsx:141 - 툴팁 위치에 하드코딩 상한 `1000`. 넓은 화면에서 어긋날 수 있음
components/ListingChart.jsx:12 - PriceChart의 `useWidth`와 중복 구현 (ResizeObserver 2벌)
index.css:402 - 스켈레톤이 `background-position` 애니메이션(페인트). 로딩 표시라 가이드라인 예외 범위
index.css:275 - 풀폭 밴드·sticky 헤더인데 `env(safe-area-inset-*)` 미적용
App.jsx:93 - "무인 운영 중" 설명이 `title` 속성뿐 (마우스 전용)

## 통과

components/ChangeStackBar.jsx - `role="img"` + aria-label, 장식 범례 `aria-hidden` 정확
components/reveal.jsx - 모션 축소 존중, transform/opacity만 사용
components/rich.jsx, components/HeroBand.jsx, src/main.jsx - 해당 없음
components/ui.jsx - 카운트업이 `prefers-reduced-motion` 직접 확인(73행), 스파크라인 `aria-hidden` 적절
index.html - `lang="ko"`, viewport 확대 허용, `theme-color`가 바탕색과 일치, preconnect 있음
index.css:134 - 전역 `:focus-visible` 링 정의됨 / :195 전환 속성 명시 열거(`transition: all` 없음)
전 파일 - 최대 목록 31종이라 가상화 불필요, 렌더 중 레이아웃 읽기 없음, `onPaste` 차단·`user-scalable=no` 없음
