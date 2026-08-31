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
- [ ] **A3. Vercel 프로젝트명 → `dnf-market`, 도메인 → `dnf-market.vercel.app`**
      `vercel` CLI 미설치·미로그인(`npx vercel whoami` → `Logged out.`)이라 CLI 불가.
      클릭 경로:
      1. https://vercel.com/dashboard → 해당 프로젝트(`dnf-market-analyst`) 진입
      2. Settings → General → **Project Name** 을 `dnf-market` 으로 변경 후 Save
         (Vercel은 프로젝트명 변경 시 `<name>.vercel.app` 기본 도메인을 자동 재발급한다)
      3. Settings → Domains 에서 `dnf-market.vercel.app` 이 Production 에 붙었는지 확인
      4. 구 도메인 `dnf-market-analyst.vercel.app` 은 남겨두면 그대로 살아있다.
         정리하려면 Domains 목록에서 Remove
      - 참고 실측 2026-09-01: `dnf-market.vercel.app` → **404 (미선점, 사용 가능)**,
        `dnf-market-analyst.vercel.app` → 200, `dnf-census.vercel.app` → 200
      - 대안(CLI로 하려면): `npx vercel login` 후 `npx vercel link` → `npx vercel project ...`
- [ ] A4. 변경 후 `curl -s -o /dev/null -w "%{http_code}" https://dnf-market.vercel.app/` → 200 확인
- [ ] A5. **Git 연동 유지 확인** — Settings → Git 에서 연결 저장소가
      `Yegeon99/dnf-market` 로 따라왔는지 점검.
      GitHub 저장소명이 바뀌었으므로 Vercel 쪽 연결이 끊겼을 가능성 있음.
      끊겼으면 Connect Git Repository 재연결.
      그 뒤 Actions가 `data/` 커밋 → 자동 재배포되는지 실제 회차로 확인
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
- [ ] A9. 최종 검증: 새 도메인 200 / 콘솔 0건 / `npm run audit`(정합성 감사) 재실행 통과

### A 단계 치환 시 내린 판단 (다음 세션이 되돌리지 말 것)

- `"마켓 애널리스트" → "DNF 마켓"` 을 글자 그대로 적용하면 H1이
  `# DNF Market, 던파 라이브 DNF 마켓` 처럼 중복돼서, 저장소에 이미 있던 표현
  (`index.html` 의 `던파 시세 분석·브리핑`)으로 통일했다. 사용자 보고 완료 항목.

---

## B. 대시보드 디자인 품질 개선 — **전부 미착수**

> 단계마다 사용자 승인 게이트가 있다. 승인 없이 다음 단계로 넘어가지 말 것.

- [ ] B1. **[1단계 감사]** `web-design-guidelines` 스킬로 `dashboard/src` 전체 UI 감사.
      대상: `App.jsx`, `pages/`(Overview·ItemDetail·Briefings·Methodology),
      `components/`(ChangeStackBar·HeatLegend·HeroBand·ListingChart·PriceChart·
      RankBoard·StatusStrip·reveal·rich·ui), `index.css`
      심각도순(Blocker → 개선 권장 → 참고) + `파일:라인` 목록화.
      **수정 금지, 보고만 → 승인 대기**
- [ ] B2. **[2단계]** `design-system` 스킬 적용. 흩어진 색상·폰트 크기·간격을
      CSS 변수 토큰으로 통합. 다크 대시보드 톤 유지, 데이터 가독성(대비·숫자 타이포) 우선.
      레이아웃·기능 변경 금지 → 승인 대기
- [ ] B3. **[3단계]** B1의 Blocker + 개선 권장을 B2 토큰 기준으로 수정 → 승인 대기
- [ ] B4. **[4단계]** Playwright MCP로 로컬 1440px / 390px 스크린샷,
      수정 전후 비교 + 남은 문제 보고, 빌드 통과 확인
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

- [ ] **C2-a. `pipeline/collect.py` 종료 코드 분류** (미착수, 핵심 작업)
      - 실패 사유를 분류: `HTTP 5xx`·네트워크 예외 = **예상 가능한 외부 장애**,
        `HTTP 401/403` = 인증 실패, 그 외 4xx = 코드·설정 오류
      - 전 품목 실패 + 전부 외부 장애 → `::warning` 남기고 **exit 0**
      - 인증 실패·코드 오류가 섞이면 **exit 1 유지**
      - `$GITHUB_STEP_SUMMARY` 에 `성공 N / 실패 N` 요약 항상 기록
      - 현재 코드 위치: `collect.py` `main()` 말미
        `if failures and len(failures) >= len(items) * 2: return 1`
      - `load_api_key()` 의 `sys.exit(1)` 은 **그대로 유지** (진짜 인증 실패 구분용)
- [ ] C2-b. 두 워크플로 커밋 스텝에 **푸시 재시도 루프**(rebase 후 3회) 추가.
      concurrency·rebase 자체는 이미 있음 → 재시도만 보강
- [ ] C2-c. 워크플로 설정 오류 — C1 결과상 **해당 없음**
- [ ] C3. `run_daily.py` 연쇄 실패 방지 확인.
      현재 STEPS 에서 수집은 `critical=False` 지만 `exit_code` 로 전파된다.
      C2-a 적용 시 외부 장애는 collect가 0을 반환하므로 브리핑 경로
      (`briefing.py` 의 "전일 데이터 기준" 템플릿, `briefing.py:77~118`)를 타고
      워크플로가 성공 종료한다. 실제로 그렇게 되는지 확인할 것
- [ ] C4. `gh workflow run` 으로 두 워크플로 1회씩 실행 → 성공 확인
- [ ] C5. 실패 이력·조치 내용 HANDOFF 기록 (C1 부분은 이미 기록됨, 조치 결과 추가 필요)

---

## D. 마무리

- [x] D1-1. 1차 커밋·푸시 (개명 + 이 체크리스트)
- [ ] D1-2. C·B 작업분 커밋·푸시
- [ ] D2. 검수 결과 5항 보고 (작업 결과·검수 방법·검수 증거·잔여 리스크·다음 단계)
