#!/usr/bin/env bash
# data/ 경로만 커밋해 원격에 올린다. 인자: 커밋 메시지.
#
# 다른 회차가 먼저 푸시해 우리 커밋이 밀리는 경우가 있다.
# 이때 rebase 로 풀면 두 회차가 같은 분에 만든 스냅샷에서 add/add 충돌이 나고,
# timeseries.json 도 내용 충돌이 나서 회차 전체가 실패한다.
#
# 그래서 충돌을 "푸는" 대신 결정적으로 다시 만든다.
#   1. 원격 최신으로 초기화 (다른 회차의 스냅샷을 그대로 확보)
#   2. 우리 회차가 만든 data/ 파일을 그 위에 얹는다
#   3. timeseries.json 은 디스크에 있는 전체 스냅샷으로 재생성
# 시계열은 스냅샷에서 파생되는 파일이라 재생성이 항상 정답이다.
set -uo pipefail

MSG="$1"
RETRIES=3

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git add data/
if git diff --cached --quiet; then
  echo "변경 없음 — 커밋 생략"
  exit 0
fi
git commit -m "$MSG"

for attempt in $(seq 1 $RETRIES); do
  if git push; then
    echo "푸시 성공 (시도 $attempt)"
    exit 0
  fi
  echo "::warning::푸시 실패 ($attempt/$RETRIES), 원격 최신 위에 데이터를 다시 얹고 재시도"

  ours=$(git rev-parse HEAD)
  git fetch origin master || { sleep 5; continue; }
  git reset --hard origin/master
  git checkout "$ours" -- data/      # 원격에만 있는 파일은 그대로 남는다
  python pipeline/aggregate.py       # 스냅샷 전체 기준으로 시계열 재생성

  git add data/
  if git diff --cached --quiet; then
    echo "원격이 이미 같은 내용을 담고 있음 — 추가 커밋 없이 종료"
    exit 0
  fi
  git commit -m "$MSG"
  sleep 5
done

echo "::error title=데이터 푸시 실패::원격 반영을 $RETRIES회 시도했지만 push가 모두 실패했습니다."
exit 1
