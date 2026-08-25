# -*- coding: utf-8 -*-
"""판매 완료(AuctionSold) 소급 백필 (1회성 실행).

실측 확인 사항 (2026-08-25):
- limit 상한 100 (그 이상 요청해도 100건), 기간 파라미터 미지원
- 보존창 약 30일 (최고 soldDate 2026-07-26)
- 고유동 품목은 100건이 1~2일치 → 소급 효과 미미
- 저유동 품목(아바타·카드류)은 최대 30일 확보 가능 → 백필 가치 있음

정직성 규칙:
- 백필 레코드는 source="backfill"로 스냅샷 수집분과 구분 (data/backfill.json 별도 저장)
- 100건 상한에 걸린 품목은 가장 오래된 날짜가 잘렸을 수 있어 그 날짜 집계를 제외
- 스냅샷 수집이 시작된 날짜(이후)는 백필하지 않음 (이중 집계 방지)
"""

import json
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

from collect import api_get, load_api_key, CALL_INTERVAL_SEC

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
OUT_PATH = ROOT / "data" / "backfill.json"
LIMIT = 100  # API 하드 상한 (실측)


def first_snapshot_date() -> str:
    snaps = sorted((ROOT / "data" / "snapshots").glob("*.json"))
    return snaps[0].name[:10] if snaps else "9999-12-31"


def main() -> int:
    key = load_api_key()
    items = json.loads((ROOT / "config" / "items.json").read_text(encoding="utf-8-sig"))["items"]
    cutoff = first_snapshot_date()  # 이 날짜부터는 스냅샷 수집분이 담당
    session = requests.Session()

    rows, failures, calls = [], [], 0
    for it in items:
        try:
            data = api_get(session, "/df/auction-sold",
                           {"itemId": it["itemId"], "limit": LIMIT}, key)
            calls += 1
        except RuntimeError as err:
            failures.append({"itemId": it["itemId"], "name": it["name"], "error": str(err)})
            time.sleep(CALL_INTERVAL_SEC)
            continue
        recs = data.get("rows", [])
        capped = len(recs) >= LIMIT

        by_date = {}
        for r in recs:
            d = (r.get("soldDate") or "")[:10]
            if not d:
                continue
            by_date.setdefault(d, []).append(r)

        dates = sorted(by_date)
        # 100건 상한이면 가장 오래된 날짜는 잘린 부분집계일 수 있어 제외
        if capped and dates:
            dates = dates[1:]

        for d in dates:
            if d >= cutoff:
                continue  # 스냅샷 기간과 중복 금지
            day = by_date[d]
            qty = sum(r.get("count", 0) or 0 for r in day)
            if qty > 0:
                avg = round(sum((r.get("unitPrice", 0) or 0) * (r.get("count", 0) or 0) for r in day) / qty, 2)
            else:
                avg = round(sum(r.get("unitPrice", 0) or 0 for r in day) / len(day), 2)
            rows.append({
                "itemId": it["itemId"],
                "date": d,
                "slot": "day",              # 백필은 일 단위 대표값
                "source": "backfill",
                "soldCountDay": len(day),
                "soldAvgUnitPriceDay": avg,
            })
        time.sleep(CALL_INTERVAL_SEC)

    rows.sort(key=lambda r: (r["date"], r["itemId"]))
    OUT_PATH.write_text(json.dumps({
        "generatedAt": datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S"),
        "method": "auction-sold 최근 100건 소급, 일 단위 수량가중 평균. 상한 걸린 품목은 최고(最古) 날짜 제외.",
        "cutoffDate": cutoff,
        "apiCalls": calls,
        "rows": rows,
        "failures": failures,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    item_cnt = len({r["itemId"] for r in rows})
    date_min = rows[0]["date"] if rows else None
    date_max = rows[-1]["date"] if rows else None
    print(f"백필 완료: {item_cnt}품목 {len(rows)}건 ({date_min}~{date_max}), 호출 {calls}, 실패 {len(failures)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
