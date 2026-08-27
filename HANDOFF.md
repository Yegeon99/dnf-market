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
- [x] 게이트 2·3·4 통과: events 13건 확정, 대시보드 4화면, Vercel 배포(https://dnf-market-analyst.vercel.app)
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
