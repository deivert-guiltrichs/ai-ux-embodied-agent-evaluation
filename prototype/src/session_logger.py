import json
import random
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SESSIONS_DIR = DATA_DIR / "sessions"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"

SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


VALID_CONDITIONS = {"embodied", "text"}


class SessionLogger:
    def create_session(
        self,
        condition: Optional[str] = None,
        consent_accepted: bool = False
    ) -> Dict:
        if not consent_accepted:
            raise ValueError("No se puede iniciar la sesión sin aceptar el consentimiento básico.")

        assigned_condition = self._resolve_condition(condition)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        short_token = secrets.token_hex(3).upper()

        session_id = f"session_{timestamp}_{short_token}"
        participant_id = f"P-{secrets.token_hex(3).upper()}"

        created_at = datetime.now().isoformat()

        session_data = {
            "session_id": session_id,
            "participant_id": participant_id,
            "condition": assigned_condition,
            "consent_accepted": consent_accepted,
            "created_at": created_at,
            "ended_at": None,
            "turns": [],
            "operational_metrics": {
                "total_turns": 0,
                "duration_seconds": None,
                "human_evaluation_completed": False,
                "ai_evaluation_completed": False,
                "transcript_generated": False
            }
        }

        self._save_session(session_id, session_data)

        return {
            "session_id": session_id,
            "participant_id": participant_id,
            "condition": assigned_condition,
            "message": "Sesión creada correctamente."
        }

    def add_turn(
        self,
        session_id: str,
        user_message: str,
        agent_response: str,
        response_source: str = "llm_or_fallback"
    ) -> Dict:
        session_data = self._load_session(session_id)

        turn = {
            "turn_number": len(session_data.get("turns", [])) + 1,
            "timestamp": datetime.now().isoformat(),
            "user_message": user_message,
            "agent_response": agent_response,
            "response_source": response_source
        }

        session_data["turns"].append(turn)
        session_data["operational_metrics"]["total_turns"] = len(session_data["turns"])

        self._save_session(session_id, session_data)

        return {
            "session_id": session_id,
            "turn_saved": True
        }

    def end_session(self, session_id: str) -> Dict:
        session_data = self._load_session(session_id)

        ended_at = datetime.now()
        session_data["ended_at"] = ended_at.isoformat()

        created_at_raw = session_data.get("created_at")
        duration_seconds = None

        if created_at_raw:
            try:
                created_at = datetime.fromisoformat(created_at_raw)
                duration_seconds = round((ended_at - created_at).total_seconds(), 2)
            except ValueError:
                duration_seconds = None

        session_data["operational_metrics"]["duration_seconds"] = duration_seconds

        transcript_path = self._generate_transcript(session_data)
        session_data["operational_metrics"]["transcript_generated"] = True

        self._save_session(session_id, session_data)

        return {
            "session_id": session_id,
            "participant_id": session_data.get("participant_id"),
            "condition": session_data.get("condition"),
            "ended": True,
            "duration_seconds": duration_seconds,
            "transcript_path": str(transcript_path)
        }

    def get_session(self, session_id: str) -> Dict:
        return self._load_session(session_id)

    def mark_human_evaluation_completed(self, session_id: str) -> Dict:
        session_data = self._load_session(session_id)
        session_data["operational_metrics"]["human_evaluation_completed"] = True
        self._save_session(session_id, session_data)

        return {
            "session_id": session_id,
            "human_evaluation_completed": True
        }

    def mark_ai_evaluation_completed(self, session_id: str) -> Dict:
        session_data = self._load_session(session_id)
        session_data["operational_metrics"]["ai_evaluation_completed"] = True
        self._save_session(session_id, session_data)

        return {
            "session_id": session_id,
            "ai_evaluation_completed": True
        }

    def _resolve_condition(self, condition: Optional[str]) -> str:
        if condition is None or condition == "" or condition == "random":
            return random.choice(["embodied", "text"])

        normalized_condition = condition.strip().lower()

        if normalized_condition not in VALID_CONDITIONS:
            raise ValueError(
                "Condición inválida. Use 'embodied', 'text' o 'random'."
            )

        return normalized_condition

    def _get_session_file(self, session_id: str) -> Path:
        return SESSIONS_DIR / f"{session_id}.json"

    def _save_session(self, session_id: str, session_data: Dict):
        session_file = self._get_session_file(session_id)

        with open(session_file, "w", encoding="utf-8") as file:
            json.dump(session_data, file, ensure_ascii=False, indent=4)

    def _load_session(self, session_id: str) -> Dict:
        session_file = self._get_session_file(session_id)

        if not session_file.exists():
            raise FileNotFoundError(f"No existe la sesión: {session_id}")

        with open(session_file, "r", encoding="utf-8") as file:
            return json.load(file)

    def _generate_transcript(self, session_data: Dict) -> Path:
        session_id = session_data["session_id"]
        transcript_file = TRANSCRIPTS_DIR / f"{session_id}.txt"

        lines: List[str] = []
        lines.append(f"Transcripción de sesión: {session_id}")
        lines.append(f"Participante anónimo: {session_data.get('participant_id')}")
        lines.append(f"Condición experimental: {session_data.get('condition')}")
        lines.append(f"Inicio: {session_data.get('created_at')}")
        lines.append(f"Fin: {session_data.get('ended_at')}")
        lines.append("")
        lines.append("Interacción:")
        lines.append("")

        for turn in session_data.get("turns", []):
            lines.append(f"Turno {turn.get('turn_number')}")
            lines.append(f"Usuario: {turn.get('user_message')}")
            lines.append(f"Agente: {turn.get('agent_response')}")
            lines.append(f"Fuente de respuesta: {turn.get('response_source')}")
            lines.append("")

        with open(transcript_file, "w", encoding="utf-8") as file:
            file.write("\n".join(lines))

        return transcript_file