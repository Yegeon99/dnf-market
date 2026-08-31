# -*- coding: utf-8 -*-
"""스냅샷 수집기 (PL-1).

config/items.json의 추적 품목을 품목당 2회(경매장 등록가 + 판매 완료) 호출해
집계 필드만 추린 스냅샷을 data/snapshots/에 저장한다.

약관 대응: 원본 API 응답을 그대로 저장하지 않는다. 분석에 필요한
집계 수치(최저/평균 단가, 매물 수, 판매 수)만 남긴다.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
API_BASE = "https://api.neople.co.kr"

# API 매너 (지침서 절대 규칙 4, 2026-08-27 개정):
# 호출 간 최소 대기 + 재시도 총 2회, 간격은 30초·120초 백오프.
# 단 점검처럼 서버가 통째로 내려간 구간에서는 재시도가 무의미한 호출만 늘린다.
# 그래서 앞선 OUTAGE_PROBE_ITEMS개 품목이 두 엔드포인트 모두 5xx면
# 남은 품목의 재시도를 끊고 그대로 실패 처리한다.
CALL_INTERVAL_SEC = 0.3
RETRY_LIMIT = 2
RETRY_BACKOFF_SEC = (30.0, 120.0)
TIMEOUT_SEC = 15
OUTAGE_PROBE_ITEMS = 5

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("collect")


def load_api_key() -> str:
    key = os.environ.get("NEOPLE_API_KEY", "").strip()
    if not key:
        try:
            from dotenv import load_dotenv
            load_dotenv(ROOT / ".env")
            key = os.environ.get("NEOPLE_API_KEY", "").strip()
        except ImportError:
            pass
    if not key:
        log.error("NEOPLE_API_KEY가 없습니다 (.env 또는 환경변수 확인)")
        sys.exit(1)
    return key


def slot_for(now_kst: datetime) -> str:
    """수집 시각 → 슬롯 라벨. 하루 6회 스케줄(KST 02:17/07:17/11:17/15:17/19:17/23:17) 구간 매핑.

    슬롯 id는 시계열 호환을 위해 기존 h03/h07/... 을 그대로 쓴다 (구간 경계도 동일).

    구간: [0,5)→h03, [5,9)→h07, [9,13)→h11, [13,17)→h15, [17,21)→h19, [21,24)→h23
    """
    h = now_kst.hour
    if h < 5:
        return "h03"
    if h < 9:
        return "h07"
    if h < 13:
        return "h11"
    if h < 17:
        return "h15"
    if h < 21:
        return "h19"
    return "h23"


def api_get(session: requests.Session, path: str, params: dict, key: str, retry: bool = True):
    """GET. retry=False면 재시도 없이 1회만 시도한다 (서버 전면 장애 구간).
    키는 로그에 절대 남기지 않는다."""
    params = dict(params, apikey=key)
    attempts = RETRY_LIMIT + 1 if retry else 1
    last_err = None
    for attempt in range(attempts):
        try:
            resp = session.get(f"{API_BASE}{path}", params=params, timeout=TIMEOUT_SEC)
            if resp.status_code == 200:
                return resp.json()
            last_err = f"HTTP {resp.status_code}"
        except requests.RequestException as exc:
            last_err = type(exc).__name__
        if attempt < attempts - 1:
            time.sleep(RETRY_BACKOFF_SEC[attempt])
    raise RuntimeError(last_err)


def is_server_error(err: Exception) -> bool:
    """5xx 여부. 연결 예외는 서버 장애로 단정하지 않는다."""
    return str(err).startswith("HTTP 5")


def failure_kind(error: str) -> str:
    """실패 사유 분류. 종료 코드 판단 기준이다.

    outage: 5xx·네트워크 예외 — 우리 잘못이 아닌 외부 장애(정기점검 등)
    auth:   401/403 — 키 미등록·만료
    client: 그 외 4xx — 요청 형식·호출 빈도 등 우리 쪽 코드·설정 오류
    """
    if error.startswith("HTTP 5"):
        return "outage"
    if error in ("HTTP 401", "HTTP 403"):
        return "auth"
    if error.startswith("HTTP 4"):
        return "client"
    return "outage"  # requests 예외명(ConnectionError·Timeout 등)


def step_summary(text: str) -> None:
    """Actions 실행 요약란에 기록. 로컬 실행이면 조용히 넘어간다."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(text + "\n")
    except OSError as exc:
        log.warning("Actions 요약 기록 실패: %s", type(exc).__name__)


def weighted_median(pairs: list) -> float | None:
    """(단가, 수량) 목록의 수량 가중 중앙값.

    경매장에는 시세의 수십 배로 올려둔 매물이 상시 섞인다. 매물이 몇 건뿐인
    품목에서는 그 한 건이 평균을 통째로 끌고 가므로(실측: 매물 2건짜리 품목의
    평균가가 실거래가의 10배) 대표값은 평균이 아니라 중앙값을 쓴다.
    """
    clean = [(p, q) for p, q in pairs if p is not None and p > 0 and q > 0]
    if not clean:
        return None
    clean.sort(key=lambda t: t[0])
    total = sum(q for _, q in clean)
    half = total / 2
    run = 0
    for price, qty in clean:
        run += qty
        if run >= half:
            return float(price)
    return float(clean[-1][0])


def summarize_auction(rows: list) -> dict:
    """등록 매물 rows → 집계.

    대표값은 medUnitPrice(수량 가중 중앙값)다. avgUnitPrice(수량 가중 평균)는
    기존 시계열과의 연속성을 위해 계속 기록하되, 화면·탐지의 기준값은 아니다.
    """
    if not rows:
        return {"minUnitPrice": None, "avgUnitPrice": None, "medUnitPrice": None,
                "listingCount": 0, "listingQty": 0}
    pairs = [(r.get("unitPrice"), r.get("count", 0) or 0) for r in rows]
    total_qty = sum(q for _, q in pairs)
    if total_qty > 0:
        weighted = sum((p or 0) * q for p, q in pairs)
        avg = round(weighted / total_qty, 2)
    else:
        avg = round(sum(r.get("unitPrice", 0) or 0 for r in rows) / len(rows), 2)
    med = weighted_median(pairs)
    return {
        "minUnitPrice": min(r.get("unitPrice", 0) or 0 for r in rows),
        "avgUnitPrice": avg,
        "medUnitPrice": round(med, 2) if med is not None else None,
        "listingCount": len(rows),  # 등록 "건수" (묶음 단위). API 상한 400건
        "listingQty": total_qty,    # 등록 총 "수량". 건수와 다르므로 따로 기록
    }


def summarize_sold(rows: list, now_kst: datetime) -> dict:
    """판매 완료 rows(최근 100건 상한) → 최근 24시간 집계."""
    cutoff = now_kst - timedelta(hours=24)
    recent = []
    for r in rows:
        try:
            sold_at = datetime.strptime(r["soldDate"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=KST)
        except (KeyError, ValueError):
            continue
        if sold_at >= cutoff:
            recent.append(r)
    if not recent:
        return {"soldCount24h": 0, "soldAvgUnitPrice24h": None, "soldMedUnitPrice24h": None,
                "soldCapped": len(rows) >= 100, "soldWindowHours": None}
    pairs = [(r.get("unitPrice"), r.get("count", 0) or 0) for r in recent]
    total_qty = sum(q for _, q in pairs)
    if total_qty > 0:
        weighted = sum((p or 0) * q for p, q in pairs)
        avg = round(weighted / total_qty, 2)
    else:
        avg = round(sum(r.get("unitPrice", 0) or 0 for r in recent) / len(recent), 2)
    med = weighted_median(pairs)
    # 100건 상한에 걸리면 이 값이 실제로 덮는 구간은 24시간이 아니라 훨씬 짧다.
    # 화면이 "24시간"이라고 단정하지 않도록 실제 커버 구간을 함께 기록한다.
    stamps = []
    for r in recent:
        try:
            stamps.append(datetime.strptime(r["soldDate"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=KST))
        except (KeyError, ValueError):
            continue
    window_hours = None
    if stamps:
        window_hours = round((now_kst - min(stamps)).total_seconds() / 3600, 1)
    return {
        "soldCount24h": len(recent),
        "soldAvgUnitPrice24h": avg,
        "soldMedUnitPrice24h": round(med, 2) if med is not None else None,
        # 100건 상한에 걸리면 실제 판매는 더 많을 수 있음 — 정직하게 표시
        "soldCapped": len(rows) >= 100,
        "soldWindowHours": window_hours,
    }


def main() -> int:
    key = load_api_key()
    items = json.loads((ROOT / "config" / "items.json").read_text(encoding="utf-8-sig"))["items"]
    now = datetime.now(KST)
    slot = slot_for(now)

    session = requests.Session()
    collected, failures = [], []
    call_count = 0
    outage = False       # 서버 전면 장애로 판단되면 남은 품목은 재시도 없이 진행
    probe_dead = 0       # 앞선 품목 중 두 엔드포인트 모두 5xx인 품목 수

    for idx, it in enumerate(items):
        item_id, name = it["itemId"], it["name"]
        record = {"itemId": item_id, "name": name}
        server_errors = 0

        try:
            data = api_get(session, "/df/auction",
                           {"itemId": item_id, "limit": 400, "sort": "unitPrice:asc"},
                           key, retry=not outage)
            call_count += 1
            record.update(summarize_auction(data.get("rows", [])))
        except RuntimeError as err:
            failures.append({"itemId": item_id, "name": name, "endpoint": "auction",
                             "error": str(err), "kind": failure_kind(str(err))})
            record.update({"minUnitPrice": None, "avgUnitPrice": None, "medUnitPrice": None,
                           "listingCount": None, "listingQty": None})
            server_errors += is_server_error(err)
        time.sleep(CALL_INTERVAL_SEC)

        try:
            data = api_get(session, "/df/auction-sold", {"itemId": item_id, "limit": 100},
                           key, retry=not outage)
            call_count += 1
            record.update(summarize_sold(data.get("rows", []), now))
        except RuntimeError as err:
            failures.append({"itemId": item_id, "name": name, "endpoint": "auction-sold",
                             "error": str(err), "kind": failure_kind(str(err))})
            record.update({"soldCount24h": None, "soldAvgUnitPrice24h": None,
                           "soldMedUnitPrice24h": None, "soldCapped": False,
                           "soldWindowHours": None})
            server_errors += is_server_error(err)
        time.sleep(CALL_INTERVAL_SEC)

        collected.append(record)

        # 전면 장애 판정: 앞선 OUTAGE_PROBE_ITEMS개 품목이 모두 두 엔드포인트 5xx
        if not outage and idx < OUTAGE_PROBE_ITEMS:
            if server_errors == 2:
                probe_dead += 1
            if idx + 1 == OUTAGE_PROBE_ITEMS and probe_dead == OUTAGE_PROBE_ITEMS:
                outage = True
                log.error("앞선 %d개 품목이 모두 서버 오류(5xx). 점검 구간으로 보고 남은 재시도를 중단합니다",
                          OUTAGE_PROBE_ITEMS)

    kind_counts = {}
    for f in failures:
        kind_counts[f["kind"]] = kind_counts.get(f["kind"], 0) + 1

    snapshot = {
        "collectedAt": now.strftime("%Y-%m-%d %H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "slot": slot,
        "itemCount": len(collected),
        "apiCalls": call_count,
        "outage": outage,
        "failureKinds": kind_counts,
        "items": collected,
        "failures": failures,
    }

    out_dir = ROOT / "data" / "snapshots"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{now.strftime('%Y-%m-%d_%H%M')}.json"
    out_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8")

    log.info("스냅샷 저장: %s (품목 %d, 호출 %d, 실패 %d)",
             out_path.name, len(collected), call_count, len(failures))

    expected_calls = len(items) * 2
    kind_note = ", ".join(f"{k} {v}" for k, v in sorted(kind_counts.items())) or "없음"
    step_summary(f"### 스냅샷 수집 {now.strftime('%Y-%m-%d %H:%M KST')}\n"
                 f"- 성공 {call_count} / 실패 {len(failures)} (총 {expected_calls}회 호출 예정)\n"
                 f"- 품목 {len(collected)}종, 실패 분류: {kind_note}\n"
                 f"- 파일: `{out_path.name}`")

    # 부분 실패는 성공분을 저장하고 정상 종료. 전 품목 실패만 사유별로 판정한다.
    if failures and len(failures) >= expected_calls:
        kinds = {f["kind"] for f in failures}
        if kinds == {"outage"}:
            # 오픈 API 전면 장애. 우리가 고칠 것이 없고 다음 회차가 자동으로 다시 받는다.
            # 워크플로를 빨갛게 만들지 않되 요약에 경고를 남긴다.
            log.warning("전 품목 수집 실패 — 오픈 API 외부 장애로 판단, 경고만 남기고 정상 종료")
            print("::warning title=오픈 API 외부 장애::"
                  f"추적 {len(items)}종 전 품목 수집 실패. 전부 5xx·네트워크 오류라 "
                  "외부 장애로 보고 정상 종료합니다. 다음 회차에서 자동 재수집됩니다.")
            step_summary("> 전 품목 실패지만 전부 외부 장애(5xx·네트워크)라 정상 종료했습니다.")
            return 0
        log.error("전 품목 수집 실패 — 사유에 %s 포함, 오류로 처리",
                  "/".join(sorted(kinds - {"outage"})))
        print("::error title=수집 실패::"
              f"전 품목 실패 사유에 {'/'.join(sorted(kinds - {'outage'}))}가 포함돼 있습니다.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
