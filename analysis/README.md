# Análisis externo de resultados UX

Esta carpeta contiene herramientas externas para procesar los datos generados por la Prueba de Concepto del agente virtual académico.

La aplicación principal no realiza análisis estadístico formal. Su función es recolectar datos de interacción, transcripciones, respuestas humanas a instrumentos UX y evaluaciones generadas por IA.

El análisis estadístico se realiza posteriormente en herramientas externas como R, Python, Jamovi, SPSS u otras.

## Datos de entrada

El script `export_to_csv.py` lee los archivos generados localmente por la PoC desde:

```txt
prototype/src/data/sessions/
prototype/src/data/human_evaluations/
prototype/src/data/ai_evaluations/
prototype/src/data/transcripts/