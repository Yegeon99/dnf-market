# HANDOFF — 2026-08-25 (Phase 2 완료 시점)

## 완료된 것

- [x] Phase 0·1 전체 (셋업, 품목 31종, 수집 파이프라인, snapshot.yml 가동)
- [x] GitHub 인증 복구 (gh 재설치 v2.98.0 — 기존 설치 소실, curl device flow로 우회 로그인)
- [x] `.env` 재생성 (소실 발견 — OneDrive 추정). NEOPLE·ANTHROPIC 키 모두 SET
- [x] Secrets 2종 등록·확인 (NEOPLE_API_KEY, ANTHROPIC_API_KEY), 네오플 테스트 200
- [x] `.venv` 재생성 (Python 3.11.9 재설치 — 시스템 python도 소실돼 있었음)
- [x] snapshot.yml 수동 실행 성공 (run 32805882806) — data/ 한정 커밋 확인
- [x] **Phase 2 구현 완료** (커밋 40b7ce9):
  - `pipeline/detect.py` — 전일 대비 + 7일 MA 이탈(7일 축적 시 자동 활성화), `config/thresholds.json`
  - `pipeline/interpret.py` — ±3일 events 교차, claude-haiku-4-5, 근거 URL 화이트리스트 검증
  - `pipeline/briefing.py` — 이상 有 opus-5 / 0건 무비용 템플릿, `pipeline/llm.py` 비용 원장·$0.3 상한
  - `pipeline/run_daily.py` + `.github/workflows/daily.yml` (KST 02:17), snapshot.yml은 나머지 5회차
  - `config/events.csv` — 최근 1개월 공지·이벤트 후보 13건 (사용자 확인 대기)
- [x] daily.yml Actions 검증 성공 (run 32807081842) — 전 체인 통과, data/ 한정 커밋
- [x] LLM 비용 실측: interpret(haiku) $0.001/건, briefing(opus-5) $0.0133/회
  — 최악 일 $0.0233 (목표 $0.1, 상한 $0.3 내)

## 남은 것

- [x] 게이트 1 통과: Actions 연속 성공 4회 (12:37·13:35 수동, 12:57 daily, 15:43 cron 자동) — cron→data 커밋→Vercel 재배포→라이브 갱신 전 체인 검증 완료
- [x] 게이트 2·3·4 통과: events 13건 확정, 대시보드 4화면, Vercel 배포(https://dnf-market.vercel.app)
- [ ] 운영 관찰: 브리핑 7일 연속 발행·이상 탐지 실사례 축적 (성공 기준), 첫 실전 이상 탐지 시 가설 품질 확인
- [ ] 백필 실거래 30일 소급 완료·수집 하루 6회 증편 — 데이터 축적 진행 중

## 주의사항

- **OneDrive가 gitignored 파일(.env, .venv)과 로컬 설치물(gh, python)을 날린 전례 있음.**
  재발 시: winget으로 gh·python 재설치, .env는 사용자에게 키 요청, venv는 requirements.txt로 재생성.
- 키 값은 채팅·로그·보고에 절대 출력 금지. "설정됨/미설정" + HTTP 코드로만 보고.
- gh 경로: `C:\Program Files\GitHub CLI\gh.exe` (PATH에 없음)
- 커밋·푸시 이 프로젝트에 한해 위임받음. 메시지 [phase-N] 한국어.
- 심야 회차(KST 02:17)는 daily.yml이 수집+분석 통합 수행. snapshot.yml은 07:17/11:17/15:17/19:17/23:17.
- 로컬 실행: `.venv/Scripts/python.exe pipeline/run_daily.py` (개별 스크립트도 가능)

---

# HANDOFF 추가 — 2026-09-01 (개명 + 진행 중 작업)

## 프로젝트 개명 (DNF Market Analyst → DNF Market)

- GitHub 저장소 `dnf-market-analyst` → **`dnf-market`** (`gh repo rename`, 로컬 remote 갱신 완료)
- 문서 3건 파일명 변경: `DNF-Market_PRD.md`, `DNF-Market_지침서.md`, `DNF-MARKET_UPGRADE.md`
- 코드·문서 전수 치환 완료 (헤더 로고·푸터·OG 태그 `og:url` 포함·메타·주석·package.json name)
- 화면 컨셉 문구 "아라드 거래소 관제실"은 유지
- 형제 프로젝트도 `arad-census` → `dnf-census` 로 개명돼 있어 링크 일괄 갱신.
  푸터 링크는 `https://dnf-census.vercel.app` 라이브 주소로 교체
- **Vercel 프로젝트명·도메인 변경은 미완료.** CLI 미로그인이라 사용자 클릭 필요.
  절차·검증 항목은 `docs/RESUME_TASKS.md` A3~A5 참조

## Actions 실패 이력 (전수 조사, 2026-09-01)

전체 실행 이력 중 실패는 아래 3건뿐. 이후 32회 연속 성공.

- `32762460157` (2026-08-24, 시세 스냅샷 수집)
  로그: `NEOPLE_API_KEY: `(빈 값) → `ERROR NEOPLE_API_KEY가 없습니다` → exit 1
  원인: **Secret 미등록 시점의 인증 실패.** 진짜 오류이므로 실패로 남는 게 정상
- `32794804564` (2026-08-25, 시세 스냅샷 수집) — 위와 동일 원인
- `33006954256` (2026-08-26, 심야 분석·브리핑)
  로그: `스냅샷 저장: 2026-08-27_0446.json (품목 31, 호출 0, 실패 62)` →
  `ERROR 전 품목 수집 실패` → `수집 실패 (exit 1)`
  원인: **네오플 API 전면 장애(목요일 정기점검). 62회 호출 전부 5xx.**
  같은 로그에 `Current branch master is up to date.` → `1eda3ce..d49845d master -> master`
  가 찍혀 있어 **푸시 충돌은 원인이 아니다.** concurrency·`git pull --rebase`는 이미 적용돼 있었음

## 조치 상태

- [x] 원인 특정 (로그 근거 확보)
- [ ] `collect.py` 종료 코드 분류 — 외부 5xx 장애는 exit 0 + Actions 요약 경고,
      인증 실패·코드 오류는 exit 1 유지 (`docs/RESUME_TASKS.md` C2-a)
- [ ] 커밋 스텝 푸시 재시도 루프 보강 (C2-b)
- [ ] `workflow_dispatch` 로 두 워크플로 검증 (C4)

## 다음 세션 시작 지점

`docs/RESUME_TASKS.md` 를 먼저 읽을 것. 남은 항목은 A3~A5·A9, B1~B4, C2~C5.

---

# HANDOFF 추가 — 2026-09-01 (2차 세션: Actions 안정화 + 디자인 품질)

## 이번 세션에서 끝낸 것

- **C 전부**: 수집 실패 종료 코드 분류(외부 장애면 경고 후 exit 0), 데이터 커밋 스크립트화,
  `run_daily` 연쇄 실패 없음 실측, 두 워크플로 `workflow_dispatch` 검증 성공
- **B 전부**: UI 감사(`docs/UI_AUDIT.md`), 토큰 통합, 접근성 Blocker 6건·권장 12건 수정,
  1440·390 스크린샷 검수 자동화(`dashboard/scripts/screenshot.mjs`)
- **감사 정상화**: 옛 정책을 들고 있던 감사 스크립트를 현재 정책에 맞춰 거짓 실패 17건 제거.
  남은 3건은 정의 변경 이전 발행분이라 재현 불가 → `참고` 등급으로 항상 노출
- **정직성 보강**: 정의 변경 이전 브리핑에 "발행 당시 기준" 고지, 방법론에 "지표 정의 변경 이력" 신설

## 실전에서 드러난 것 (다음 세션이 알아야 할 것)

- **두 워크플로를 같은 초에 수동 실행하면 concurrency 큐가 경합을 못 막는다.**
  같은 분의 스냅샷이 양쪽에서 생겨 rebase가 충돌한다. `commit_data.sh`가 이제 이 상황을
  복구하지만, 검증할 때는 한 번에 하나씩 실행하는 편이 깔끔하다
- **opus-5 브리핑 응답이 길어졌다.** 예전 실측 회당 $0.0133 → 최근 $0.042.
  `max_tokens` 1000에서 잘려 회차가 죽은 적 있음(2000으로 상향). 비용 상한 $0.3은 그대로
- **OneDrive가 `dashboard/node_modules`의 `motion` 패키지를 날린 전례 추가.**
  빌드가 `Rolldown failed to resolve import "motion/react"`로 죽으면 `npm install`

## 남은 것

- **A3~A5 (사용자 클릭 필요)**: Vercel 프로젝트명·도메인 변경. `docs/RESUME_TASKS.md` 참조.
  2026-09-01 실측: `dnf-market.vercel.app` 404(미선점), `dnf-market-analyst.vercel.app` 200.
  Git 연동은 살아 있다 (푸시 후 자동 배포 반영 확인)
- 운영 관찰: 브리핑 7일 연속 발행, 첫 실전 이상 탐지 가설 품질 확인
