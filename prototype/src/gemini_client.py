from typing import Dict

from google import genai
from src.config import settings


class GeminiClient:
    def __init__(self):
        settings.validate()

        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.agent_llm_model
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        with open(settings.system_prompt_path, "r", encoding="utf-8") as file:
            return file.read()

    def generate_agent_response(self, user_message: str) -> str:
        """
        Compatibility method used by previous versions.
        Returns only the response text.
        """
        result = self.generate_agent_response_with_source(user_message)
        return result["response"]

    def generate_agent_response_with_source(self, user_message: str) -> Dict[str, str]:
        """
        Generates an agent response and indicates whether it came from the LLM
        or from the local fallback mechanism.
        """
        if not user_message or not user_message.strip():
            return {
                "response": "Por favor, escribe una pregunta sobre conceptos básicos de bases de datos.",
                "source": "validation"
            }

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
                return {
                    "response": self._fallback_response(user_message),
                    "source": "fallback_local"
                }

            return {
                "response": response.text.strip(),
                "source": "gemini"
            }

        except Exception as error:
            error_text = str(error)
            print("ERROR GEMINI:", error_text)

            if "API_KEY" in error_text or "api key" in error_text.lower():
                return {
                    "response": (
                        "No se pudo validar la clave de acceso del modelo de lenguaje. "
                        "Revisa la configuración del archivo .env."
                    ),
                    "source": "configuration_error"
                }

            return {
                "response": self._fallback_response(user_message),
                "source": "fallback_local"
            }

    def _fallback_response(self, user_message: str) -> str:
        message = user_message.lower()

        if "diseño" in message and "base" in message:
            return (
                "El diseño de bases de datos consiste en organizar la información antes de construir la base de datos. "
                "Normalmente se identifican entidades, atributos y relaciones. Por ejemplo, en un sistema universitario "
                "podrían existir entidades como Estudiante, Curso y Matrícula."
            )

        if "base de datos" in message:
            return (
                "Una base de datos es un conjunto organizado de información que se almacena "
                "para poder consultarla, modificarla y administrarla de forma eficiente. "
                "Por ejemplo, una universidad puede tener una base de datos con estudiantes, cursos, profesores y notas."
            )

        if "tabla" in message:
            return (
                "Una tabla es una estructura dentro de una base de datos que organiza la información "
                "en filas y columnas. Cada fila representa un registro y cada columna representa un dato específico. "
                "Por ejemplo, una tabla llamada Estudiantes podría tener columnas como id, nombre, correo y carrera."
            )

        if "registro" in message or "fila" in message:
            return (
                "Un registro es una fila dentro de una tabla. Representa un elemento completo de información. "
                "Por ejemplo, en una tabla de estudiantes, un registro podría contener el id, nombre, correo y carrera de un estudiante específico."
            )

        if "campo" in message or "columna" in message:
            return (
                "Un campo es una columna de una tabla y representa un tipo de dato. "
                "Por ejemplo, en una tabla Estudiantes, los campos podrían ser id_estudiante, nombre, correo y carrera."
            )

        if (
            "llave primaria" in message
            or "clave primaria" in message
            or "llave foránea" in message
            or "clave foránea" in message
            or ("primaria" in message and "foránea" in message)
        ):
            return (
                "Una clave primaria identifica de forma única cada registro de una tabla. "
                "Por ejemplo, id_estudiante puede identificar a cada estudiante. "
                "Una clave foránea, en cambio, sirve para relacionar una tabla con otra. "
                "Por ejemplo, una tabla Matrículas puede tener id_estudiante como clave foránea para indicar "
                "a qué estudiante pertenece cada matrícula."
            )

        if "relación" in message or "relaciones" in message:
            return (
                "Una relación entre tablas permite conectar información distribuida en diferentes tablas. "
                "Por ejemplo, una tabla Estudiantes puede relacionarse con una tabla Cursos mediante una tabla Matrículas."
            )

        if "sql" in message or "consulta" in message:
            return (
                "SQL es un lenguaje utilizado para consultar y administrar bases de datos relacionales. "
                "Por ejemplo, una instrucción SELECT permite recuperar información almacenada en una tabla."
            )

        if "normalización" in message:
            return (
                "La normalización es un proceso para organizar los datos de una base de datos y reducir duplicaciones innecesarias. "
                "Su objetivo es mejorar la consistencia, claridad y mantenimiento de la información."
            )

        if "modelo entidad" in message or "entidad relación" in message or "entidad-relación" in message:
            return (
                "El modelo entidad-relación es una forma de representar los datos antes de construir la base de datos. "
                "Permite identificar entidades, atributos y relaciones. Por ejemplo, Estudiante y Curso pueden ser entidades."
            )

        if "ejemplo" in message or "cotidiano" in message:
            return (
                "Un ejemplo cotidiano de base de datos es el sistema de una biblioteca. "
                "Puede tener una tabla de libros, una tabla de usuarios y una tabla de préstamos. "
                "Así se puede saber qué libro fue prestado, a quién y en qué fecha."
            )

        return (
            "Puedo ayudarte con conceptos básicos de bases de datos, como diseño de bases de datos, tablas, registros, campos, "
            "claves primarias, claves foráneas, relaciones, normalización básica, modelo entidad-relación "
            "y consultas SQL introductorias. ¿Sobre cuál de estos temas te gustaría preguntar?"
        )