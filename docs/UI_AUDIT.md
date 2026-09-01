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

---

# 조치 결과 (B3·B4, 2026-09-01)

## 고침

**Blocker 6건 전부**

- App.jsx - 본문 바로가기 링크 추가(`.skip-link`), `<main id="main" tabIndex={-1}>`. Tab 첫 대상 확인 완료
- index.css - `scroll-padding-top: 56px` + 제목·id에 `scroll-margin-top`. 고정 헤더가 포커스 대상을 덮지 않는다
- PriceChart.jsx - 차트를 `role="group" tabIndex={0}`으로 감싸고 좌우 방향키·Home·End·Esc로 회차 이동.
  터치(`onTouchStart`/`onTouchMove`)도 같은 지점 선택. svg는 `aria-hidden`, 선택 회차는 `aria-live`로 읽어 준다
- PriceChart.jsx / Methodology.jsx - `role="img"` 안에 포커스 노드를 두던 충돌 해소(`role="group"`으로 교체)
- Methodology.jsx - `outline: none` 제거, `.pipe-node:focus-visible` 링 추가
- Overview.jsx - 히트맵 타일에 `onFocus`/`onBlur` 추가, 타일 자체에 이름·가격·등락을 담은 `aria-label`

**권장 12건**

- HeatLegend `role="img"` / 브리핑 날짜 목록 `<nav>` / 상태 바 스크롤 영역 `tabIndex={0}`
- 근거 링크에 대상 품목을 넣은 `aria-label`(같은 이름 링크 중복 해소), 펼치기 버튼 `aria-controls`
- 저유동 뱃지에 `sr-only` 설명(마우스 없이도 읽힘)
- ItemDetail 매물 수 `toLocaleString` + 값 없을 때 문구, 히어로 아이콘 `loading="lazy"` → `fetchPriority="high"`
- index.css `min-height: 100dvh`, `-webkit-tap-highlight-color: transparent`, `env(safe-area-inset-*)` 반영
- index.html 폰트 스타일시트 `rel="preload" as="style"` 추가
- App.jsx 오류 문구에 다음 조치 안내 추가
- `.flow-dash` 무한 반복 → 3회로 제한 (설명용 연출이라 한 번 보여 주면 충분)

**참고 3건**

- Methodology 직선 따옴표 → 곡선 따옴표 2곳
- 히트맵 툴팁 하드코딩 상한 `1000` → 컨테이너 실측 폭 기준
- `useWidth` 훅을 `lib/use-width.js`로 공용화 (PriceChart·ListingChart 중복 제거)

**감사에서 못 잡고 스크린샷에서 잡힌 것 1건**

- HeatLegend 고정 폭(360px)이 좁은 화면에서 카드 밖으로 넘쳤다(모바일 방법론 화면 가로 넘침 3px).
  `width` → `maxWidth`로 바꿔 해결. 재촬영 후 전 화면 가로 넘침 0px

## 남긴 것 (판단 근거 포함)

- **`boxShadow`·`backgroundColor` 애니메이션** (Overview·RankBoard·Briefings): 합성 친화 속성만 쓰라는 규칙에
  어긋나지만, 고치려면 의사 요소 오버레이로 구조를 바꿔야 한다. 요소 수가 적고 실측에서 끊김이 없어
  유지한다. 값은 `lib/motion-tokens.js` 한곳으로 모아 두었다
- **`.pulse` 무한 반복**: "지금도 돌고 있다"를 전하는 상태등이라 반복 자체가 의미다. 크기가 6px이고
  데이터를 가리지 않으며 동작 줄이기 설정에서 꺼진다
- **App.jsx 헤더 상태 `title` 속성**: 눈에 보이는 문구("무인 운영 중")가 이미 있어 설명 보조로만 남긴다

## 검수 증거 (B4)

- `dashboard/scripts/screenshot.mjs` (`node scripts/screenshot.mjs`, 미리보기 서버 4173 기준)
- 데스크톱 1440 / 모바일 390, 화면 4종(오버뷰·브리핑·방법론·아이템 상세) 촬영 → `dev/shots/`
- 자동 확인: 콘솔 오류 0건, 전 화면 가로 넘침 0px, Tab 첫 대상이 본문 바로가기
- `npm run build` 통과, `npm run audit` 14항목 전부 통과(참고 1건)

---

# 시세 차트 가시성 개선 (2026-09-01, dataviz 기준)

## 왜 뜯어져 보였나 (원인 4가지)

1. **x축이 시간이 아니라 회차 순번이었다.** 하루 1회만 수집한 날(08-27)과 6회 수집한 날(08-25)이
   가로 폭을 6배 차이로 차지했다. 소급 수집 구간은 하루 1점, 실측 구간은 하루 최대 6점이라
   같은 화면에서 밀도가 6배 달랐다
2. **회차를 전부 찍어 하루 안의 톱니가 며칠치 흐름을 덮었다**
3. **결손 회차마다 선이 끊겨** 고립된 점과 조각난 영역 채움이 화면에 흩어졌다
4. **이벤트 칩이 서로 겹쳐** 글자를 가렸다 (`event`·`event`·`notice`가 한 자리에)

## 무엇을 했나

- **x축을 실제 시간 기준으로.** 회차는 수집 시각(02·07·11·15·19·23시) 위치에 놓이고,
  수집이 없는 날은 그만큼 빈 자리로 남는다
- **기본 보기를 일 단위 대표값으로.** 그날 회차들의 평균 한 점. 소급 구간과 실측 구간이
  같은 간격이 된다. 회차 하나하나가 필요하면 `회차별` 보기로 전환
- **기간 프리셋** 최근 14일(기본)·30일·전체. 기본 화면이 최근 흐름을 크게 보여 준다
- **이벤트 클러스터링.** 58px 안에 겹치는 이벤트는 하나로 묶어 `3건`으로 표시하고,
  호버·포커스하면 묶인 항목을 전부 펼쳐 보여 준다
- **표 보기 추가.** 툴팁 없이도 모든 값을 읽을 수 있다 (dataviz의 table-view 요건)
- **매물 수 차트도 같은 축을 쓴다.** 두 차트가 세로로 붙어 있어 축이 다르면 같은 날짜가
  다른 자리에 찍힌다. `lib/chart-points.js`에서 축 계산을 공유하고, 보기 조절은
  차트 안이 아니라 두 차트 위 한 줄에 둔다

## 마크·색 규격

- 선 2px round join/cap, 영역 채움 10% 워시, 그리드는 실선 hairline
- 점은 기본으로 찍지 않는다. 양옆이 결손이라 선이 될 수 없는 값과 지금 고른 지점만
  r=4~4.5 + 2px 표면 링
- 값 라벨은 끝점 하나만 (`최근 등록 대표가 1,000만 골드 (09-01)`)
- **팔레트 검증 통과** (`validate_palette.js`, light, surface #FCFCFB):
  - 실거래 `#4A8271` → **`#2F8F6B`**. 기존 값은 채도 0.066으로 기준(0.1) 미달이라 회색으로 읽혔다
  - 이벤트 `#B0813C`(골드) → **`#9A5B1E`**. 골드는 실거래 초록과 protan에서 ΔE 6.0으로
    구분이 어려웠다. 새 값은 최소 ΔE 8.9(deutan). 상태색 `#A85416`(수집 실패)과는 다른 값을 써서
    상태색과 시리즈색이 섞이지 않게 했다
  - 3색 전체 결과: 밝기 대역·채도 기준·색각 구분·정상 시야 구분·표면 대비 전부 PASS

## 검수

- 1440·390 양쪽에서 최근 14일·전체·회차별·표 보기 촬영, 콘솔 오류 0건, 가로 넘침 0px
- x축 마지막 눈금이 앞 눈금과 겹치던 문제(전체 보기에서 `08-30`·`09-01`)도 최소 간격 64px 규칙으로 해결
