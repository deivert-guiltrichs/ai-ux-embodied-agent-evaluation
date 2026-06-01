import os
from pathlib import Path
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[2]

ENV_PATH = ROOT_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class Settings:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")

        # Compatibility with previous versions
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

        self.app_env = os.getenv("APP_ENV", "local")

        # LLM-A: conversational agent
        self.agent_llm_provider = os.getenv("AGENT_LLM_PROVIDER", "gemini")
        self.agent_llm_model = os.getenv("AGENT_LLM_MODEL", self.gemini_model)

        # LLM-B: UX evaluator
        self.evaluator_llm_provider = os.getenv("EVALUATOR_LLM_PROVIDER", "gemini")
        self.evaluator_llm_model = os.getenv("EVALUATOR_LLM_MODEL", self.gemini_model)

        self.prompts_dir = ROOT_DIR / "prompts"
        self.system_prompt_path = self.prompts_dir / "system_prompt_agent.md"
        self.llm_evaluator_prompt_path = self.prompts_dir / "llm_evaluator_prompt.md"

    def validate(self):
        if not self.gemini_api_key:
            raise ValueError(
                "No se encontró GEMINI_API_KEY. "
                "Crea un archivo .env en la raíz del proyecto."
            )

        if not self.system_prompt_path.exists():
            raise FileNotFoundError(
                f"No se encontró el prompt del agente en: {self.system_prompt_path}"
            )

        if not self.llm_evaluator_prompt_path.exists():
            raise FileNotFoundError(
                f"No se encontró el prompt evaluador en: {self.llm_evaluator_prompt_path}"
            )


settings = Settings()