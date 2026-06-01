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

        ueqs_answers = evaluation_data.get("answers", {})
        godspeed_answers = evaluation_data.get("godspeed_answers", {})

        enriched_data = {
            "session_id": session_id,
            "source": "human",
            "instruments": ["UEQ-S", "Godspeed reducido"],
            "created_at": datetime.now().isoformat(),
            "ueqs_answers": ueqs_answers,
            "godspeed_answers": godspeed_answers,
            "open_comment": evaluation_data.get("open_comment", ""),
            "scores": {
                **self._calculate_ueqs_scores(ueqs_answers),
                **self._calculate_godspeed_scores(godspeed_answers)
            }
        }

        output_file = HUMAN_EVALUATIONS_DIR / f"{session_id}_human_ux.json"

        with open(output_file, "w", encoding="utf-8") as file:
            json.dump(enriched_data, file, ensure_ascii=False, indent=4)

        return {
            "session_id": session_id,
            "saved": True,
            "evaluation_path": str(output_file),
            "scores": enriched_data["scores"]
        }

    def _calculate_ueqs_scores(self, answers: Dict[str, int]) -> Dict[str, float]:
        pragmatic_items = ["item_1", "item_2", "item_3", "item_4"]
        hedonic_items = ["item_5", "item_6", "item_7", "item_8"]

        pragmatic_score = self._average_items(answers, pragmatic_items)
        hedonic_score = self._average_items(answers, hedonic_items)

        all_items = pragmatic_items + hedonic_items
        global_score = self._average_items(answers, all_items)

        return {
            "ueqs_pragmatic_quality": pragmatic_score,
            "ueqs_hedonic_quality": hedonic_score,
            "ueqs_global_score": global_score
        }

    def _calculate_godspeed_scores(self, answers: Dict[str, int]) -> Dict[str, float]:
        anthropomorphism_items = ["godspeed_anthro_1", "godspeed_anthro_2"]
        likeability_items = ["godspeed_like_1", "godspeed_like_2"]
        intelligence_items = ["godspeed_intel_1", "godspeed_intel_2"]
        safety_items = ["godspeed_safety_1", "godspeed_safety_2"]

        return {
            "godspeed_anthropomorphism": self._average_items(answers, anthropomorphism_items),
            "godspeed_likeability": self._average_items(answers, likeability_items),
            "godspeed_perceived_intelligence": self._average_items(answers, intelligence_items),
            "godspeed_perceived_safety": self._average_items(answers, safety_items)
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