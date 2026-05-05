import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SESSIONS_DIR = DATA_DIR / "sessions"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"


SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)


class SessionLogger:
    def __init__(self):
        pass

    def create_session(self) -> Dict:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_id = f"session_{timestamp}"

        session_data = {
            "session_id": session_id,
            "created_at": datetime.now().isoformat(),
            "ended_at": None,
            "turns": []
        }

        self._save_session(session_id, session_data)

        return {
            "session_id": session_id,
            "message": "Sesión creada correctamente."
        }

    def add_turn(self, session_id: str, user_message: str, agent_response: str) -> Dict:
        session_data = self._load_session(session_id)

        turn = {
            "timestamp": datetime.now().isoformat(),
            "user_message": user_message,
            "agent_response": agent_response
        }

        session_data["turns"].append(turn)
        self._save_session(session_id, session_data)

        return {
            "session_id": session_id,
            "turn_saved": True
        }

    def end_session(self, session_id: str) -> Dict:
        session_data = self._load_session(session_id)
        session_data["ended_at"] = datetime.now().isoformat()

        self._save_session(session_id, session_data)

        transcript_path = self._generate_transcript(session_data)

        return {
            "session_id": session_id,
            "ended": True,
            "transcript_path": str(transcript_path)
        }

    def get_session(self, session_id: str) -> Dict:
        return self._load_session(session_id)

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
        lines.append(f"Inicio: {session_data.get('created_at')}")
        lines.append(f"Fin: {session_data.get('ended_at')}")
        lines.append("")
        lines.append("Interacción:")
        lines.append("")

        for index, turn in enumerate(session_data.get("turns", []), start=1):
            lines.append(f"Turno {index}")
            lines.append(f"Usuario: {turn.get('user_message')}")
            lines.append(f"Agente: {turn.get('agent_response')}")
            lines.append("")

        with open(transcript_file, "w", encoding="utf-8") as file:
            file.write("\n".join(lines))

        return transcript_file