# -*- coding: utf-8 -*-
"""LLM 호출 공통 유틸 (interpret.py, briefing.py 공용).

- Anthropic 클라이언트 초기화 (.env 또는 환경변수)
- 호출당 비용 계산·일별 누적 기록 (data/llm_costs.json)
- 일 상한($0.3) 검사: 초과 시 LLMBudgetExceeded — 호출자는 실행을 중단하고 보고한다
  (지침서 절대 규칙 9)

키 값은 어떤 경로로도 출력하지 않는다.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
KST = ZoneInfo("Asia/Seoul")
COSTS_PATH = ROOT / "data" / "llm_costs.json"

DAILY_BUDGET_USD = 0.30  # 지침서 절대 규칙 9의 일 상한

# USD / 1M tokens (input, output) — 2026-08 기준 공식 단가
PRICING = {
    "claude-haiku-4-5": (1.00, 5.00),
    "claude-opus-5": (5.00, 25.00),
}


class LLMBudgetExceeded(RuntimeError):
    """일 LLM 비용 상한 초과 — 실행 중단 신호."""


def get_client():
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        try:
            from dotenv import load_dotenv
            load_dotenv(ROOT / ".env")
            key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
        except ImportError:
            pass
    if not key:
        print("ANTHROPIC_API_KEY 없음 (.env 또는 환경변수 확인)")
        sys.exit(1)
    import anthropic
    return anthropic.Anthropic(api_key=key)


def cost_of(model: str, input_tokens: int, output_tokens: int) -> float:
    inp, outp = PRICING[model]
    return input_tokens / 1_000_000 * inp + output_tokens / 1_000_000 * outp


def _load_ledger() -> dict:
    if COSTS_PATH.exists():
        return json.loads(COSTS_PATH.read_text(encoding="utf-8-sig"))
    return {"days": {}}


def today_spent(date: str | None = None) -> float:
    date = date or datetime.now(KST).strftime("%Y-%m-%d")
    day = _load_ledger()["days"].get(date, {})
    return day.get("costUsd", 0.0)


def check_budget(date: str | None = None):
    spent = today_spent(date)
    if spent >= DAILY_BUDGET_USD:
        raise LLMBudgetExceeded(
            f"일 LLM 비용 상한 초과: ${spent:.4f} >= ${DAILY_BUDGET_USD:.2f} — 실행 중단"
        )


def record_call(model: str, usage, caller: str, date: str | None = None) -> float:
    """호출 1건의 비용을 원장에 기록하고 비용(USD)을 반환."""
    date = date or datetime.now(KST).strftime("%Y-%m-%d")
    cost = cost_of(model, usage.input_tokens, usage.output_tokens)
    ledger = _load_ledger()
    day = ledger["days"].setdefault(
        date, {"calls": 0, "inputTokens": 0, "outputTokens": 0, "costUsd": 0.0, "byCaller": {}}
    )
    day["calls"] += 1
    day["inputTokens"] += usage.input_tokens
    day["outputTokens"] += usage.output_tokens
    day["costUsd"] = round(day["costUsd"] + cost, 6)
    by = day["byCaller"].setdefault(caller, {"calls": 0, "costUsd": 0.0})
    by["calls"] += 1
    by["costUsd"] = round(by["costUsd"] + cost, 6)
    COSTS_PATH.write_text(json.dumps(ledger, ensure_ascii=False, indent=1), encoding="utf-8")
    return cost


def parse_json_block(text: str):
    """모델 응답에서 JSON 오브젝트 파싱 (코드펜스 허용)."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        if t.startswith("json"):
            t = t[4:]
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("JSON 없음")
    return json.loads(t[start : end + 1])
