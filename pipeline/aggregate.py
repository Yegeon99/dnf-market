# -*- coding: utf-8 -*-
"""시계열 집계기 (PL-2).

data/snapshots/*.json 을 data/timeseries.json 으로 병합한다.
같은 (itemId, date, slot) 레코드는 나중 스냅샷으로 덮어써 중복을 방지한다
(재실행에 안전한 멱등 구조).
"""

import json
import sys
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
        date, slot = snap.get("date"), snap.get("slot")
        if not date or not slot:
            continue
        for it in snap.get("items", []):
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
