# -*- coding: utf-8 -*-
"""심야 통합 실행기 (PL-6, daily.yml에서 호출).

수집 → 집계 → 이상 탐지 → AI 해석 → 브리핑 순서로 실행한다.
- 수집·집계 실패 시 이후 단계 중단 (데이터 없이 분석 금지)
- 해석·브리핑 실패는 종료 코드로 전파 (Actions 로그로 보고)
"""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

STEPS = [
    ("수집", "collect.py", True),      # (이름, 스크립트, 실패 시 중단 여부)
    ("집계", "aggregate.py", True),
    ("이상 탐지", "detect.py", True),
    ("AI 해석", "interpret.py", False),
    ("브리핑", "briefing.py", False),
]


def main() -> int:
    exit_code = 0
    for name, script, critical in STEPS:
        print(f"=== {name} ({script}) ===", flush=True)
        result = subprocess.run([sys.executable, str(HERE / script)], cwd=HERE)
        if result.returncode != 0:
            print(f"{name} 실패 (exit {result.returncode})", flush=True)
            if critical:
                return result.returncode
            exit_code = result.returncode  # 비치명 단계는 계속 진행하되 실패 전파
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
