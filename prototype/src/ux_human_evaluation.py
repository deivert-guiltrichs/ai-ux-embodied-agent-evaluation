import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
HUMAN_EVALUATIONS_DIR = DATA_DIR / "human_evaluations"

HUMAN_EVALUATIONS_DIR.mkdir(parents=True, exist_ok=True)


class UXHumanEvaluationService:
    def save_evaluation(self, evaluation_data: Dict[str, Any]) -> Dict[str, Any]:
        session_id = evaluation_data.get("session_id")

        if not session_id:
            raise ValueError("La evaluación debe incluir session_id.")

        enriched_data = {
            "session_id": session_id,
            "source": "human",
            "instrument": "UEQ-S",
            "created_at": datetime.now().isoformat(),
            "answers": evaluation_data.get("answers", {}),
            "open_comment": evaluation_data.get("open_comment", ""),
            "scores": self._calculate_scores(evaluation_data.get("answers", {}))
        }

        output_file = HUMAN_EVALUATIONS_DIR / f"{session_id}_human_ueqs.json"

        with open(output_file, "w", encoding="utf-8") as file:
            json.dump(enriched_data, file, ensure_ascii=False, indent=4)

        return {
            "session_id": session_id,
            "saved": True,
            "evaluation_path": str(output_file),
            "scores": enriched_data["scores"]
        }

    def _calculate_scores(self, answers: Dict[str, int]) -> Dict[str, float]:
        pragmatic_items = ["item_1", "item_2", "item_3", "item_4"]
        hedonic_items = ["item_5", "item_6", "item_7", "item_8"]

        pragmatic_score = self._average_items(answers, pragmatic_items)
        hedonic_score = self._average_items(answers, hedonic_items)

        all_items = pragmatic_items + hedonic_items
        global_score = self._average_items(answers, all_items)

        return {
            "pragmatic_quality": pragmatic_score,
            "hedonic_quality": hedonic_score,
            "global_score": global_score
        }

    def _average_items(self, answers: Dict[str, int], items: list[str]) -> float:
        values = []

        for item in items:
            value = answers.get(item)

            if isinstance(value, int) or isinstance(value, float):
                values.append(float(value))

        if not values:
            return 0.0

        return round(sum(values) / len(values), 2)