# 진행 중 작업 체크리스트 — 개명 + 디자인 품질 + Actions 진단

> 중단 시점 2026-09-01. 다음 세션에서 이 파일부터 읽고 `[ ]` 항목만 이어서 하면 된다.
> `dev/`는 gitignore라 이 파일을 `docs/`에 둔다.

## 현재 상태 요약

- **저장소명 개명 완료**, 코드·문서 치환 완료, 커밋·푸시까지 끝냄
- **Vercel 개명은 미착수** — CLI 로그아웃 상태라 사용자 클릭 필요
- **Actions 수정은 원인 특정만 끝냄**, 코드 수정 미착수
- **디자인 품질 작업(B)은 전부 미착수**

---

## A. 프로젝트 개명 (DNF Market Analyst → DNF Market)

- [x] A1. `gh repo rename dnf-market` → https://github.com/Yegeon99/dnf-market
- [x] A2. 로컬 remote URL 갱신 (`git ls-remote` 통과)
- [x] **A3. Vercel 프로젝트명 → `dnf-market` 완료 (2026-09-01).**
      이전 기록의 "CLI 미로그인"은 사실이 아니었다. `npx vercel whoami` → `a990921-3933`.
      인증 파일은 `~/AppData/Roaming/xdg.data/com.vercel.cli/auth.json` 에 있다.
      실행: `npx vercel project rename dnf-market-analyst dnf-market`
- [x] A4. 새 도메인 200 확인 (`https://dnf-market.vercel.app/` → 200, 최신 번들 서빙).
      **이름만 바꾸면 새 도메인이 바로 뜨지 않는다.** 정확한 순서는 아래 A3-1 참조
- [x] **A3-1. 도메인이 붙기까지 실제로 필요했던 단계** (다음에 같은 작업을 할 때 이 순서로)
      1. `vercel project rename <old> <new>` — 프로젝트명만 바뀐다
      2. 이 시점에 `<new>.vercel.app` 은 **302** 를 낸다. `vercel.com/sso-api` 로 넘어간다.
         프로젝트 보호 설정이 `ssoProtection.deploymentType = all_except_custom_domains` 라
         새 도메인이 아직 "프로덕션 도메인"으로 인정되지 않아 SSO 게이트에 걸린 것이다
         (`vercel project protection <name>` 으로 확인)
      3. `vercel alias set <프로덕션 배포 URL> <new>.vercel.app` 만으로는 부족했다. 여전히 302
      4. **`vercel redeploy <프로덕션 배포 URL> --target production`** 을 돌리자
         `▲ Aliased https://dnf-market.vercel.app` 가 찍히고 200 이 됐다.
         새 이름 기준으로 프로덕션 별칭이 다시 매겨져야 한다
      - 구 도메인 `dnf-market-analyst.vercel.app` 은 그대로 200 으로 살아 있다 (정리하지 않음)
      - 로컬 링크 `.vercel/project.json` 의 `projectName` 도 `dnf-market` 으로 갱신
- [x] A5. **Git 연동 유지 확인 완료.** 저장소명이 바뀐 뒤에도 연동이 살아 있다.
      이번 세션에 푸시할 때마다 자동 재배포가 돌았고, 라이브에서 새 번들 해시를 확인했다
      (`index-CgL05rwY.js` 에 새 차트 컨트롤 문자열 포함)
- [x] A6. 전수 치환 완료 (아래 전부 반영, 잔존 검사 `analyst|애널리스트|arad` 0건)
      - [x] README.md (H1 → `# DNF Market, 던파 시세 분석·브리핑`, Live URL)
      - [x] `DNF-Market-Analyst_PRD.md` → **`DNF-Market_PRD.md`** (H1 포함)
      - [x] `DNF-Market-Analyst_지침서.md` → **`DNF-Market_지침서.md`**
      - [x] `MARKET_ANALYST_UPGRADE.md` → **`DNF-MARKET_UPGRADE.md`**
      - [x] HANDOFF.md
      - [x] `dashboard/package.json` (`"name": "dnf-market"`)
      - [x] 헤더 로고 `App.jsx:82` → `DNF MARKET`
      - [x] 헤더 GitHub 링크 `App.jsx:97` → `github.com/Yegeon99/dnf-market`
      - [x] `dashboard/index.html` — `<title>`, `og:title`, **`og:url`**, `og:image`
      - [x] `dashboard/src/index.css` 주석
      - [x] 워크플로 파일 — 검사 결과 프로젝트 명칭 문자열 **없음**(변경 불필요)
- [x] A7. `HeroBand.jsx:18` "아라드 거래소 관제실" 그대로 유지 (치환 대상 아님)
- [x] A8. 푸터 형제 프로젝트 링크 →
      `시리즈의 다른 프로젝트: DNF Census · 캐릭터 표본조사` → `https://dnf-census.vercel.app`
      (형제 저장소도 `arad-census` → `dnf-census` 로 이미 개명돼 있어 README 링크도 함께 갱신)
- [x] A9. **최종 검증 완료 (2026-09-01).** 새 도메인 `https://dnf-market.vercel.app/` 200,
      콘솔 오류 0건(1440·390 전 화면), `npm run audit` 14항목 전부 통과(참고 1건),
      `npm run build` 통과, 전 화면 가로 넘침 0px

### A 단계 치환 시 내린 판단 (다음 세션이 되돌리지 말 것)

- `"마켓 애널리스트" → "DNF 마켓"` 을 글자 그대로 적용하면 H1이
  `# DNF Market, 던파 라이브 DNF 마켓` 처럼 중복돼서, 저장소에 이미 있던 표현
  (`index.html` 의 `던파 시세 분석·브리핑`)으로 통일했다. 사용자 보고 완료 항목.

---

## B. 대시보드 디자인 품질 개선 — **전부 미착수**

> 단계마다 사용자 승인 게이트가 있다. 승인 없이 다음 단계로 넘어가지 말 것.

- [x] B1. **[1단계 감사] 완료 (2026-09-01) — 결과는 `docs/UI_AUDIT.md`. 수정 없음, 승인 대기**
      Blocker 6건(본문 바로가기 없음, sticky 헤더 `scroll-margin-top`, 차트 툴팁 키보드 대안,
      `role="img"` 안 인터랙티브 노드 2곳, 히트맵 툴팁 키보드 대안),
      권장 15건, 참고 6건. 아래는 원래 지시문:
- [x] B1-원문. `web-design-guidelines` 스킬로 `dashboard/src` 전체 UI 감사.
      대상: `App.jsx`, `pages/`(Overview·ItemDetail·Briefings·Methodology),
      `components/`(ChangeStackBar·HeatLegend·HeroBand·ListingChart·PriceChart·
      RankBoard·StatusStrip·reveal·rich·ui), `index.css`
      심각도순(Blocker → 개선 권장 → 참고) + `파일:라인` 목록화.
      **수정 금지, 보고만 → 승인 대기**
- [x] B2. **완료 (2026-09-01).** 고정 크기 타이포 토큰 7종(`--fs-micro`~`--fs-stat`)과
      1:1 유틸 클래스 신설, JSX에 흩어져 있던 `text-[13px]` 류 임의값 82곳 치환.
      `lib/motion-tokens.js` 신설로 Motion이 보간하는 그림자·플래시 값 6종 단일화
      (CSS 변수로 두면 보간이 끊겨 값이 튄다). JSX rgba 리터럴 16곳 제거(잔여 0),
      하드코딩 `#FFFFFF` → 토큰. 레이아웃·기능 변경 없음.
      **간격은 손대지 않았다** — Tailwind 스페이싱 스케일이 이미 단일 체계라
      토큰을 덧씌우면 출처가 둘로 갈린다
- [x] B3. **완료 (2026-09-01).** Blocker 6건 전부 + 권장 12건 + 참고 3건 수정.
      상세와 남긴 항목의 판단 근거는 `docs/UI_AUDIT.md` 하단 "조치 결과" 참조
- [x] B4. **완료 (2026-09-01).** MCP 대신 `dashboard/scripts/screenshot.mjs`로 자동화
      (playwright 패키지가 이미 devDependency라 재사용이 쉽다).
      1440·390, 화면 4종 촬영 → `dev/shots/`. 자동 점검 결과 콘솔 오류 0건,
      전 화면 가로 넘침 0px, Tab 첫 대상이 본문 바로가기.
      촬영 중 HeatLegend 고정 폭 넘침(모바일 3px) 발견해 함께 수정. 빌드 통과
- [x] B5. 규칙 확인: `design-taste-frontend` 스킬 **사용 금지**

---

## C. Actions 실패 진단·개선

- [x] **C1. 실패 3건 원인 특정 완료 (로그 직접 확인)**

  | run | 워크플로 | 로그 근거 | 원인 |
  |---|---|---|---|
  | `32762460157` (08-24) | 시세 스냅샷 수집 | `NEOPLE_API_KEY: ` (빈 값) → `ERROR NEOPLE_API_KEY가 없습니다 (.env 또는 환경변수 확인)` → `exit code 1` | **Secret 미등록 인증 실패.** 진짜 오류 → 실패 유지가 정답 |
  | `32794804564` (08-25) | 시세 스냅샷 수집 | 위와 동일 | 동일 |
  | `33006954256` (08-26) | 심야 분석·브리핑 | `스냅샷 저장: 2026-08-27_0446.json (품목 31, 호출 0, 실패 62)` → `ERROR 전 품목 수집 실패` → `수집 실패 (exit 1)` | **네오플 API 전면 장애(목요일 정기점검). 62회 전부 5xx** → (a) 케이스 |

  - **(b) 푸시 충돌은 원인 아니었음.** `33006954256` 로그에
    `Current branch master is up to date.` → `1eda3ce..d49845d master -> master` 정상 푸시.
    `concurrency: data-commit` 과 `git pull --rebase origin master` 는 두 워크플로에 **이미** 적용돼 있음.
  - Secrets 는 08-25 등록 완료(HANDOFF 기록). 그 이후 32회 실행 전부 성공.

- [x] **C2-a. `pipeline/collect.py` 종료 코드 분류 완료** (2026-09-01)
      - 실패 사유를 분류: `HTTP 5xx`·네트워크 예외 = **예상 가능한 외부 장애**,
        `HTTP 401/403` = 인증 실패, 그 외 4xx = 코드·설정 오류
      - 전 품목 실패 + 전부 외부 장애 → `::warning` 남기고 **exit 0**
      - 인증 실패·코드 오류가 섞이면 **exit 1 유지**
      - `$GITHUB_STEP_SUMMARY` 에 `성공 N / 실패 N` 요약 항상 기록
      - 현재 코드 위치: `collect.py` `main()` 말미
        `if failures and len(failures) >= len(items) * 2: return 1`
      - `load_api_key()` 의 `sys.exit(1)` 은 **그대로 유지** (진짜 인증 실패 구분용)
      - 구현: `failure_kind()` 추가 (`5xx`·`requests` 예외명 → `outage`, `401/403` → `auth`,
        그 외 `4xx` → `client`). `429`도 호출 빈도 문제라 `client`(exit 1)로 둔다.
        `failures[]` 각 항목에 `kind`, 스냅샷에 `failureKinds` 집계 기록.
        전 품목 실패 시 `kinds == {"outage"}` 면 `::warning` + exit 0, 아니면 `::error` + exit 1.
        `step_summary()` 로 `$GITHUB_STEP_SUMMARY` 에 성공/실패/분류 항상 기록 (로컬은 무시)
      - 검증: `dev/test_collect_exit.py` 4케이스 통과
        (전면 5xx→0, ConnectionError→0, 401 섞임→1, 400 섞임→1)
- [x] C2-b. 두 워크플로 커밋 스텝에 **푸시 재시도 루프**(rebase 후 3회) 추가 완료.
      **1차 구현(rebase 재시도)은 실전에서 실패해 폐기했다.** 두 워크플로를 같은 초에
      수동 실행하니 concurrency 큐가 경합을 막지 못해 같은 분(08:19) 스냅샷이 양쪽에서
      생성됐고, `CONFLICT (add/add) data/snapshots/2026-09-01_0819.json` +
      `CONFLICT (content) data/timeseries.json` 으로 rebase가 3회 모두 실패
      (run `33450158710`). 재시도 루프 자체는 정상 동작했으나 rebase로는 이 충돌을 못 푼다.
      **2차 구현 = `.github/scripts/commit_data.sh`** (두 워크플로 공용):
      push 실패 시 원격 최신으로 `reset --hard` → 우리 회차 `data/` 파일을 `checkout <ours> -- data/`
      로 얹기(원격에만 있는 파일은 보존) → `aggregate.py` 로 시계열 재생성 → 재커밋, 최대 3회.
      시계열은 스냅샷 파생물이라 재생성이 항상 정답이다. YAML 파싱·`bash -n` 통과
- [ ] C2-c. 워크플로 설정 오류 — C1 결과상 **해당 없음**
- [x] C3. `run_daily.py` 연쇄 실패 방지 확인 완료.
      현재 STEPS 에서 수집은 `critical=False` 지만 `exit_code` 로 전파된다.
      C2-a 적용 시 외부 장애는 collect가 0을 반환하므로 브리핑 경로
      (`briefing.py` 의 "전일 데이터 기준" 템플릿, `briefing.py:77~118`)를 타고
      워크플로가 성공 종료한다.
      **실측(임시 사본에서 collect 스텁으로 전 품목 외부 장애 재현):**
      수집 exit 0 → 집계가 `전 품목 수집 실패 회차, 병합 건너뜀` 으로 시계열 오염 없음 →
      탐지 0건 → 해석 0건(LLM 미호출) → 브리핑 템플릿
      `심야 회차 수집 실패, 2026-08-31 데이터 31종 기준 유지` (비용 $0.0000) →
      `run_daily exit=0`. 연쇄 실패 없음 확인
- [ ] C4. `gh workflow run` 으로 두 워크플로 1회씩 실행 → 성공 확인
- [ ] C5. 실패 이력·조치 내용 HANDOFF 기록 (C1 부분은 이미 기록됨, 조치 결과 추가 필요)

---

## D. 마무리

- [x] D1-1. 1차 커밋·푸시 (개명 + 이 체크리스트)
- [ ] D1-2. C·B 작업분 커밋·푸시
- [ ] D2. 검수 결과 5항 보고 (작업 결과·검수 방법·검수 증거·잔여 리스크·다음 단계)

---

## E. 2026-09-01 세션에서 추가로 한 일 (체크리스트 밖)

- [x] E1. 브리핑 응답 잘림 대응. `max_tokens` 1000 → 2000, `stop_reason == "max_tokens"`를
      잘림으로 감지, 형식 위반 시 `fallback_briefing`으로 발행해 회차 전체가 죽지 않게 함
      (run `33450478827` 실패 원인). 화면에 `template-fallback` 라벨 추가
- [x] E2. 데이터 커밋을 `.github/scripts/commit_data.sh`로 통일.
      push 실패 시 rebase 대신 원격 최신 위에 우리 회차 data/를 얹고 시계열을 재생성
      (run `33450158710`의 add/add 충돌 대응)
- [x] E3. 감사 스크립트를 현재 정책에 맞춤 (중앙값·공통 회차·ma7 임계표·발행 시점 기준 복원).
      거짓 실패 17건 제거
- [x] E4. 정의 변경 이전 브리핑 고지 + 방법론 "지표 정의 변경 이력" 신설,
      감사에 `참고` 등급 도입해 재현 불가 3건을 항상 목록 출력
