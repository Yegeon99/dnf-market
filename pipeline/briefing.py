# -*- coding: utf-8 -*-
"""데일리 브리핑 생성기 (PL-5).

- 이상 변동이 있는 날: 이상 목록(가설 포함) + 시장 요약을 claude-opus-5에 전달해
  헤드라인·3줄 요약·주목 변동을 생성 (일 1회 호출 — 비용 통제)
- 이상 0건인 날: LLM 호출 없이 "안정 구간" 템플릿 브리핑 (억지 이슈 생성 금지,
  비용 절감 — 지침서 절대 규칙 9)
- 당일 전 품목 수집 실패한 날: LLM 호출 없이 "수집 실패" 템플릿 브리핑.
  첫 줄에 "당일 수집 실패로 전일 데이터 기준"을 명시한다 (브리핑을 건너뛰면
  독자는 그날 무슨 일이 있었는지 알 길이 없다)

브리핑 1회당 비용을 기록에 남긴다 (data/llm_costs.json + briefings.json costUsd).
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from detect import daily_series, dod_changes, load_json, pct_change
from llm import LLMBudgetExceeded, check_budget, get_client, parse_json_block, record_call

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
TS_PATH = ROOT / "data" / "timeseries.json"
ANOMALIES_PATH = ROOT / "data" / "anomalies.json"
OUT_PATH = ROOT / "data" / "briefings.json"
SYSTEM_PROMPT = (ROOT / "pipeline" / "prompts" / "briefing_system.txt").read_text(encoding="utf-8-sig")

MODEL = "claude-opus-5"


def market_summary(target_date: str) -> dict:
    """시장 요약: 추적 품목 수, 전일 대비 상승/하락 상위."""
    ts = load_json(TS_PATH, None)
    items = load_json(ROOT / "config" / "items.json", {"items": []})["items"]
    names = {it["itemId"]: it["name"] for it in items}
    summary = {"trackedItems": len(items), "topUp": [], "topDown": [], "hasPrevDay": False}
    if not ts or not ts.get("rows"):
        return summary

    # 탐지기와 같은 기준(공통 슬롯 + 중앙값)을 쓴다. 기준이 갈리면 브리핑 본문과
    # 이상 목록이 서로 다른 1위를 말하게 된다.
    changes = dod_changes(ts["rows"], names, target_date)
    if changes:
        summary["hasPrevDay"] = True
        changes.sort(key=lambda c: c["change_pct"], reverse=True)
        summary["topUp"] = [c for c in changes[:3] if c["change_pct"] > 0]
        summary["topDown"] = [c for c in sorted(changes, key=lambda c: c["change_pct"])[:3]
                              if c["change_pct"] < 0]
    return summary


def collection_failed(target_date: str) -> bool:
    """당일 스냅샷은 남았는데 값이 하나도 없으면 전 품목 수집 실패로 본다.
    스냅샷 자체가 없으면(회차 미실행) False — 실패라고 단정하지 않는다."""
    snaps = sorted((ROOT / "data" / "snapshots").glob(f"{target_date}_*.json"))
    if not snaps:
        return False
    for path in snaps:
        try:
            snap = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        for it in snap.get("items", []):
            if (it.get("avgUnitPrice") is not None or it.get("listingCount") is not None
                    or it.get("soldCount24h") is not None):
                return False
    return True


def failed_collection_briefing(target_date: str) -> dict:
    """당일 수집 실패 → 전일 데이터 기준임을 첫 줄에 밝히고 발행한다 (LLM 미호출)."""
    ts = load_json(TS_PATH, {"rows": []})
    dates = sorted({r["date"] for r in ts.get("rows", [])})
    last_date = dates[-1] if dates else None
    items = load_json(ROOT / "config" / "items.json", {"items": []})["items"]
    n = len(items)

    lines = [
        f"발행 시점(심야 회차) 수집이 실패해 전일({last_date}) 데이터 기준입니다."
        f" 오픈 API가 추적 {n}종 전 품목에 오류를 반환했습니다."
        f" 이후 회차가 성공하면 {target_date} 데이터는 차트에 채워집니다."
        if last_date else
        f"발행 시점(심야 회차) 수집이 실패했습니다."
        f" 오픈 API가 추적 {n}종 전 품목에 오류를 반환했습니다.",
    ]
    summary = market_summary(last_date) if last_date else {"topUp": [], "topDown": []}
    if summary.get("topUp") or summary.get("topDown"):
        up = summary["topUp"][0] if summary.get("topUp") else None
        down = summary["topDown"][0] if summary.get("topDown") else None
        parts = []
        if up:
            parts.append(f"상승은 {up['itemName']} +{up['change_pct']}%가 가장 컸습니다")
        if down:
            parts.append(f"하락은 {down['itemName']} {down['change_pct']}%가 가장 컸습니다")
        parts[0] = f"전일({last_date}) 기준 " + parts[0]  # 두 내용은 두 문장으로 나눈다
        lines.append(". ".join(parts) + ".")
    else:
        lines.append(f"전일({last_date}) 기준 비교 가능한 변동 수치가 없습니다."
                     if last_date else "비교 가능한 과거 데이터가 아직 없습니다.")
    lines.append("실패한 회차는 시계열에 넣지 않고 차트에 공백으로 남깁니다."
                 " 같은 날 다음 회차부터 자동으로 다시 수집합니다.")

    return {
        "date": target_date,
        "headline": f"심야 회차 수집 실패, {last_date} 데이터 {n}종 기준 유지" if last_date
                    else f"수집 실패, {n}종 기준 데이터 없음",
        "summary_3lines": lines[:3],
        "notable": [],
        "anomaly_ids": [],
        "generatedBy": "template",
        "costUsd": 0.0,
        # 화면이 "03시 발행 시점 기준" 라벨 대신 "전일 데이터 기준"을 쓰게 하는 표식
        "collectionFailed": True,
    }


def stable_briefing(target_date: str, summary: dict) -> dict:
    """이상 0건 → LLM 없이 안정 구간 브리핑. 데이터 없는 구간은 없다고 정직하게 쓴다."""
    n = summary["trackedItems"]
    if not summary["hasPrevDay"]:
        # 수집 초기: 전일 비교 자체가 불가능 — 안정을 단정하지 않는다
        headline = f"수집 축적 구간, {n}종 스냅샷 기록. 변동 분석 대기"
        lines = [
            f"추적 품목 {n}종의 당일 스냅샷을 수집·기록했다.",
            "전일 비교 데이터가 아직 없어 변동률 산출은 다음 수집분부터 가능하다.",
            "이상 탐지는 데이터 2일차부터, 이동평균 이탈 탐지는 7일 축적 후 자동 적용된다.",
        ]
    else:
        headline = f"안정 구간, 이상 변동 0건 ({n}종 추적)"
        lines = [f"추적 품목 {n}종 전체가 이상 탐지 임계치(전일 대비 8%) 내 변동에 머물렀다."]
        if summary["topUp"]:
            t = summary["topUp"][0]
            lines.append(f"최대 상승은 {t['itemName']} +{t['change_pct']}%로 임계치 미만이다.")
        else:
            lines.append("상승 품목 없이 보합·하락 위주로 마감했다.")
        if summary["topDown"]:
            t = summary["topDown"][0]
            lines.append(f"최대 하락은 {t['itemName']} {t['change_pct']}%로 관찰 범위다.")
        else:
            lines.append("하락 측도 임계치에 근접한 품목이 없다.")
    return {
        "date": target_date,
        "headline": headline,
        "summary_3lines": lines[:3],
        "notable": [],
        "anomaly_ids": [],
        "generatedBy": "template",
        "costUsd": 0.0,
    }


def llm_briefing(target_date: str, summary: dict, anomalies: list,
                 counts: dict | None = None) -> dict:
    check_budget()
    client = get_client()
    payload = {
        "date": target_date,
        "market": summary,
        # 상한에 걸린 날은 anomalies가 그날의 전부가 아니다. 총 탐지 건수를 함께 넘겨
        # 브리핑이 저장분 10건을 총계처럼 단언하지 않게 한다.
        "anomalyCounts": counts or {"detected": len(anomalies), "stored": len(anomalies),
                                    "truncated": 0},
        "anomalies": [
            {
                "itemName": a["itemName"], "metric": a["metric"], "basis": a.get("basis"),
                "change_pct": a["change_pct"], "direction": a["direction"],
                "severity": a["severity"], "hypothesis": a.get("ai_hypothesis"),
            }
            for a in anomalies
        ],
    }
    resp = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(payload, ensure_ascii=False)}],
    )
    cost = record_call(MODEL, resp.usage, "briefing")
    text = next(b.text for b in resp.content if b.type == "text")
    out = parse_json_block(text)
    lines = out.get("summary_3lines") or []
    assert isinstance(out.get("headline"), str) and len(lines) == 3, "브리핑 형식 위반"
    return {
        "date": target_date,
        "headline": out["headline"],
        "summary_3lines": lines,
        "notable": out.get("notable") or [],
        "anomaly_ids": [a["id"] for a in anomalies],
        "generatedBy": MODEL,
        "costUsd": round(cost, 6),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=None, help="브리핑 대상 날짜 (기본: 오늘 KST)")
    args = parser.parse_args()
    target_date = args.date or datetime.now(KST).strftime("%Y-%m-%d")

    anomalies_doc = load_json(ANOMALIES_PATH, {"anomalies": []})
    today = [a for a in anomalies_doc["anomalies"] if a["date"] == target_date]
    totals = (anomalies_doc.get("dailyTotals") or {}).get(target_date) or {}
    counts = {
        "detected": totals.get("detected", len(today)),
        "stored": totals.get("stored", len(today)),
        "truncated": max(totals.get("detected", len(today)) - len(today), 0),
    }
    summary = market_summary(target_date)

    try:
        if collection_failed(target_date):
            briefing = failed_collection_briefing(target_date)
        elif today:
            briefing = llm_briefing(target_date, summary, today, counts)
        else:
            briefing = stable_briefing(target_date, summary)
    except LLMBudgetExceeded as err:
        print(str(err))
        return 1
    except (ValueError, AssertionError, StopIteration) as err:
        print(f"브리핑 생성 실패: {err}")
        return 1

    doc = load_json(OUT_PATH, {"briefings": []})
    doc["briefings"] = [b for b in doc["briefings"] if b["date"] != target_date] + [briefing]
    doc["briefings"].sort(key=lambda b: b["date"])
    OUT_PATH.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"브리핑 발행: {target_date} — {briefing['headline']} (비용 ${briefing['costUsd']:.4f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
