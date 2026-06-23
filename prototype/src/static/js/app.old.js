const consentScreen = document.getElementById("consentScreen");
const mainApp = document.getElementById("mainApp");
const evaluationScreen = document.getElementById("evaluationScreen");
const consentCheckbox = document.getElementById("consentCheckbox");
const conditionSelect = document.getElementById("conditionSelect");
const consentError = document.getElementById("consentError");

const agentPanel = document.getElementById("agentPanel");
const chatPanel = document.getElementById("chatPanel");
const interfaceTitle = document.getElementById("interfaceTitle");
const interfaceDescription = document.getElementById("interfaceDescription");
const toggleTextButton = document.getElementById("toggleTextButton");

const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const avatar = document.getElementById("avatar");
const agentStatus = document.getElementById("agentStatus");
const speechInputButton = document.getElementById("speechInputButton");
const speechInputStatus = document.getElementById("speechInputStatus");

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
let vrmAvatarRequested = false;
let vrmAvatarReady = false;
let chatTextVisible = true;

let cachedVoices = [];
let selectedLatinVoice = null;
let voicesReadyPromise = null;
let recognition = null;
let recognitionSupported = false;
let recognitionListening = false;

const LATIN_SPANISH_PRIORITY = ["es-CR", "es-MX", "es-US", "es-419", "es-CO", "es-AR", "es-CL", "es-PE", "es-UY"];

// Estas funciones se invocan desde atributos onclick/onkeydown del HTML.
window.startExperimentalSession = startExperimentalSession;
window.sendMessage = sendMessage;
window.sendGuidedQuestion = sendGuidedQuestion;
window.handleEnter = handleEnter;
window.finishSession = finishSession;
window.submitUXEvaluation = submitUXEvaluation;
window.runAIEvaluation = runAIEvaluation;
window.toggleChatText = toggleChatText;
window.toggleSpeechInput = toggleSpeechInput;

document.addEventListener("DOMContentLoaded", () => {
    initializeUXSliders();
    prepareVoiceSelection();
    setupSpeechRecognition();
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
        evaluationScreen.classList.add("hidden");
        mainApp.classList.remove("hidden");
        resetEvaluationView();

        loadVrmAvatarIfNeeded();

        clearChat();

        addMessage(
            "Hola. Esta será una interacción breve sobre conceptos básicos de bases de datos. Puedes escribir o dictar tus preguntas. Cuando termines, presiona “Finalizar sesión” para completar los instrumentos UX.",
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
    stopSpeech();
    stopSpeechRecognition();

    if (condition === "text") {
        agentPanel.classList.add("hidden");
        mainApp.classList.add("text-only-layout");
        mainApp.classList.remove("embodied-chat-hidden");
        chatTextVisible = true;

        interfaceTitle.textContent = "Interfaz conversacional textual";
        interfaceDescription.textContent =
            "En esta condición, la interacción se realiza únicamente mediante texto. No se muestra avatar ni se reproduce voz.";

        if (toggleTextButton) {
            toggleTextButton.classList.add("hidden");
        }

        if (speechInputButton) {
            speechInputButton.classList.add("hidden");
        }

        hideSpeechInputStatus();
        return;
    }

    agentPanel.classList.remove("hidden");
    mainApp.classList.remove("text-only-layout");

    interfaceTitle.textContent = "Agente virtual académico con avatar";
    interfaceDescription.textContent =
        "En esta condición, la interacción se apoya en un avatar 3D, movimiento corporal sutil, voz del navegador y entrada por micrófono cuando el navegador lo permite.";

    chatTextVisible = true;
    mainApp.classList.remove("embodied-chat-hidden");

    if (toggleTextButton) {
        toggleTextButton.classList.remove("hidden");
        toggleTextButton.textContent = "Ocultar texto";
        toggleTextButton.setAttribute("aria-expanded", "true");
    }

    if (speechInputButton) {
        speechInputButton.classList.remove("hidden");
        speechInputButton.disabled = false;
        speechInputButton.title = recognitionSupported
            ? "Dictar pregunta por micrófono"
            : "Este navegador no soporta entrada de voz";
    }

    const loading = document.getElementById("vrmLoading");
    if (loading && !vrmAvatarReady) {
        loading.textContent = "Avatar 3D listo para cargar...";
        loading.classList.remove("hidden");
    }
}

async function loadVrmAvatarIfNeeded() {
    if (currentCondition !== "embodied") {
        return;
    }

    if (vrmAvatarReady || vrmAvatarRequested) {
        return;
    }

    vrmAvatarRequested = true;

    const loading = document.getElementById("vrmLoading");
    if (loading) {
        loading.textContent = "Cargando avatar 3D...";
        loading.classList.remove("hidden");
    }

    try {
        await import(`/static/js/vrm-avatar.js?v=${Date.now()}`);

        if (window.vrmAvatar && typeof window.vrmAvatar.init === "function") {
            await window.vrmAvatar.init();
            vrmAvatarReady = true;
        } else {
            throw new Error("El módulo VRM no expuso window.vrmAvatar.init().");
        }
    } catch (error) {
        console.error("No se pudo cargar el avatar VRM:", error);

        if (loading) {
            loading.textContent = "No se pudo cargar el avatar 3D. La interacción puede continuar.";
            loading.classList.remove("hidden");
        }
    }
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

function prepareVoiceSelection() {
    if (!("speechSynthesis" in window)) {
        return Promise.resolve([]);
    }

    if (voicesReadyPromise) {
        return voicesReadyPromise;
    }

    voicesReadyPromise = new Promise((resolve) => {
        const load = () => {
            cachedVoices = window.speechSynthesis.getVoices() || [];
            selectedLatinVoice = selectBestSpanishVoice(cachedVoices);
            if (cachedVoices.length > 0) {
                resolve(cachedVoices);
                return true;
            }
            return false;
        };

        if (load()) {
            return;
        }

        let attempts = 0;
        const interval = window.setInterval(() => {
            attempts += 1;
            if (load() || attempts >= 20) {
                window.clearInterval(interval);
                resolve(cachedVoices);
            }
        }, 150);

        window.speechSynthesis.onvoiceschanged = () => {
            load();
        };
    });

    return voicesReadyPromise;
}

function normalizeLang(lang) {
    return String(lang || "").trim().toLowerCase();
}

function selectBestSpanishVoice(voices) {
    if (!Array.isArray(voices) || voices.length === 0) {
        return null;
    }

    const spanishVoices = voices.filter((voice) => normalizeLang(voice.lang).startsWith("es"));

    if (spanishVoices.length === 0) {
        return null;
    }

    const scoreVoice = (voice) => {
        const lang = normalizeLang(voice.lang);
        const name = String(voice.name || "").toLowerCase();
        let score = 0;

        LATIN_SPANISH_PRIORITY.forEach((preferredLang, index) => {
            if (lang === preferredLang.toLowerCase()) {
                score += 100 - index * 4;
            }
        });

        if (lang === "es" || lang === "es-latn") score += 18;
        if (lang.startsWith("es-")) score += 8;

        if (name.includes("latino") || name.includes("latin") || name.includes("méxico") || name.includes("mexico")) score += 24;
        if (name.includes("costa rica") || name.includes("costarricense")) score += 35;
        if (name.includes("united states") || name.includes("estados unidos")) score += 10;
        if (name.includes("google") || name.includes("microsoft") || name.includes("natural")) score += 4;

        if (lang === "es-es" || name.includes("spain") || name.includes("españa") || name.includes("castellano")) score -= 60;

        return score;
    };

    return spanishVoices
        .slice()
        .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

async function speakText(text) {
    if (!text || currentCondition !== "embodied") {
        setAvatarState("idle");
        return;
    }

    if (!("speechSynthesis" in window)) {
        setAvatarState("idle");
        return;
    }

    await prepareVoiceSelection();

    // Detiene cualquier habla previa y deja la boca cerrada antes del nuevo audio.
    stopAvatarTalkingOnly();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = selectedLatinVoice || selectBestSpanishVoice(window.speechSynthesis.getVoices());

    if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || "es-419";
        console.log("Voz seleccionada para el agente:", voice.name, voice.lang);
    } else {
        utterance.lang = "es-419";
        console.warn("No se encontró una voz española latinoamericana; se usará la voz predeterminada del navegador.");
    }

    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.volume = 1.0;

    let started = false;
    let ended = false;

    const startAvatarSpeech = () => {
        if (started || ended) {
            return;
        }

        started = true;
        setAvatarState("talking");

        if (window.vrmAvatar && typeof window.vrmAvatar.startTalking === "function") {
            window.vrmAvatar.startTalking(text);
        }
    };

    const stopAvatarSpeech = () => {
        if (ended) {
            return;
        }

        ended = true;
        setAvatarState("idle");
        stopAvatarTalkingOnly();
    };

    utterance.onstart = () => {
        // Importante: no activar boca/cuerpo antes de que el navegador confirme el inicio del audio.
        startAvatarSpeech();
    };

    utterance.onboundary = (event) => {
        // Algunos navegadores emiten boundary incluso si onstart se retrasa. Lo usamos como respaldo.
        startAvatarSpeech();

        if (window.vrmAvatar && typeof window.vrmAvatar.updateSpeechProgress === "function") {
            window.vrmAvatar.updateSpeechProgress({
                charIndex: event.charIndex || 0,
                name: event.name || "",
                elapsedTime: event.elapsedTime || 0
            });
        }
    };

    utterance.onend = stopAvatarSpeech;
    utterance.onerror = stopAvatarSpeech;

    try {
        window.speechSynthesis.resume();
    } catch (error) {
        console.warn("No se pudo reanudar speechSynthesis:", error);
    }

    window.speechSynthesis.speak(utterance);
}

function stopAvatarTalkingOnly() {
    if (window.vrmAvatar && typeof window.vrmAvatar.stopTalking === "function") {
        window.vrmAvatar.stopTalking();
    }
}

function stopSpeech() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    if (window.vrmAvatar && typeof window.vrmAvatar.stopTalking === "function") {
        window.vrmAvatar.stopTalking();
    }

    setAvatarState("idle");
}

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionSupported = Boolean(SpeechRecognition);

    if (!speechInputButton) {
        return;
    }

    if (!recognitionSupported) {
        speechInputButton.title = "Este navegador no soporta entrada de voz";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "es-CR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        recognitionListening = true;
        speechInputButton.classList.add("listening");
        speechInputButton.textContent = "🟢";
        showSpeechInputStatus("Escuchando... Hable con claridad y revise el texto antes de enviarlo.");
    };

    recognition.onresult = (event) => {
        let transcript = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            transcript += event.results[i][0].transcript;
        }

        if (transcript.trim()) {
            userInput.value = transcript.trim();
        }

        const latestResult = event.results[event.results.length - 1];
        if (latestResult && latestResult.isFinal) {
            showSpeechInputStatus("Texto reconocido. Revíselo y presione Enviar cuando esté listo.");
        }
    };

    recognition.onerror = (event) => {
        const message = event.error === "not-allowed"
            ? "El navegador bloqueó el micrófono. Revise los permisos del sitio."
            : "No se pudo usar el micrófono en este momento. Puede escribir la pregunta manualmente.";

        showSpeechInputStatus(message);
    };

    recognition.onend = () => {
        recognitionListening = false;
        speechInputButton.classList.remove("listening");
        speechInputButton.textContent = "🎙️";
    };
}

function toggleSpeechInput() {
    if (currentCondition !== "embodied") {
        return;
    }

    if (!recognitionSupported || !recognition) {
        showSpeechInputStatus("Este navegador no soporta entrada de voz. Puede continuar escribiendo la pregunta.");
        return;
    }

    try {
        if (recognitionListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    } catch (error) {
        console.warn("No se pudo alternar SpeechRecognition:", error);
        showSpeechInputStatus("No se pudo iniciar el micrófono. Intente nuevamente o escriba la pregunta.");
    }
}

function stopSpeechRecognition() {
    if (recognition && recognitionListening) {
        try {
            recognition.stop();
        } catch (error) {
            console.warn("No se pudo detener SpeechRecognition:", error);
        }
    }

    recognitionListening = false;

    if (speechInputButton) {
        speechInputButton.classList.remove("listening");
        speechInputButton.textContent = "🎙️";
    }
}

function showSpeechInputStatus(message) {
    if (!speechInputStatus) {
        return;
    }

    speechInputStatus.textContent = message;
    speechInputStatus.classList.remove("hidden");
}

function hideSpeechInputStatus() {
    if (!speechInputStatus) {
        return;
    }

    speechInputStatus.textContent = "";
    speechInputStatus.classList.add("hidden");
}

function toggleChatText() {
    if (currentCondition !== "embodied") {
        return;
    }

    chatTextVisible = !chatTextVisible;
    mainApp.classList.toggle("embodied-chat-hidden", !chatTextVisible);

    if (toggleTextButton) {
        toggleTextButton.textContent = chatTextVisible ? "Ocultar texto" : "Mostrar texto";
        toggleTextButton.setAttribute("aria-expanded", String(chatTextVisible));
    }
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

    stopSpeechRecognition();
    hideSpeechInputStatus();

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
        stopSpeechRecognition();

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
            "La interacción fue finalizada correctamente. Ahora complete el cuestionario de experiencia de usuario.",
            "agent"
        );

        uxPanel.classList.remove("hidden");
        mainApp.classList.add("hidden");
        evaluationScreen.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });

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

function resetEvaluationView() {
    if (uxPanel) {
        uxPanel.classList.add("hidden");
    }

    if (uxResult) {
        uxResult.classList.add("hidden");
        uxResult.innerHTML = "";
    }

    if (aiEvaluationPanel) {
        aiEvaluationPanel.classList.add("hidden");
    }

    if (aiEvaluationResult) {
        aiEvaluationResult.classList.add("hidden");
        aiEvaluationResult.innerHTML = "";
    }

    const openComment = document.getElementById("openComment");
    if (openComment) {
        openComment.value = "";
    }

    for (let i = 1; i <= 8; i++) {
        const item = document.getElementById(`item_${i}`);
        const label = document.getElementById(`value_item_${i}`);

        if (item) {
            item.value = 4;
        }

        if (label) {
            label.textContent = "4";
        }
    }

    const godspeedIds = [
        "godspeed_anthro_1",
        "godspeed_anthro_2",
        "godspeed_like_1",
        "godspeed_like_2",
        "godspeed_intel_1",
        "godspeed_intel_2",
        "godspeed_safety_1",
        "godspeed_safety_2"
    ];

    godspeedIds.forEach((id) => {
        const item = document.getElementById(id);
        const label = document.getElementById(`value_${id}`);

        if (item) {
            item.value = 4;
        }

        if (label) {
            label.textContent = "4";
        }
    });
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
