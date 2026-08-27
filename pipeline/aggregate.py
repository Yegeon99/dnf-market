# -*- coding: utf-8 -*-
"""시계열 집계기 (PL-2).

data/snapshots/*.json 을 data/timeseries.json 으로 병합한다.
같은 (itemId, date, slot) 레코드는 나중 스냅샷으로 덮어써 중복을 방지한다
(재실행에 안전한 멱등 구조).
"""

import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAP_DIR = ROOT / "data" / "snapshots"
OUT_PATH = ROOT / "data" / "timeseries.json"

FIELDS = [
    "minUnitPrice", "avgUnitPrice", "listingCount",
    "soldCount24h", "soldAvgUnitPrice24h", "soldCapped",
]


def main() -> int:
    snapshots = sorted(SNAP_DIR.glob("*.json"))
    if not snapshots:
        print("스냅샷 없음 — 집계 건너뜀")
        return 0

    merged = {}  # (itemId, date, slot) -> record
    for path in snapshots:
        try:
            snap = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as err:
            print(f"스냅샷 읽기 실패(건너뜀): {path.name} — {type(err).__name__}")
            continue
        date = snap.get("date")
        # 슬롯은 collectedAt에서 재산출 (구 3슬롯 체계 스냅샷도 6슬롯 라벨로 일관 병합)
        slot = snap.get("slot")
        try:
            h = datetime.strptime(snap["collectedAt"], "%Y-%m-%d %H:%M:%S").hour
            slot = ("h03" if h < 5 else "h07" if h < 9 else "h11" if h < 13
                    else "h15" if h < 17 else "h19" if h < 21 else "h23")
        except (KeyError, ValueError):
            pass  # collectedAt 없으면 저장된 슬롯 유지
        if not date or not slot:
            continue
        # 전 품목 수집 실패 회차는 병합하지 않는다.
        # 값이 하나도 없는 레코드를 넣으면 "최근 수집" 라벨이 실패 회차를 가리켜 거짓말이 된다.
        # 정책: 실패 회차는 저장하지 않고 차트에 공백으로 남긴다 (방법론 페이지 고지와 동일).
        items = snap.get("items", [])
        if items and not any(
            it.get("avgUnitPrice") is not None
            or it.get("listingCount") is not None
            or it.get("soldCount24h") is not None
            for it in items
        ):
            print(f"전 품목 수집 실패 회차, 병합 건너뜀: {path.name} ({date} {slot})")
            continue
        for it in items:
            rec = {"itemId": it["itemId"], "date": date, "slot": slot}
            for f in FIELDS:
                rec[f] = it.get(f)
            merged[(it["itemId"], date, slot)] = rec

    rows = sorted(merged.values(), key=lambda r: (r["date"], r["slot"], r["itemId"]))
    OUT_PATH.write_text(
        json.dumps({"updatedFrom": len(snapshots), "rows": rows}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"timeseries.json 갱신: 스냅샷 {len(snapshots)}개 → 레코드 {len(rows)}건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
