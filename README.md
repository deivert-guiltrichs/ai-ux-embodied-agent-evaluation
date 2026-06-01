# Evaluación UX aumentada con IA para agentes virtuales corporizados

Proyecto individual del curso **PF-3311 Agentes Virtuales Inteligentes**.

## 1. Descripción

Este repositorio contiene la Prueba de Concepto del proyecto:

**“Evaluación UX aumentada con IA para agentes virtuales corporizados: comparación exploratoria entre usuarios humanos y un modelo de lenguaje”.**

La PoC implementa un agente virtual académico orientado a explicar conceptos básicos de bases de datos y permite recolectar datos de experiencia de usuario para un estudio exploratorio.

El prototipo incluye:

* Interfaz web de interacción.
* Backend en Python con FastAPI.
* Integración con un modelo de lenguaje configurable.
* Condición A: agente con avatar visual básico.
* Condición B: interfaz conversacional textual sin avatar.
* Registro controlado de sesiones.
* Generación de ID anónimo de participante.
* Transcripción de interacción.
* Aplicación de instrumentos UX.
* Evaluación posterior con IA usando UEQ-S.
* Exportación externa de datos para análisis estadístico.

## 2. Objetivo de la PoC

Demostrar la integración funcional de los principales componentes de la arquitectura técnica propuesta:

```txt
Frontend web
↓
Backend FastAPI
↓
Modelo de lenguaje
↓
Registro de sesión
↓
Transcripción
↓
Instrumentos UX
↓
Evaluación posterior con IA
↓
Datos exportables para análisis externo
```

La PoC no pretende ser un producto final. Su propósito es evidenciar viabilidad técnica y metodológica para el Entregable 2 del curso.

## 3. Condiciones experimentales

La aplicación permite trabajar con dos condiciones:

### Condición A: agente con avatar

El participante interactúa con un agente académico representado visualmente mediante un avatar básico animado.

### Condición B: interfaz textual

El participante interactúa con una interfaz conversacional plana, sin avatar visual ni voz.

La condición puede seleccionarse manualmente para pruebas o asignarse de forma aleatoria.

## 4. Instrumentos de evaluación

### UEQ-S

Se utiliza como instrumento principal de experiencia de usuario.

Se aplica a:

* Participantes humanos.
* Modelo de lenguaje evaluador, a partir de la transcripción.

El análisis principal del estudio compara:

```txt
UEQ-S humano vs UEQ-S generado por IA
```

### Godspeed reducido

Se aplica únicamente a participantes humanos.

Dimensiones incluidas:

* Antropomorfismo.
* Simpatía.
* Inteligencia percibida.
* Seguridad percibida.

Este instrumento se usa para comparar la percepción humana entre:

```txt
Condición A: agente con avatar
vs
Condición B: interfaz textual
```

### Pregunta abierta

Al finalizar, el participante responde una pregunta abierta sobre aspectos positivos o mejoras del agente.

## 5. Arquitectura del proyecto

```txt
ai-ux-embodied-agent-evaluation/
│
├── README.md
├── .gitignore
├── .env.example
│
├── docs/
│   └── documentos del entregable
│
├── prompts/
│   ├── system_prompt_agent.md
│   └── llm_evaluator_prompt.md
│
├── prototype/
│   ├── requirements.txt
│   └── src/
│       ├── main.py
│       ├── config.py
│       ├── gemini_client.py
│       ├── session_logger.py
│       ├── ux_human_evaluation.py
│       ├── ux_ai_evaluator.py
│       │
│       ├── templates/
│       │   └── index.html
│       │
│       ├── static/
│       │   ├── css/
│       │   │   └── styles.css
│       │   └── js/
│       │       └── app.js
│       │
│       └── data/
│           ├── sessions/
│           ├── transcripts/
│           ├── human_evaluations/
│           └── ai_evaluations/
│
├── evaluation/
│   ├── instruments/
│   ├── protocol/
│   └── data/
│
└── analysis/
    ├── README.md
    ├── export_to_csv.py
    ├── exports/
    └── scripts/
        └── ux_analysis_template.R
```

## 6. Requisitos

* Python 3.10 o superior.
* Navegador web moderno.
* API key de Gemini o proveedor compatible.
* Entorno virtual de Python.

## 7. Configuración del entorno

Abrir una terminal en la raíz del proyecto y entrar a la carpeta `prototype`:

```powershell
cd prototype
```

Crear entorno virtual:

```powershell
python -m venv venv
```

Activar entorno virtual en Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Si PowerShell bloquea la activación, se puede usar directamente el Python del entorno virtual:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Instalar dependencias:

```powershell
pip install -r requirements.txt
```

O bien:

```powershell
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 8. Variables de entorno

El repositorio incluye un archivo de ejemplo:

```txt
.env.example
```

Debe crearse un archivo local llamado `.env` en la raíz del proyecto:

```txt
ai-ux-embodied-agent-evaluation/.env
```

Ejemplo:

```env
GEMINI_API_KEY=your_real_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite
APP_ENV=local

AGENT_LLM_PROVIDER=gemini
AGENT_LLM_MODEL=gemini-2.5-flash-lite

EVALUATOR_LLM_PROVIDER=gemini
EVALUATOR_LLM_MODEL=gemini-2.5-flash-lite
```

El archivo `.env` no debe subirse al repositorio.

## 9. Ejecución local

Desde la carpeta `prototype`:

```powershell
.\venv\Scripts\python.exe -m uvicorn src.main:app --reload
```

Abrir la aplicación en:

```txt
http://127.0.0.1:8000
```

La documentación automática del backend está disponible en:

```txt
http://127.0.0.1:8000/docs
```

## 10. Flujo de prueba

1. Abrir la aplicación.
2. Leer el consentimiento básico.
3. Aceptar participación.
4. Seleccionar condición:

   * Asignación aleatoria.
   * Condición A: agente con avatar.
   * Condición B: interfaz textual.
5. Interactuar con el agente usando la tarea guiada.
6. Finalizar la sesión.
7. Completar:

   * UEQ-S.
   * Godspeed reducido.
   * Pregunta abierta.
8. Guardar evaluación UX humana.
9. Generar evaluación UX con IA.
10. Revisar los archivos generados localmente.

## 11. Tarea guiada del participante

Durante la interacción, el participante debe:

1. Pedir una explicación sobre diseño de bases de datos.
2. Solicitar un ejemplo cotidiano.
3. Preguntar la diferencia entre clave primaria y clave foránea.
4. Solicitar una aclaración si lo necesita.

## 12. Datos generados

Los datos se guardan localmente en:

```txt
prototype/src/data/
```

Subcarpetas principales:

```txt
sessions/
transcripts/
human_evaluations/
ai_evaluations/
```

Estos archivos pueden contener transcripciones, respuestas de instrumentos UX y comentarios abiertos. Por seguridad y privacidad, no deben subirse al repositorio.

## 13. Exportación para análisis externo

El análisis estadístico no se realiza dentro de la aplicación web.

Para generar CSV a partir de los datos locales:

```powershell
python analysis/export_to_csv.py
```

Archivos esperados:

```txt
analysis/exports/ueqs_human_ai_long.csv
analysis/exports/condition_human_results.csv
analysis/exports/session_metadata.csv
```

## 14. Análisis en R

Se incluye una plantilla inicial:

```txt
analysis/scripts/ux_analysis_template.R
```

El análisis principal compara:

```txt
UEQ-S humano vs UEQ-S generado por IA
```

El análisis secundario compara:

```txt
Condición A: avatar
vs
Condición B: textual
```

usando respuestas humanas de UEQ-S y Godspeed reducido.

## 15. Seguridad y privacidad

El prototipo sigue estas restricciones:

* No solicita nombre.
* No solicita cédula.
* No solicita correo.
* No solicita teléfono.
* No solicita datos personales sensibles.
* Utiliza ID anónimo de participante.
* Usa `.env` para claves y credenciales.
* Excluye `.env` mediante `.gitignore`.
* Excluye datos generados localmente.
* Excluye entornos virtuales y archivos temporales.

Archivos y carpetas que no deben subirse:

```txt
.env
prototype/venv/
prototype/src/data/
analysis/exports/*.csv
__pycache__/
```

## 16. Estado actual

### Implementado

* Backend FastAPI.
* Frontend web.
* Consentimiento básico.
* ID anónimo de participante.
* Condición A con avatar visual básico.
* Condición B textual sin avatar.
* Selección manual o aleatoria de condición.
* Interacción guiada sobre bases de datos.
* Integración con modelo de lenguaje.
* Registro de sesión.
* Transcripción.
* UEQ-S humano.
* Godspeed reducido humano.
* Pregunta abierta.
* Evaluación IA con UEQ-S.
* Guardado JSON.
* Exportación externa a CSV.
* Plantilla inicial de análisis en R.

### Pendiente o mejora futura

* Mejorar avatar visual mediante VRM o tecnología 3D web.
* Despliegue web con backend seguro.
* Aplicar prueba piloto.
* Completar análisis estadístico externo con datos reales.

## 17. Video de demostración

Enlace al video de demostración:

https://youtu.be/jhzsNL0CJfw

## 18. Nota sobre VRM

La versión actual utiliza un avatar visual básico implementado en HTML, CSS y JavaScript.

Como mejora futura, se contempla integrar un avatar VRM en la interfaz web para fortalecer la representación corporizada mediante:

* Cuerpo completo.
* Parpadeo.
* Expresiones faciales.
* Movimiento corporal básico.
* Animación de habla.
* Mayor realismo visual.

Esta mejora no es indispensable para la PoC del Entregable 2, pero puede fortalecer la experiencia del agente en iteraciones posteriores.
