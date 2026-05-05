from google import genai
from src.config import settings


class GeminiClient:
    def __init__(self):
        settings.validate()

        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_model
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        with open(settings.system_prompt_path, "r", encoding="utf-8") as file:
            return file.read()

    def generate_agent_response(self, user_message: str) -> str:
        if not user_message or not user_message.strip():
            return "Por favor, escribe una pregunta sobre conceptos básicos de bases de datos."

        prompt = f"""
{self.system_prompt}

Pregunta del estudiante:
{user_message}

Respuesta del agente:
"""

        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt
            )

            if not response.text:
                return "No pude generar una respuesta en este momento. Intenta reformular la pregunta."

            return response.text.strip()

        except Exception as error:
            error_text = str(error)

            if "503" in error_text or "UNAVAILABLE" in error_text or "high demand" in error_text:
                return (
                    "En este momento el modelo de lenguaje está experimentando alta demanda. "
                    "Por favor, intenta nuevamente en unos segundos."
                )

            if "API_KEY" in error_text or "api key" in error_text.lower():
                return (
                    "No se pudo validar la clave de acceso del modelo de lenguaje. "
                    "Revisa la configuración del archivo .env."
                )

            if "quota" in error_text.lower() or "429" in error_text:
                return (
                    "Se alcanzó temporalmente el límite de uso del modelo de lenguaje. "
                    "Por favor, intenta más tarde."
                )

            return (
                "Ocurrió un problema temporal al consultar el modelo de lenguaje. "
                "Por favor, intenta nuevamente."
            )