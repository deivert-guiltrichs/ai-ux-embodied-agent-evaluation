const consentScreen = document.getElementById("consentScreen");
const mainApp = document.getElementById("mainApp");
const consentCheckbox = document.getElementById("consentCheckbox");
const conditionSelect = document.getElementById("conditionSelect");
const consentError = document.getElementById("consentError");

const agentPanel = document.getElementById("agentPanel");
const chatPanel = document.getElementById("chatPanel");
const interfaceTitle = document.getElementById("interfaceTitle");
const interfaceDescription = document.getElementById("interfaceDescription");

const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const avatar = document.getElementById("avatar");
const agentStatus = document.getElementById("agentStatus");

const participantIdLabel = document.getElementById("participantIdLabel");
const sessionIdLabel = document.getElementById("sessionIdLabel");
const conditionLabel = document.getElementById("conditionLabel");

const uxPanel = document.getElementById("uxPanel");
const uxResult = document.getElementById("uxResult");
const aiEvaluationPanel = document.getElementById("aiEvaluationPanel");
const aiEvaluationResult = document.getElementById("aiEvaluationResult");

let currentSessionId = null;
let currentParticipantId = null;
let currentCondition = null;
let sessionFinished = false;

document.addEventListener("DOMContentLoaded", () => {
    initializeUXSliders();
});

async function startExperimentalSession() {
    consentError.classList.add("hidden");
    consentError.textContent = "";

    if (!consentCheckbox.checked) {
        consentError.textContent = "Debe aceptar el consentimiento básico para iniciar la prueba.";
        consentError.classList.remove("hidden");
        return;
    }

    const selectedCondition = conditionSelect.value || "random";

    try {
        const response = await fetch("/session/start", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                consent_accepted: true,
                condition: selectedCondition
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();

        currentSessionId = data.session_id;
        currentParticipantId = data.participant_id;
        currentCondition = data.condition;
        sessionFinished = false;

        participantIdLabel.textContent = currentParticipantId;
        sessionIdLabel.textContent = currentSessionId;
        conditionLabel.textContent = getConditionLabel(currentCondition);

        applyConditionUI(currentCondition);

        consentScreen.classList.add("hidden");
        mainApp.classList.remove("hidden");

        clearChat();

        addMessage(
            "Hola. Esta será una interacción breve sobre conceptos básicos de bases de datos. Puedes usar los botones de guía o escribir tu propia pregunta. Cuando termines, presiona “Finalizar sesión” para completar los instrumentos UX.",
            "agent"
        );

        setAvatarState("idle");

    } catch (error) {
        consentError.textContent = "No se pudo iniciar la sesión. Detalle: " + error.message;
        consentError.classList.remove("hidden");
    }
}

function getConditionLabel(condition) {
    if (condition === "embodied") {
        return "Condición A: agente con avatar visual";
    }

    if (condition === "text") {
        return "Condición B: interfaz textual sin avatar";
    }

    return "No asignada";
}

function applyConditionUI(condition) {
    if (condition === "text") {
        agentPanel.classList.add("hidden");
        mainApp.classList.add("text-only-layout");

        interfaceTitle.textContent = "Interfaz conversacional textual";
        interfaceDescription.textContent =
            "En esta condición, la interacción se realiza únicamente mediante texto. No se muestra avatar ni se reproduce voz.";

        stopSpeech();
        return;
    }

    agentPanel.classList.remove("hidden");
    mainApp.classList.remove("text-only-layout");

    interfaceTitle.textContent = "Agente virtual académico con avatar";
    interfaceDescription.textContent =
        "En esta condición, la interacción se apoya en un avatar visual básico, animaciones simples y voz del navegador.";
}

function clearChat() {
    chatMessages.innerHTML = "";
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
    if (!avatar || currentCondition === "text") {
        return;
    }

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

function stopSpeech() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
}

function speakText(text) {
    if (currentCondition === "text") {
        setAvatarState("idle");
        return;
    }

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
        addMessage("La sesión aún no está lista. Inicia la prueba desde la pantalla de consentimiento.", "agent");
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
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();

        console.log("Fuente de respuesta del agente:", data.response_source);

        addMessage(data.response, "agent");
        speakText(data.response);

    } catch (error) {
        console.error("Error al consultar el agente:", error);

        const errorMessage = "No se pudo conectar con el agente. Detalle: " + error.message;
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
        stopSpeech();

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
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();

        sessionFinished = true;
        setAvatarState("idle");

        addMessage(
            "La interacción fue finalizada correctamente. Ahora complete el cuestionario de experiencia de usuario que aparece debajo del chat.",
            "agent"
        );

        uxPanel.classList.remove("hidden");

        console.log("Transcripción generada en:", data.transcript_path);

    } catch (error) {
        addMessage("No se pudo finalizar la sesión. Detalle: " + error.message, "agent");
    }
}

function initializeUXSliders() {
    for (let i = 1; i <= 8; i++) {
        bindSliderValue(`item_${i}`, `value_item_${i}`);
    }

    const godspeedItems = [
        "godspeed_anthro_1",
        "godspeed_anthro_2",
        "godspeed_like_1",
        "godspeed_like_2",
        "godspeed_intel_1",
        "godspeed_intel_2",
        "godspeed_safety_1",
        "godspeed_safety_2"
    ];

    godspeedItems.forEach((itemId) => {
        bindSliderValue(itemId, `value_${itemId}`);
    });
}

function bindSliderValue(sliderId, valueLabelId) {
    const slider = document.getElementById(sliderId);
    const valueLabel = document.getElementById(valueLabelId);

    if (slider && valueLabel) {
        slider.addEventListener("input", () => {
            valueLabel.textContent = slider.value;
        });
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

const godspeedAnswers = {
    godspeed_anthro_1: parseInt(document.getElementById("godspeed_anthro_1").value),
    godspeed_anthro_2: parseInt(document.getElementById("godspeed_anthro_2").value),
    godspeed_like_1: parseInt(document.getElementById("godspeed_like_1").value),
    godspeed_like_2: parseInt(document.getElementById("godspeed_like_2").value),
    godspeed_intel_1: parseInt(document.getElementById("godspeed_intel_1").value),
    godspeed_intel_2: parseInt(document.getElementById("godspeed_intel_2").value),
    godspeed_safety_1: parseInt(document.getElementById("godspeed_safety_1").value),
    godspeed_safety_2: parseInt(document.getElementById("godspeed_safety_2").value)
};

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
                godspeed_answers: godspeedAnswers,
                open_comment: openComment
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();

        uxResult.classList.remove("hidden");
        uxResult.innerHTML = `
            Evaluación UX guardada correctamente.<br><br>

            <strong>UEQ-S</strong><br>
            Calidad pragmática: <strong>${data.scores.ueqs_pragmatic_quality}</strong><br>
            Calidad hedónica: <strong>${data.scores.ueqs_hedonic_quality}</strong><br>
            Puntaje global: <strong>${data.scores.ueqs_global_score}</strong><br><br>

            <strong>Godspeed reducido</strong><br>
            Antropomorfismo: <strong>${data.scores.godspeed_anthropomorphism}</strong><br>
            Simpatía: <strong>${data.scores.godspeed_likeability}</strong><br>
            Inteligencia percibida: <strong>${data.scores.godspeed_perceived_intelligence}</strong><br>
            Seguridad percibida: <strong>${data.scores.godspeed_perceived_safety}</strong>
        `;

        addMessage(
            "Gracias. La evaluación UX humana fue guardada correctamente.",
            "agent"
        );

        aiEvaluationPanel.classList.remove("hidden");

    } catch (error) {
        alert("Ocurrió un error al guardar la evaluación UX. Detalle: " + error.message);
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