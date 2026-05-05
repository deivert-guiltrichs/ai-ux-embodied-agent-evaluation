const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const avatar = document.getElementById("avatar");
const agentStatus = document.getElementById("agentStatus");
const sessionIdLabel = document.getElementById("sessionIdLabel");
const uxPanel = document.getElementById("uxPanel");
const uxResult = document.getElementById("uxResult");
const aiEvaluationPanel = document.getElementById("aiEvaluationPanel");
const aiEvaluationResult = document.getElementById("aiEvaluationResult");

let currentSessionId = null;
let sessionFinished = false;

document.addEventListener("DOMContentLoaded", async () => {
    await startSession();
    initializeUXSliders();
});

async function startSession() {
    try {
        const response = await fetch("/session/start", {
            method: "POST"
        });

        const data = await response.json();
        currentSessionId = data.session_id;

        sessionIdLabel.textContent = currentSessionId;

    } catch (error) {
        sessionIdLabel.textContent = "Error al iniciar sesión";
        addMessage("No se pudo iniciar la sesión. Verifica el backend.", "agent");
    }
}

function addMessage(content, sender) {
    const message = document.createElement("div");
    message.classList.add("message");

    if (sender === "user") {
        message.classList.add("user-message");
    } else {
        message.classList.add("agent-message");
    }

    message.textContent = content;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setAvatarState(state) {
    avatar.classList.remove("idle", "thinking", "talking");

    if (state === "thinking") {
        avatar.classList.add("thinking");
        agentStatus.textContent = "Pensando...";
    } else if (state === "talking") {
        avatar.classList.add("talking");
        agentStatus.textContent = "Hablando...";
    } else {
        avatar.classList.add("idle");
        agentStatus.textContent = "En espera";
    }
}

function speakText(text) {
    if (!("speechSynthesis" in window)) {
        setAvatarState("idle");
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    utterance.onstart = () => {
        setAvatarState("talking");
    };

    utterance.onend = () => {
        setAvatarState("idle");
    };

    utterance.onerror = () => {
        setAvatarState("idle");
    };

    window.speechSynthesis.speak(utterance);
}

async function sendMessage() {
    if (sessionFinished) {
        addMessage("La sesión ya fue finalizada. Recarga la página para iniciar una nueva.", "agent");
        return;
    }

    if (!currentSessionId) {
        addMessage("La sesión aún no está lista. Espera unos segundos e intenta de nuevo.", "agent");
        return;
    }

    const message = userInput.value.trim();

    if (!message) {
        return;
    }

    addMessage(message, "user");
    userInput.value = "";

    setAvatarState("thinking");

    try {
        const response = await fetch("/agent/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                message: message
            })
        });

        if (!response.ok) {
            throw new Error("Error en la respuesta del servidor");
        }

        const data = await response.json();

        addMessage(data.response, "agent");
        speakText(data.response);

    } catch (error) {
        const errorMessage = "No se pudo conectar con el agente. Verifica que el backend esté funcionando.";
        addMessage(errorMessage, "agent");
        setAvatarState("idle");
    }
}

function sendGuidedQuestion(question) {
    if (sessionFinished) {
        addMessage("La sesión ya fue finalizada. Recarga la página para iniciar una nueva.", "agent");
        return;
    }

    userInput.value = question;
    sendMessage();
}

function handleEnter(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

async function finishSession() {
    if (!currentSessionId) {
        addMessage("No hay una sesión activa para finalizar.", "agent");
        return;
    }

    if (sessionFinished) {
        addMessage("Esta sesión ya fue finalizada.", "agent");
        return;
    }

    try {
        const response = await fetch("/session/end", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: currentSessionId
            })
        });

        if (!response.ok) {
            throw new Error("Error al finalizar la sesión");
        }

        const data = await response.json();

        sessionFinished = true;
        setAvatarState("idle");

        addMessage(
            "La sesión fue finalizada correctamente. Se generó la transcripción local para la evaluación UX.",
            "agent"
        );

        uxPanel.classList.remove("hidden");

        console.log("Transcripción generada en:", data.transcript_path);

    } catch (error) {
        addMessage("No se pudo finalizar la sesión. Revisa la consola del backend.", "agent");
    }
}

function initializeUXSliders() {
    for (let i = 1; i <= 8; i++) {
        const slider = document.getElementById(`item_${i}`);
        const valueLabel = document.getElementById(`value_item_${i}`);

        if (slider && valueLabel) {
            slider.addEventListener("input", () => {
                valueLabel.textContent = slider.value;
            });
        }
    }
}

async function submitUXEvaluation() {
    if (!currentSessionId) {
        alert("No hay una sesión activa.");
        return;
    }

    if (!sessionFinished) {
        alert("Primero debe finalizar la sesión antes de guardar la evaluación UX.");
        return;
    }

    const answers = {};

    for (let i = 1; i <= 8; i++) {
        const item = document.getElementById(`item_${i}`);
        answers[`item_${i}`] = parseInt(item.value);
    }

    const openComment = document.getElementById("openComment").value.trim();

    try {
        const response = await fetch("/ux/human", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                answers: answers,
                open_comment: openComment
            })
        });

        if (!response.ok) {
            throw new Error("No se pudo guardar la evaluación UX.");
        }

        const data = await response.json();

        uxResult.classList.remove("hidden");
        uxResult.innerHTML = `
            Evaluación UX guardada correctamente.<br>
            Calidad pragmática: <strong>${data.scores.pragmatic_quality}</strong><br>
            Calidad hedónica: <strong>${data.scores.hedonic_quality}</strong><br>
            Puntaje global: <strong>${data.scores.global_score}</strong>
        `;

        addMessage(
            "Gracias. La evaluación UX humana fue guardada correctamente.",
            "agent"
        );
        aiEvaluationPanel.classList.remove("hidden");

    } catch (error) {
        alert("Ocurrió un error al guardar la evaluación UX.");
    }
}

async function runAIEvaluation() {
    if (!currentSessionId) {
        alert("No hay una sesión activa.");
        return;
    }

    if (!sessionFinished) {
        alert("Primero debe finalizar la sesión.");
        return;
    }

    aiEvaluationResult.classList.remove("hidden");
    aiEvaluationResult.innerHTML = "Generando evaluación UX con IA...";

    try {
        const response = await fetch("/ux/ai-evaluate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: currentSessionId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();

        aiEvaluationResult.innerHTML = `
            <strong>Evaluación IA guardada correctamente.</strong><br><br>
            <strong>Calidad pragmática:</strong> ${data.scores.pragmatic_quality}<br>
            <strong>Calidad hedónica:</strong> ${data.scores.hedonic_quality}<br>
            <strong>Puntaje global:</strong> ${data.scores.global_score}<br><br>
            <strong>Respuestas UEQ-S generadas por IA:</strong><br>
            Ítem 1: ${data.answers.item_1}<br>
            Ítem 2: ${data.answers.item_2}<br>
            Ítem 3: ${data.answers.item_3}<br>
            Ítem 4: ${data.answers.item_4}<br>
            Ítem 5: ${data.answers.item_5}<br>
            Ítem 6: ${data.answers.item_6}<br>
            Ítem 7: ${data.answers.item_7}<br>
            Ítem 8: ${data.answers.item_8}<br><br>
            <strong>Justificación:</strong><br>
            ${data.justification}
        `;

        addMessage(
            "La evaluación UX con IA fue generada y guardada correctamente.",
            "agent"
        );

    } catch (error) {
        console.error("Error al generar evaluación UX con IA:", error);

        aiEvaluationResult.innerHTML = `
            No se pudo generar la evaluación UX con IA.<br>
            Detalle: ${error.message}
        `;
    }
}