# -*- coding: utf-8 -*-
"""AI 맥락 해석기 (PL-4).

당일 이상 항목별로 ±3일 이내 events.csv 이벤트를 교차해 원인 가설을 생성한다.

정직성 원칙 (지침서 절대 규칙 7):
- 후보 이벤트가 ±3일 내에 없으면 LLM을 호출하지 않고 "원인 미상, 관찰 지속" 기록
- LLM 응답의 evidence_urls가 후보 목록 밖이면 무효 처리 → "원인 미상, 관찰 지속"
- LLM이 낸 가설은 신뢰도(확정/추정)가 없으면 기록하지 않는다
- 원인 미상은 가설이 아니므로 신뢰도를 붙이지 않는다 (confidence=None)

비용 통제 (절대 규칙 9): 이상 항목에만 호출, 모델은 claude-haiku-4-5,
일 상한 초과 시 LLMBudgetExceeded로 실행 중단.
"""

import argparse
import csv
import json
import sys
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from llm import LLMBudgetExceeded, check_budget, get_client, parse_json_block, record_call

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
ANOMALIES_PATH = ROOT / "data" / "anomalies.json"
EVENTS_PATH = ROOT / "config" / "events.csv"
SYSTEM_PROMPT = (ROOT / "pipeline" / "prompts" / "interpret_system.txt").read_text(encoding="utf-8-sig")

MODEL = "claude-haiku-4-5"
EVENT_WINDOW_DAYS = 3

# 원인 미상은 가설이 아니므로 신뢰도를 붙이지 않는다 (confidence=None → 대시보드 뱃지 미표시)
UNKNOWN = {"text": "원인 미상, 관찰 지속", "evidence_urls": [], "confidence": None}


def load_events() -> list:
    if not EVENTS_PATH.exists():
        return []
    with EVENTS_PATH.open(encoding="utf-8-sig", newline="") as f:
        return [row for row in csv.DictReader(f) if row.get("date") and row.get("title")]


def events_near(events: list, date_str: str) -> list:
    """±EVENT_WINDOW_DAYS 이내 이벤트 중 개별 공지 URL이 있는 것만.

    목록 페이지나 빈 URL은 독자가 그 공지를 확인할 수 없어 근거가 되지 못한다.
    근거로 쓸 수 없는 후보를 넘기면 호출만 늘고 결과는 어차피 원인 미상이다.
    """
    target = datetime.strptime(date_str, "%Y-%m-%d")
    out = []
    for ev in events:
        url = (ev.get("url") or "").strip()
        if not url or url.endswith("/list"):
            continue
        try:
            d = datetime.strptime(ev["date"], "%Y-%m-%d")
        except ValueError:
            continue
        if abs((d - target).days) <= EVENT_WINDOW_DAYS:
            out.append(ev)
    return out


def interpret_one(client, anomaly: dict, candidates: list) -> tuple[dict, float]:
    """이상 1건 해석. (가설, 비용) 반환. 후보 없으면 LLM 미호출."""
    if not candidates:
        return dict(UNKNOWN), 0.0

    check_budget()
    user_payload = {
        "anomaly": {
            "itemName": anomaly["itemName"],
            "date": anomaly["date"],
            "metric": anomaly["metric"],
            "basis": anomaly.get("basis"),
            "change_pct": anomaly["change_pct"],
            "direction": anomaly["direction"],
            "baseValue": anomaly.get("baseValue"),
            "currentValue": anomaly.get("currentValue"),
        },
        "candidate_events": candidates,
    }
    resp = client.messages.create(
        model=MODEL,
        max_tokens=600,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)}],
    )
    cost = record_call(MODEL, resp.usage, "interpret")

    try:
        text = next(b.text for b in resp.content if b.type == "text")
        hyp = parse_json_block(text)
        assert isinstance(hyp.get("text"), str) and hyp["text"]
        assert hyp.get("confidence") in ("확정", "추정")
        urls = hyp.get("evidence_urls") or []
        allowed = {(ev.get("url") or "").strip() for ev in candidates} - {""}
        # 후보 목록 밖 URL이 섞이면 근거 무효 → 원인 미상 처리 (규칙 7)
        if any(u not in allowed for u in urls):
            return dict(UNKNOWN), cost
        return {"text": hyp["text"], "evidence_urls": urls, "confidence": hyp["confidence"]}, cost
    except (StopIteration, ValueError, AssertionError, KeyError):
        return dict(UNKNOWN), cost


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=None, help="해석 대상 날짜 (기본: 오늘 KST)")
    parser.add_argument("--backfill", action="store_true",
                        help="가설이 아직 없는 모든 날짜의 이상 항목을 해석한다")
    args = parser.parse_args()
    target_date = args.date or datetime.now(KST).strftime("%Y-%m-%d")

    if not ANOMALIES_PATH.exists():
        print("anomalies.json 없음 — 해석 건너뜀")
        return 0
    doc = json.loads(ANOMALIES_PATH.read_text(encoding="utf-8-sig"))
    targets = [a for a in doc["anomalies"]
               if not a.get("ai_hypothesis")
               and (args.backfill or a["date"] == target_date)]
    if not targets:
        print(f"해석 대상 없음 ({target_date})")
        return 0

    events = load_events()
    client = get_client()
    total_cost, done = 0.0, 0
    try:
        for a in targets:
            candidates = events_near(events, a["date"])
            hyp, cost = interpret_one(client, a, candidates)
            a["ai_hypothesis"] = hyp
            total_cost += cost
            done += 1
    except LLMBudgetExceeded as err:
        print(str(err))
        # 처리분까지 저장 후 실패 종료 → Actions 로그로 보고
        ANOMALIES_PATH.write_text(
            json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        return 1

    ANOMALIES_PATH.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"해석 완료: {done}건, LLM 비용 ${total_cost:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
