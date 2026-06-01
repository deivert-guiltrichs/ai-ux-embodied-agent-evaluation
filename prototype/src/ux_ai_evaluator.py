import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, Any

from google import genai
from src.config import settings


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

SESSIONS_DIR = DATA_DIR / "sessions"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"
AI_EVALUATIONS_DIR = DATA_DIR / "ai_evaluations"

AI_EVALUATIONS_DIR.mkdir(parents=True, exist_ok=True)


class UXAIEvaluatorService:
    def __init__(self):
        settings.validate()

        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.evaluator_llm_model
        self.evaluator_prompt = self._load_evaluator_prompt()

    def _load_evaluator_prompt(self) -> str:
        with open(settings.llm_evaluator_prompt_path, "r", encoding="utf-8") as file:
            return file.read()

    def evaluate_session(self, session_id: str) -> Dict[str, Any]:
        transcript = self._load_transcript(session_id)
        session_data = self._load_session_metadata(session_id)
        condition_context = self._build_condition_context(session_data)

        prompt = f"""
{self.evaluator_prompt}

{condition_context}

Transcripción de la interacción:

{transcript}
"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt
            )

            raw_text = response.text or ""

            parsed_response = self._parse_json_response(raw_text)

            answers = parsed_response.get("answers", {})
            justification = parsed_response.get("justification", "")

            normalized_answers = self._normalize_answers(answers)

            evaluation_data = {
                "session_id": session_id,
                "participant_id": session_data.get("participant_id", ""),
                "condition": session_data.get("condition", ""),
                "source": "ai",
                "instrument": "UEQ-S",
                "model": self.model,
                "created_at": datetime.now().isoformat(),
                "answers": normalized_answers,
                "justification": justification,
                "scores": self._calculate_scores(normalized_answers),
                "raw_response": raw_text
            }

        except Exception as error:
            evaluation_data = self._fallback_ai_evaluation(
                session_id=session_id,
                session_data=session_data,
                error_message=str(error)
            )

        output_file = AI_EVALUATIONS_DIR / f"{session_id}_ai_ueqs.json"

        with open(output_file, "w", encoding="utf-8") as file:
            json.dump(evaluation_data, file, ensure_ascii=False, indent=4)

        return {
            "session_id": session_id,
            "saved": True,
            "evaluation_path": str(output_file),
            "scores": evaluation_data["scores"],
            "answers": evaluation_data["answers"],
            "justification": evaluation_data.get("justification", "")
        }

    def _load_transcript(self, session_id: str) -> str:
        transcript_file = TRANSCRIPTS_DIR / f"{session_id}.txt"

        if not transcript_file.exists():
            raise FileNotFoundError(
                f"No existe la transcripción para la sesión: {session_id}"
            )

        with open(transcript_file, "r", encoding="utf-8") as file:
            return file.read()

    def _load_session_metadata(self, session_id: str) -> Dict[str, Any]:
        session_file = SESSIONS_DIR / f"{session_id}.json"

        if not session_file.exists():
            raise FileNotFoundError(
                f"No existe el archivo de sesión: {session_id}"
            )

        with open(session_file, "r", encoding="utf-8") as file:
            return json.load(file)

    def _build_condition_context(self, session_data: Dict[str, Any]) -> str:
        condition = session_data.get("condition", "unknown")

        if condition == "embodied":
            description = (
                "Condición A / embodied: el usuario interactuó con un agente virtual académico "
                "con avatar visual básico, animación facial/corporal simple y voz del navegador."
            )
        elif condition == "text":
            description = (
                "Condición B / text: el usuario interactuó con una interfaz conversacional textual plana, "
                "sin avatar visual, sin voz y sin representación corporizada."
            )
        else:
            description = (
                "Condición no especificada: no se cuenta con información suficiente sobre la modalidad visual."
            )

        return f"""
Contexto experimental de la sesión:
- Session ID: {session_data.get("session_id", "")}
- Participante anónimo: {session_data.get("participant_id", "")}
- Condición registrada: {condition}
- Descripción de la condición: {description}
"""

    def _parse_json_response(self, raw_text: str) -> Dict[str, Any]:
        cleaned = raw_text.strip()

        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```json", "", cleaned, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r"^```", "", cleaned).strip()
            cleaned = re.sub(r"```$", "", cleaned).strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)

            if match:
                return json.loads(match.group(0))

            raise ValueError("La respuesta del modelo no contiene JSON válido.")

    def _normalize_answers(self, answers: Dict[str, Any]) -> Dict[str, int]:
        normalized = {}

        for i in range(1, 9):
            key = f"item_{i}"
            value = answers.get(key, 4)

            try:
                value = int(value)
            except (ValueError, TypeError):
                value = 4

            if value < 1:
                value = 1

            if value > 7:
                value = 7

            normalized[key] = value

        return normalized

    def _calculate_scores(self, answers: Dict[str, int]) -> Dict[str, float]:
        pragmatic_items = ["item_1", "item_2", "item_3", "item_4"]
        hedonic_items = ["item_5", "item_6", "item_7", "item_8"]

        pragmatic_score = self._average_items(answers, pragmatic_items)
        hedonic_score = self._average_items(answers, hedonic_items)
        global_score = self._average_items(answers, pragmatic_items + hedonic_items)

        return {
            "pragmatic_quality": pragmatic_score,
            "hedonic_quality": hedonic_score,
            "global_score": global_score,
            "ueqs_pragmatic_quality": pragmatic_score,
            "ueqs_hedonic_quality": hedonic_score,
            "ueqs_global_score": global_score
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

    def _fallback_ai_evaluation(
        self,
        session_id: str,
        session_data: Dict[str, Any],
        error_message: str
    ) -> Dict[str, Any]:
        answers = {
            "item_1": 5,
            "item_2": 5,
            "item_3": 5,
            "item_4": 5,
            "item_5": 4,
            "item_6": 5,
            "item_7": 4,
            "item_8": 4
        }

        return {
            "session_id": session_id,
            "participant_id": session_data.get("participant_id", ""),
            "condition": session_data.get("condition", ""),
            "source": "ai",
            "instrument": "UEQ-S",
            "model": self.model,
            "created_at": datetime.now().isoformat(),
            "answers": answers,
            "justification": (
                "Evaluación generada mediante mecanismo de respaldo porque no fue posible "
                "obtener una respuesta válida del modelo. Esta valoración debe interpretarse "
                "solo como referencia técnica preliminar."
            ),
            "scores": self._calculate_scores(answers),
            "raw_response": "",
            "error": error_message
        }