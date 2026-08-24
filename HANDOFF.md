# HANDOFF — 2026-08-25 (내일 재개용)

## 완료된 것

- [x] Phase 0 전체: 구조·venv·dashboard 스캐폴드, 네오플 정책 정독·요약, 실키 테스트 호출
- [x] 품목 후보 64종 실매물 검증 → **31종 확정** (`config/items.json`)
- [x] GitHub 저장소 생성: https://github.com/Yegeon99/dnf-market-analyst (Public, origin 연결됨)
- [x] gh CLI 설치·로그인 (계정 Yegeon99, keyring)
- [x] Phase 1 구현: `pipeline/collect.py`, `pipeline/aggregate.py`, `.github/workflows/snapshot.yml`
- [x] 로컬 수집 검증 성공: 31품목, API 62호출, 실패 0, 스냅샷·timeseries.json 생성
- [x] 보안 3종 통과: .env 미추적, 키 문자열 스캔 0건, .gitignore 확인
- [x] 첫 커밋 + 마무리 커밋 (로컬)

## 남은 것

- [ ] gh 토큰에 **workflow 스코프 추가** — 디바이스 코드 인증이 3회 만료됨 (사용자 브라우저 입력 필요)
- [ ] 푸시 (workflow 스코프 없으면 snapshot.yml 포함 푸시가 거부됨)
- [ ] `gh secret set`으로 NEOPLE_API_KEY 등록 (.env에서 읽기, 로그 노출 금지)
- [ ] ANTHROPIC_API_KEY — **.env에 아직 값 없음**. 사용자에게 받은 후 Secrets 등록 (빈 값 등록 금지)
- [ ] workflow_dispatch 수동 실행 1회 → Actions 환경에서 스냅샷 생성·data/ 한정 커밋 검증
- [ ] 게이트 1 보고 (저장소 URL, Secrets 확인, 수동 실행 결과, cron 등록 상태, 문제·해결)

## 내일 첫 작업 순서

1. 사용자가 브라우저 대기 상태인지 확인 후 `gh auth refresh --hostname github.com --scopes workflow`
   백그라운드 실행 → 코드 안내 → 즉시 입력받기 (코드 유효 약 15분, 만료 3회 전적 있음)
2. `git push -u origin master`
3. Secrets 등록·확인 (`gh secret list`)
4. Actions 수동 실행: `gh workflow run snapshot.yml` → 결과 확인 (`gh run watch`)
5. 게이트 1 보고 후 대기

## 주의사항

- **인증 성공 전까지 Actions 미가동 = 스냅샷이 아직 쌓이지 않고 있음.**
  현재 데이터는 로컬 검증 1회분(2026-08-25_0041.json, night 슬롯)뿐.
  시계열 축적은 푸시 + Secrets 등록이 끝나야 시작된다 — 내일 최우선.
- gh 경로: `C:\Program Files\GitHub CLI\gh.exe` (새 셸에서 PATH에 없을 수 있음)
- 커밋·푸시는 이 프로젝트에 한해 위임받음. 메시지 [phase-N] 한국어 형식.
- PowerShell 문자열 보간에서 `$var건`처럼 한글이 붙으면 `${var}건`으로.
- 로컬 파이프라인 실행: `.venv/Scripts/python.exe pipeline/collect.py`
