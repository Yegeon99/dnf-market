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


def summarize_auction(rows: list) -> dict:
    """등록 매물 rows → 집계. 평균 단가는 수량 가중 평균."""
    if not rows:
        return {"minUnitPrice": None, "avgUnitPrice": None, "listingCount": 0}
    total_qty = sum(r.get("count", 0) or 0 for r in rows)
    if total_qty > 0:
        weighted = sum((r.get("unitPrice", 0) or 0) * (r.get("count", 0) or 0) for r in rows)
        avg = round(weighted / total_qty, 2)
    else:
        avg = round(sum(r.get("unitPrice", 0) or 0 for r in rows) / len(rows), 2)
    return {
        "minUnitPrice": min(r.get("unitPrice", 0) or 0 for r in rows),
        "avgUnitPrice": avg,
        "listingCount": len(rows),  # API가 총 매물 수를 주지 않아 rows 수(상한 400)로 기록
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
        return {"soldCount24h": 0, "soldAvgUnitPrice24h": None, "soldCapped": len(rows) >= 100}
    total_qty = sum(r.get("count", 0) or 0 for r in recent)
    if total_qty > 0:
        weighted = sum((r.get("unitPrice", 0) or 0) * (r.get("count", 0) or 0) for r in recent)
        avg = round(weighted / total_qty, 2)
    else:
        avg = round(sum(r.get("unitPrice", 0) or 0 for r in recent) / len(recent), 2)
    return {
        "soldCount24h": len(recent),
        "soldAvgUnitPrice24h": avg,
        # 100건 상한에 걸리면 실제 판매는 더 많을 수 있음 — 정직하게 표시
        "soldCapped": len(rows) >= 100,
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
            failures.append({"itemId": item_id, "name": name, "endpoint": "auction", "error": str(err)})
            record.update({"minUnitPrice": None, "avgUnitPrice": None, "listingCount": None})
            server_errors += is_server_error(err)
        time.sleep(CALL_INTERVAL_SEC)

        try:
            data = api_get(session, "/df/auction-sold", {"itemId": item_id, "limit": 100},
                           key, retry=not outage)
            call_count += 1
            record.update(summarize_sold(data.get("rows", []), now))
        except RuntimeError as err:
            failures.append({"itemId": item_id, "name": name, "endpoint": "auction-sold", "error": str(err)})
            record.update({"soldCount24h": None, "soldAvgUnitPrice24h": None, "soldCapped": False})
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

    snapshot = {
        "collectedAt": now.strftime("%Y-%m-%d %H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "slot": slot,
        "itemCount": len(collected),
        "apiCalls": call_count,
        "outage": outage,
        "items": collected,
        "failures": failures,
    }

    out_dir = ROOT / "data" / "snapshots"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{now.strftime('%Y-%m-%d_%H%M')}.json"
    out_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8")

    log.info("스냅샷 저장: %s (품목 %d, 호출 %d, 실패 %d)",
             out_path.name, len(collected), call_count, len(failures))
    # 부분 실패는 성공분을 저장하고 정상 종료. 전 품목 실패만 오류로 처리.
    if failures and len(failures) >= len(items) * 2:
        log.error("전 품목 수집 실패")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
