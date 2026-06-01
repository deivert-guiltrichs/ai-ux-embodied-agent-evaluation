# ============================================================
# PF-3311 Agentes Virtuales Inteligentes
# Análisis exploratorio UX
# Proyecto: Evaluación UX aumentada con IA para agentes virtuales corporizados
# ============================================================

# Este script es una plantilla inicial.
# El análisis estadístico formal debe ajustarse según el tamaño de muestra,
# distribución de datos y decisiones metodológicas finales.

# ------------------------------------------------------------
# 1. Cargar datos
# ------------------------------------------------------------

ueqs <- read.csv("analysis/exports/ueqs_human_ai_long.csv", stringsAsFactors = FALSE)
condition_data <- read.csv("analysis/exports/condition_human_results.csv", stringsAsFactors = FALSE)
metadata <- read.csv("analysis/exports/session_metadata.csv", stringsAsFactors = FALSE)

# ------------------------------------------------------------
# 2. Revisión inicial
# ------------------------------------------------------------

str(ueqs)
str(condition_data)
str(metadata)

summary(ueqs)
summary(condition_data)

# ------------------------------------------------------------
# 3. Análisis principal: Humano UEQ-S vs IA UEQ-S
# ------------------------------------------------------------

human_ueqs <- subset(ueqs, evaluator_type == "human")
ai_ueqs <- subset(ueqs, evaluator_type == "ai")

paired_ueqs <- merge(
  human_ueqs,
  ai_ueqs,
  by = "session_id",
  suffixes = c("_human", "_ai")
)

# Diferencias por puntaje global
paired_ueqs$diff_global <- paired_ueqs$ueqs_global_score_human - paired_ueqs$ueqs_global_score_ai
paired_ueqs$abs_diff_global <- abs(paired_ueqs$diff_global)

summary(paired_ueqs$diff_global)
summary(paired_ueqs$abs_diff_global)

# Prueba pareada exploratoria
# Usar con cautela si la muestra es pequeña.
t.test(
  paired_ueqs$ueqs_global_score_human,
  paired_ueqs$ueqs_global_score_ai,
  paired = TRUE
)

# Alternativa no paramétrica
wilcox.test(
  paired_ueqs$ueqs_global_score_human,
  paired_ueqs$ueqs_global_score_ai,
  paired = TRUE
)

# Correlación exploratoria
cor(
  paired_ueqs$ueqs_global_score_human,
  paired_ueqs$ueqs_global_score_ai,
  use = "complete.obs",
  method = "spearman"
)

# ------------------------------------------------------------
# 4. Comparación secundaria: Condición A vs Condición B
# ------------------------------------------------------------

condition_data$condition <- as.factor(condition_data$condition)

# Descriptivos por condición
aggregate(
  ueqs_global_score ~ condition,
  data = condition_data,
  FUN = mean
)

aggregate(
  godspeed_anthropomorphism ~ condition,
  data = condition_data,
  FUN = mean
)

aggregate(
  godspeed_likeability ~ condition,
  data = condition_data,
  FUN = mean
)

aggregate(
  godspeed_perceived_intelligence ~ condition,
  data = condition_data,
  FUN = mean
)

aggregate(
  godspeed_perceived_safety ~ condition,
  data = condition_data,
  FUN = mean
)

# Prueba exploratoria entre condiciones para UEQ-S global
# Usar t.test si se asumen condiciones paramétricas.
t.test(
  ueqs_global_score ~ condition,
  data = condition_data
)

# Alternativa no paramétrica
wilcox.test(
  ueqs_global_score ~ condition,
  data = condition_data
)

# ------------------------------------------------------------
# 5. Guardar datos derivados
# ------------------------------------------------------------

write.csv(
  paired_ueqs,
  "analysis/exports/paired_human_ai_ueqs.csv",
  row.names = FALSE
)

# ------------------------------------------------------------
# Nota metodológica
# ------------------------------------------------------------

# La comparación humano vs IA se limita a UEQ-S.
# Godspeed reducido se usa únicamente para comparar percepción humana
# entre la condición con avatar y la condición textual.