# -*- coding: utf-8 -*-
"""이상 탐지기 (PL-3).

data/timeseries.json을 읽어 규칙 기반으로 이상 변동을 탐지해
data/anomalies.json에 병합한다 (기존 항목의 AI 가설은 보존).

탐지 규칙:
- 전일 대비 변동률 (avgPrice, listingCount) — 데이터 2일차부터 동작
- 7일 이동평균 이탈 — 품목별 데이터가 7일 이상 축적된 구간에서 자동 활성화
  (지침서: 데이터 7일 미만 구간은 전일 대비만 적용)

임계치는 config/thresholds.json에서 관리한다.
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
TS_PATH = ROOT / "data" / "timeseries.json"
OUT_PATH = ROOT / "data" / "anomalies.json"
THRESHOLDS_PATH = ROOT / "config" / "thresholds.json"


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8-sig"))


SLOT_ORDER = {"night": 0, "am": 1, "pm": 2}  # KST 03:00 → 09:00 → 15:00 시간순


def slot_series(rows: list) -> dict:
    """{(itemId, date): [(slot, avgPrice, listingCount)] 시간순} — 저유동 지속성 검사용."""
    out = {}
    for r in rows:
        out.setdefault((r["itemId"], r["date"]), []).append(
            (r["slot"], r.get("avgUnitPrice"), r.get("listingCount"))
        )
    for key in out:
        out[key].sort(key=lambda t: SLOT_ORDER.get(t[0], 9))
    return out


def daily_series(rows: list) -> dict:
    """timeseries rows → {itemId: [(date, avgPrice, listingCount)] 날짜 오름차순}.

    하루 최대 3슬롯을 슬롯 평균으로 대표값화한다 (결측 슬롯 허용).
    """
    by_item_date = {}
    for r in rows:
        key = (r["itemId"], r["date"])
        by_item_date.setdefault(key, []).append(r)

    series = {}
    for (item_id, date), recs in by_item_date.items():
        prices = [r["avgUnitPrice"] for r in recs if r.get("avgUnitPrice") is not None]
        counts = [r["listingCount"] for r in recs if r.get("listingCount") is not None]
        series.setdefault(item_id, []).append((
            date,
            round(sum(prices) / len(prices), 2) if prices else None,
            round(sum(counts) / len(counts), 1) if counts else None,
        ))
    for item_id in series:
        series[item_id].sort(key=lambda t: t[0])
    return series


def pct_change(prev, cur):
    if prev is None or cur is None or prev == 0:
        return None
    return round((cur - prev) / prev * 100, 2)


def severity_for(abs_pct: float, tiers: dict):
    """|변동률| → severity. 임계치 미달이면 None."""
    if "high" in tiers and abs_pct >= tiers["high"]:
        return "high"
    if "mid" in tiers and abs_pct >= tiers["mid"]:
        return "mid"
    if "low" in tiers and abs_pct >= tiers["low"]:
        return "low"
    return None


def sustained_slots(slots: list, base, metric: str, low_threshold: float, direction: str) -> int:
    """당일 슬롯들 중 '연속으로' low 임계치 이상·같은 방향 변동이 지속된 마지막 구간 길이.

    저유동 품목 보정용: 스냅샷 1회 급변(오등록·단일 거래)과 지속 변동을 구분한다.
    """
    idx = 1 if metric == "avgPrice" else 2
    streak = 0
    for slot in slots:
        val = slot[idx]
        chg = pct_change(base, val)
        ok = (
            chg is not None
            and abs(chg) >= low_threshold
            and (chg > 0 if direction == "up" else chg < 0)
        )
        streak = streak + 1 if ok else 0
    return streak


def detect_for_date(series: dict, names: dict, th: dict, target_date: str,
                    slots_map: dict | None = None) -> list:
    """target_date 기준 이상 탐지."""
    found = []
    guards = th["guards"]
    ma_cfg = th["movingAverage"]
    ll_cfg = th.get("lowLiquidity", {})
    slots_map = slots_map or {}

    for item_id, points in series.items():
        idx = next((i for i, p in enumerate(points) if p[0] == target_date), None)
        if idx is None or idx == 0:
            continue  # 당일 데이터 없음 또는 첫날(비교 대상 없음)
        date, price, count = points[idx]
        prev_date, prev_price, prev_count = points[idx - 1]

        thin_market = (count is not None and count < guards["minListingCountForPriceSignal"]) \
            and (prev_count is not None and prev_count < guards["minListingCountForPriceSignal"])

        # --- 전일 대비 ---
        checks = []
        if not thin_market:
            checks.append(("avgPrice", prev_price, price, th["dayOverDay"]["avgPrice"], "dod"))
        checks.append(("listingCount", prev_count, count, th["dayOverDay"]["listingCount"], "dod"))

        # --- 7일 이동평균 이탈 (품목별 7일 이상 축적 시 자동 활성화) ---
        window = ma_cfg["windowDays"]
        history = points[:idx]  # 당일 제외 과거
        if len(history) >= ma_cfg["minDaysRequired"]:
            recent = history[-window:]
            ma_price_vals = [p[1] for p in recent if p[1] is not None]
            ma_count_vals = [p[2] for p in recent if p[2] is not None]
            if ma_price_vals and not thin_market:
                ma_price = sum(ma_price_vals) / len(ma_price_vals)
                checks.append(("avgPrice", round(ma_price, 2), price, ma_cfg["avgPrice"], "ma7"))
            if ma_count_vals:
                ma_count = sum(ma_count_vals) / len(ma_count_vals)
                checks.append(("listingCount", round(ma_count, 1), count, ma_cfg["listingCount"], "ma7"))

        # 저유동 분류: 당일·전일 매물 수 모두 기준 미만
        ll_below = ll_cfg.get("listingCountBelow", 0)
        low_liq = bool(ll_below) and all(
            c is not None and c < ll_below for c in (count, prev_count)
        )
        today_slots = slots_map.get((item_id, target_date), [])

        for metric, base, cur, tiers, basis in checks:
            chg = pct_change(base, cur)
            if chg is None:
                continue
            sev = severity_for(abs(chg), tiers)
            if sev is None:
                continue
            direction = "up" if chg > 0 else "down"
            # 저유동 보정: 연속 슬롯 지속 없으면 mid/high → low 강등
            if low_liq and sev in ("high", "mid"):
                need = ll_cfg.get("minConsecutiveSlots", 2)
                low_tier = tiers.get("low", tiers.get("mid", 0))
                if sustained_slots(today_slots, base, metric, low_tier, direction) < need:
                    sev = "low"
            found.append({
                "id": f"{date}_{item_id}_{metric}_{basis}",
                "date": date,
                "itemId": item_id,
                "itemName": names.get(item_id, item_id),
                "metric": metric,
                "basis": basis,  # dod=전일 대비, ma7=7일 이동평균 이탈
                "baseValue": base,
                "currentValue": cur,
                "change_pct": chg,
                "direction": direction,
                "severity": sev,
                "lowLiquidity": low_liq,  # 대시보드 저유동 뱃지·해석 주의 안내용
            })

    # 같은 (품목, 지표)에 dod·ma7 둘 다 걸리면 변동률 큰 쪽만 남긴다
    dedup = {}
    for a in found:
        key = (a["itemId"], a["metric"])
        if key not in dedup or abs(a["change_pct"]) > abs(dedup[key]["change_pct"]):
            dedup[key] = a
    found = list(dedup.values())

    # 일 상한: severity(high>mid>low) → |변동률| 순으로 상위만
    sev_rank = {"high": 0, "mid": 1, "low": 2}
    found.sort(key=lambda a: (sev_rank[a["severity"]], -abs(a["change_pct"])))
    return found[: guards["maxAnomaliesPerDay"]]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="탐지 대상 날짜 (기본: 오늘 KST)", default=None)
    args = parser.parse_args()
    target_date = args.date or datetime.now(KST).strftime("%Y-%m-%d")

    ts = load_json(TS_PATH, None)
    if not ts or not ts.get("rows"):
        print("timeseries 없음 — 탐지 건너뜀")
        return 0

    items = load_json(ROOT / "config" / "items.json", {"items": []})["items"]
    names = {it["itemId"]: it["name"] for it in items}
    th = load_json(THRESHOLDS_PATH, None)
    if th is None:
        print("thresholds.json 없음 — 탐지 불가")
        return 1

    series = daily_series(ts["rows"])
    new_anomalies = detect_for_date(series, names, th, target_date, slot_series(ts["rows"]))

    existing = load_json(OUT_PATH, {"anomalies": []})["anomalies"]
    merged = {a["id"]: a for a in existing}
    added = 0
    for a in new_anomalies:
        if a["id"] in merged:
            # 기존 항목의 AI 가설 보존, 수치만 갱신
            hyp = merged[a["id"]].get("ai_hypothesis")
            if hyp:
                a["ai_hypothesis"] = hyp
        else:
            added += 1
        merged[a["id"]] = a

    rows = sorted(merged.values(), key=lambda a: (a["date"], a["id"]))
    OUT_PATH.write_text(
        json.dumps({"anomalies": rows}, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    today_count = len([a for a in rows if a["date"] == target_date])
    print(f"이상 탐지 완료: {target_date} 기준 {today_count}건 (신규 {added}건, 누적 {len(rows)}건)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
