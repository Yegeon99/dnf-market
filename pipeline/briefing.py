# -*- coding: utf-8 -*-
"""데일리 브리핑 생성기 (PL-5).

- 이상 변동이 있는 날: 이상 목록(가설 포함) + 시장 요약을 claude-opus-5에 전달해
  헤드라인·3줄 요약·주목 변동을 생성 (일 1회 호출 — 비용 통제)
- 이상 0건인 날: LLM 호출 없이 "안정 구간" 템플릿 브리핑 (억지 이슈 생성 금지,
  비용 절감 — 지침서 절대 규칙 9)

브리핑 1회당 비용을 기록에 남긴다 (data/llm_costs.json + briefings.json costUsd).
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from detect import daily_series, load_json, pct_change
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

    changes = []
    for item_id, points in daily_series(ts["rows"]).items():
        idx = next((i for i, p in enumerate(points) if p[0] == target_date), None)
        if idx is None or idx == 0:
            continue
        chg = pct_change(points[idx - 1][1], points[idx][1])
        if chg is not None:
            changes.append({"itemName": names.get(item_id, item_id), "change_pct": chg})
    if changes:
        summary["hasPrevDay"] = True
        changes.sort(key=lambda c: c["change_pct"], reverse=True)
        summary["topUp"] = [c for c in changes[:3] if c["change_pct"] > 0]
        summary["topDown"] = [c for c in sorted(changes, key=lambda c: c["change_pct"])[:3]
                              if c["change_pct"] < 0]
    return summary


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


def llm_briefing(target_date: str, summary: dict, anomalies: list) -> dict:
    check_budget()
    client = get_client()
    payload = {
        "date": target_date,
        "market": summary,
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
    summary = market_summary(target_date)

    try:
        if today:
            briefing = llm_briefing(target_date, summary, today)
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
