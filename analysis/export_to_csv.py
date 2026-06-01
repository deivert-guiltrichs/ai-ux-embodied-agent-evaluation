import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


ROOT_DIR = Path(__file__).resolve().parents[1]

DATA_DIR = ROOT_DIR / "prototype" / "src" / "data"
SESSIONS_DIR = DATA_DIR / "sessions"
HUMAN_EVALUATIONS_DIR = DATA_DIR / "human_evaluations"
AI_EVALUATIONS_DIR = DATA_DIR / "ai_evaluations"
TRANSCRIPTS_DIR = DATA_DIR / "transcripts"

EXPORTS_DIR = ROOT_DIR / "analysis" / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


UEQS_ITEMS = [f"item_{i}" for i in range(1, 9)]

GODSPEED_ITEMS = [
    "godspeed_anthro_1",
    "godspeed_anthro_2",
    "godspeed_like_1",
    "godspeed_like_2",
    "godspeed_intel_1",
    "godspeed_intel_2",
    "godspeed_safety_1",
    "godspeed_safety_2",
]


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def list_session_files() -> List[Path]:
    if not SESSIONS_DIR.exists():
        return []

    return sorted(SESSIONS_DIR.glob("*.json"))


def get_human_evaluation_file(session_id: str) -> Optional[Path]:
    candidates = [
        HUMAN_EVALUATIONS_DIR / f"{session_id}_human_ux.json",
        HUMAN_EVALUATIONS_DIR / f"{session_id}_human_ueqs.json",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def get_ai_evaluation_file(session_id: str) -> Optional[Path]:
    candidate = AI_EVALUATIONS_DIR / f"{session_id}_ai_ueqs.json"

    if candidate.exists():
        return candidate

    return None


def get_session_base_metadata(session_data: Dict[str, Any]) -> Dict[str, Any]:
    metrics = session_data.get("operational_metrics", {})

    return {
        "session_id": session_data.get("session_id", ""),
        "participant_id": session_data.get("participant_id", ""),
        "condition": session_data.get("condition", ""),
        "consent_accepted": session_data.get("consent_accepted", ""),
        "created_at": session_data.get("created_at", ""),
        "ended_at": session_data.get("ended_at", ""),
        "total_turns": metrics.get("total_turns", ""),
        "duration_seconds": metrics.get("duration_seconds", ""),
        "transcript_generated": metrics.get("transcript_generated", ""),
        "human_evaluation_completed": metrics.get("human_evaluation_completed", ""),
        "ai_evaluation_completed": metrics.get("ai_evaluation_completed", ""),
    }


def extract_ueqs_answers(evaluation_data: Dict[str, Any]) -> Dict[str, Any]:
    if "ueqs_answers" in evaluation_data:
        return evaluation_data.get("ueqs_answers", {})

    return evaluation_data.get("answers", {})


def extract_godspeed_answers(evaluation_data: Dict[str, Any]) -> Dict[str, Any]:
    return evaluation_data.get("godspeed_answers", {})


def extract_ueqs_scores(evaluation_data: Dict[str, Any]) -> Dict[str, Any]:
    scores = evaluation_data.get("scores", {})

    return {
        "ueqs_pragmatic_quality": scores.get(
            "ueqs_pragmatic_quality",
            scores.get("pragmatic_quality", "")
        ),
        "ueqs_hedonic_quality": scores.get(
            "ueqs_hedonic_quality",
            scores.get("hedonic_quality", "")
        ),
        "ueqs_global_score": scores.get(
            "ueqs_global_score",
            scores.get("global_score", "")
        ),
    }


def extract_godspeed_scores(evaluation_data: Dict[str, Any]) -> Dict[str, Any]:
    scores = evaluation_data.get("scores", {})

    return {
        "godspeed_anthropomorphism": scores.get("godspeed_anthropomorphism", ""),
        "godspeed_likeability": scores.get("godspeed_likeability", ""),
        "godspeed_perceived_intelligence": scores.get("godspeed_perceived_intelligence", ""),
        "godspeed_perceived_safety": scores.get("godspeed_perceived_safety", ""),
    }


def build_ueqs_long_rows() -> List[Dict[str, Any]]:
    rows = []

    for session_file in list_session_files():
        session_data = load_json(session_file)

        if not session_data:
            continue

        session_id = session_data.get("session_id", "")
        base = get_session_base_metadata(session_data)

        human_file = get_human_evaluation_file(session_id)
        ai_file = get_ai_evaluation_file(session_id)

        human_data = load_json(human_file) if human_file else None
        ai_data = load_json(ai_file) if ai_file else None

        if human_data:
            rows.append(
                build_ueqs_row(
                    base_metadata=base,
                    evaluator_type="human",
                    evaluation_data=human_data
                )
            )

        if ai_data:
            rows.append(
                build_ueqs_row(
                    base_metadata=base,
                    evaluator_type="ai",
                    evaluation_data=ai_data
                )
            )

    return rows


def build_ueqs_row(
    base_metadata: Dict[str, Any],
    evaluator_type: str,
    evaluation_data: Dict[str, Any]
) -> Dict[str, Any]:
    answers = extract_ueqs_answers(evaluation_data)
    scores = extract_ueqs_scores(evaluation_data)

    row = {
        **base_metadata,
        "evaluator_type": evaluator_type,
        "evaluation_created_at": evaluation_data.get("created_at", ""),
        "model": evaluation_data.get("model", ""),
    }

    for item in UEQS_ITEMS:
        row[item] = answers.get(item, "")

    row.update(scores)

    return row


def build_condition_human_rows() -> List[Dict[str, Any]]:
    rows = []

    for session_file in list_session_files():
        session_data = load_json(session_file)

        if not session_data:
            continue

        session_id = session_data.get("session_id", "")
        base = get_session_base_metadata(session_data)

        human_file = get_human_evaluation_file(session_id)
        human_data = load_json(human_file) if human_file else None

        if not human_data:
            continue

        ueqs_answers = extract_ueqs_answers(human_data)
        godspeed_answers = extract_godspeed_answers(human_data)
        ueqs_scores = extract_ueqs_scores(human_data)
        godspeed_scores = extract_godspeed_scores(human_data)

        row = {
            **base,
            "evaluation_created_at": human_data.get("created_at", ""),
            "open_comment": human_data.get("open_comment", ""),
        }

        for item in UEQS_ITEMS:
            row[item] = ueqs_answers.get(item, "")

        for item in GODSPEED_ITEMS:
            row[item] = godspeed_answers.get(item, "")

        row.update(ueqs_scores)
        row.update(godspeed_scores)

        rows.append(row)

    return rows


def build_session_metadata_rows() -> List[Dict[str, Any]]:
    rows = []

    for session_file in list_session_files():
        session_data = load_json(session_file)

        if not session_data:
            continue

        session_id = session_data.get("session_id", "")
        base = get_session_base_metadata(session_data)

        transcript_file = TRANSCRIPTS_DIR / f"{session_id}.txt"
        human_file = get_human_evaluation_file(session_id)
        ai_file = get_ai_evaluation_file(session_id)

        row = {
            **base,
            "session_file_available": session_file.exists(),
            "transcript_available": transcript_file.exists(),
            "human_evaluation_available": human_file.exists() if human_file else False,
            "ai_evaluation_available": ai_file.exists() if ai_file else False,
        }

        rows.append(row)

    return rows


def write_csv(path: Path, rows: List[Dict[str, Any]]):
    if not rows:
        print(f"No hay datos para generar: {path.name}")
        return

    fieldnames = list(rows[0].keys())

    with open(path, "w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Archivo generado: {path}")


def main():
    print("Iniciando exportación de datos UX...")

    if not DATA_DIR.exists():
        print(f"No existe la carpeta de datos: {DATA_DIR}")
        return

    ueqs_rows = build_ueqs_long_rows()
    condition_rows = build_condition_human_rows()
    metadata_rows = build_session_metadata_rows()

    write_csv(EXPORTS_DIR / "ueqs_human_ai_long.csv", ueqs_rows)
    write_csv(EXPORTS_DIR / "condition_human_results.csv", condition_rows)
    write_csv(EXPORTS_DIR / "session_metadata.csv", metadata_rows)

    print("Exportación finalizada.")


if __name__ == "__main__":
    main()