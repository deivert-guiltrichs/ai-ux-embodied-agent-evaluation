# Evaluación UX aumentada con IA para agentes virtuales corporizados

Proyecto individual del curso **PF-3311 Agentes Virtuales Inteligentes** — Entrega final (Entregable 3).

> **Comparación exploratoria entre usuarios humanos y un modelo de lenguaje** en la evaluación de la experiencia de usuario (UX) de un agente virtual corporizado de apoyo académico.

## Enlaces rápidos

* **Artículo académico (paper):** [`docs/entregable_3_paper.pdf`](docs/entregable_3_paper.pdf)
* **Video de demostración final (~5 min):** https://youtu.be/vwm-qM9VozM

## 1. Descripción

Este repositorio contiene el sistema completo y la documentación del proyecto:

**“Evaluación UX aumentada con IA para agentes virtuales corporizados: comparación exploratoria entre usuarios humanos y un modelo de lenguaje”.**

El sistema implementa un agente virtual académico orientado a explicar conceptos introductorios de bases de datos y permite recolectar datos de experiencia de usuario para un estudio exploratorio. Sobre esta base se ejecutó una **evaluación piloto con 10 sesiones** (cinco por condición), comparando la evaluación UX reportada por usuarios humanos con la generada por un segundo modelo de lenguaje (LLM-B) a partir de las transcripciones.

El sistema incluye:

* Interfaz web de interacción.
* Backend en Python con FastAPI.
* Integración con un modelo de lenguaje configurable.
* Condición A: agente con avatar visual básico.
* Condición B: interfaz conversacional textual sin avatar.
* Registro controlado de sesiones.
* Generación de ID anónimo de participante.
* Transcripción de interacción.
* Aplicación de instrumentos UX (UEQ-S y Godspeed reducido).
* Evaluación posterior con IA usando UEQ-S.
* Exportación externa de datos para análisis estadístico.

## Información académica

**Universidad:** Universidad de Costa Rica  
**Programa:** Programa de Posgrado en Computación e Informática  
**Escuela:** Escuela de Ciencias de la Computación e Informática  
**Curso:** PF-3311 Agentes Virtuales Inteligentes  
**Proyecto:** Evaluación UX aumentada con IA para agentes virtuales corporizados  
**Estudiante / investigador:** Deivert Guiltrichs Cordero  
**Profesor:** Alexander Barquero Elizondo  
**Ciclo:** I Ciclo, 2026  

## 2. Objetivo del sistema

Demostrar la integración funcional de los principales componentes de la arquitectura técnica propuesta y soportar el flujo completo del estudio de evaluación:

```txt
Frontend web
↓
Backend FastAPI
↓
Modelo de lenguaje (agente, LLM-A)
↓
Registro de sesión
↓
Transcripción
↓
Instrumentos UX (humano)
↓
Evaluación posterior con IA (LLM-B)
↓
Datos exportables para análisis externo
```

El sistema soporta tanto la interacción del participante con el agente como la doble evaluación (humana y por IA) que sustenta la comparación exploratoria del estudio.

## 3. Condiciones experimentales

La aplicación trabaja con dos condiciones bajo un diseño **entre-sujetos** (cada participante interactúa con una única condición):

### Condición A: agente con avatar

El participante interactúa con un agente académico representado visualmente mediante un avatar básico.

### Condición B: interfaz textual

El participante interactúa con una interfaz conversacional plana, sin avatar visual ni voz.

Ambas condiciones comparten el mismo modelo conversacional, dominio, guion de tarea y restricciones de respuesta; lo único que varía es el *embodiment* visual. La condición puede seleccionarse manualmente para pruebas o asignarse de forma aleatoria y balanceada.

## 4. Instrumentos de evaluación

### UEQ-S

Instrumento principal de experiencia de usuario. Se aplica a:

* Participantes humanos.
* Modelo de lenguaje evaluador (LLM-B), a partir de la transcripción.

El análisis principal del estudio compara:

```txt
UEQ-S humano vs UEQ-S generado por IA
```

### Godspeed reducido

Se aplica únicamente a participantes humanos. Dimensiones incluidas:

* Antropomorfismo.
* Simpatía.
* Inteligencia percibida.
* Seguridad percibida.

Se usa para comparar la percepción humana entre:

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
│   ├── entregable_3_paper.pdf        # Artículo académico final
│   └── documentos de entregas previas
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

> **Nota sobre el modelo evaluador (LLM-B).** El modelo evaluador previsto fue Gemini. Durante parte de la recolección de datos el servicio quedó temporalmente no disponible por límites de cuota; conforme a la rutina de contingencia del estudio, esas evaluaciones se completaron con un modelo de respaldo (GPT) a partir de las mismas transcripciones, dejando constancia del modelo utilizado en cada sesión. El proveedor y el modelo evaluador son configurables mediante las variables `EVALUATOR_LLM_PROVIDER` y `EVALUATOR_LLM_MODEL`.

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

## 14. Análisis estadístico

La plantilla de análisis se encuentra en:

```txt
analysis/scripts/ux_analysis_template.R
```

El análisis principal compara la concordancia entre la evaluación humana y la del LLM-B:

```txt
UEQ-S humano vs UEQ-S generado por IA
```

mediante el coeficiente de correlación intraclase (ICC, acuerdo absoluto, ICC(A,1)), estadística descriptiva por dimensión, correlación de Pearson y prueba de Wilcoxon.

El análisis secundario compara las condiciones:

```txt
Condición A: avatar
vs
Condición B: textual
```

usando respuestas humanas de UEQ-S y Godspeed reducido.

> **Resultados (N = 10).** El evaluador automático tendió a puntuar por debajo del usuario humano, con la mayor brecha en la calidad hedónica. La concordancia fue dimensión-dependiente: moderada en calidad pragmática (ICC ≈ 0.69), baja en calidad hedónica (ICC ≈ 0.22) y ICC global ≈ 0.40 (por debajo del umbral exploratorio de 0.70). El avatar visual básico no mejoró la experiencia ni la percepción social frente a la interfaz textual. Detalles completos en el [artículo](docs/entregable_3_paper.pdf).

## 15. Seguridad y privacidad

El sistema sigue estas restricciones:

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
* Plantilla de análisis en R.
* Estudio piloto ejecutado (10 sesiones) y análisis de concordancia humano–IA.

### Trabajo futuro

* Mejorar avatar visual mediante VRM o tecnología 3D web.
* Incorporar voz natural y ajustable, y mayor dinamismo del agente.
* Ampliar y balancear la muestra; fijar un único modelo evaluador.
* Despliegue web con backend seguro.
* Evaluación multimodal (más allá de la transcripción textual).

## 17. Video de demostración

Enlace al video de demostración final (~5 min, no listado en YouTube):

```txt
https://youtu.be/vwm-qM9VozM
```

El video muestra el agente en su versión final e incluye al menos dos escenarios completos de interacción (Condición A y Condición B) y evidencia de las capacidades técnicas del sistema: consentimiento, asignación de condición, interacción con el agente, aplicación de instrumentos UX y generación de la evaluación por IA.

## 18. Artículo académico

El artículo final, en formato IEEE, se encuentra en:

```txt
docs/entregable_3_paper.pdf
```

Documenta el problema, los trabajos relacionados, el desarrollo del agente, la metodología, los resultados del estudio (N = 10), el análisis y discusión, y las conclusiones, incluyendo la proyección de publicación.
