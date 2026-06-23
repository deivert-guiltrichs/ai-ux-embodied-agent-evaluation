import * as THREE from "https://esm.sh/three@0.170.0";
import { GLTFLoader } from "https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "https://esm.sh/@pixiv/three-vrm@3.5.3?deps=three@0.170.0";

let scene;
let camera;
let renderer;
let currentVrm = null;
let clock;
let initialized = false;
let loadingPromise = null;
let animationFrameId = null;
let groundShadow = null;

let isTalking = false;
let talkingBlend = 0;          // amplitud de la boca (sigue a isTalking)
let poseBlend = 0;             // 0 = postura de espera, 1 = postura explicativa (con damping)
let poseOverride = null;       // null | "idle" | "explain" (para depuración)
let mouthTimer = 0;
let speechStartedAt = 0;
let speechText = "";
let speechBoundaryCharIndex = 0;
let lastBoundaryAt = 0;
let blinkTimer = 0;
let nextBlink = 2 + Math.random() * 3;
let baseSceneY = 0;
let avatarHeight = 1.7;
let hasWarnedMouth = false;
let knownExpressionNames = [];
let knownMouthTargets = [];
let availableBones = {};       // mapa nombre -> boolean (detectado en el VRM cargado)

const AVATAR_URL = "/static/assets/avatar.vrm";
const DEFAULT_ROTATION_Y = Math.PI;
const TARGET_AVATAR_HEIGHT = 1.62;
const FOOT_Y = 0.02;

// Velocidad de suavizado (lambda para THREE.MathUtils.damp). Mayor = más rápido.
const POSE_LAMBDA = 4.0;       // transición espera <-> habla
const BONE_LAMBDA = 6.0;       // seguimiento de cada hueso hacia su objetivo

// Huesos que la animación corporal intentará controlar. Los que no existan se ignoran.
const BODY_BONES = [
    "spine",
    "chest",
    "neck",
    "head",
    "leftShoulder",
    "rightShoulder",
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
    "leftHand",
    "rightHand"
];

// Postura de espera (idle) y postura explicativa (explain).
// Rotaciones en radianes. Valores conservadores para no deformar hombros/codos/muñecas.
// En espera los brazos quedan abajo, cerca del cuerpo y con los antebrazos llevados
// al frente del torso (efecto semi-cruzado / manos juntas a la altura de la cintura).
const POSE = {
    idle: {
        spine: { x: 0.02, y: 0.0, z: 0.0 },
        chest: { x: 0.0, y: 0.0, z: 0.0 },
        neck: { x: 0.04, y: 0.0, z: 0.0 },
        head: { x: -0.02, y: 0.0, z: 0.0 },
        leftShoulder: { x: 0.0, y: 0.0, z: 0.04 },
        rightShoulder: { x: 0.0, y: 0.0, z: -0.04 },
        leftUpperArm: { x: 0.20, y: 0.12, z: 1.30 },
        rightUpperArm: { x: 0.20, y: -0.12, z: -1.30 },
        leftLowerArm: { x: 0.05, y: 0.45, z: 0.28 },
        rightLowerArm: { x: 0.05, y: -0.45, z: -0.28 },
        leftHand: { x: 0.0, y: 0.05, z: 0.10 },
        rightHand: { x: 0.0, y: -0.05, z: -0.10 }
    },
    explain: {
        spine: { x: 0.01, y: 0.0, z: 0.0 },
        chest: { x: 0.02, y: 0.0, z: 0.0 },
        neck: { x: 0.02, y: 0.0, z: 0.0 },
        head: { x: -0.01, y: 0.0, z: 0.0 },
        leftShoulder: { x: 0.0, y: 0.0, z: 0.08 },
        rightShoulder: { x: 0.0, y: 0.0, z: -0.08 },
        leftUpperArm: { x: 0.40, y: 0.16, z: 1.10 },
        rightUpperArm: { x: 0.40, y: -0.16, z: -1.10 },
        leftLowerArm: { x: 0.0, y: 0.28, z: 0.62 },
        rightLowerArm: { x: 0.0, y: -0.28, z: -0.62 },
        leftHand: { x: 0.0, y: 0.10, z: 0.15 },
        rightHand: { x: 0.0, y: -0.10, z: -0.15 }
    }
};

const PHONEME_EXPRESSIONS = {
    A: ["aa", "Aa", "AA", "a", "A", "Fcl_MTH_A", "vrc.v_aa", "あ", "mouth_a", "Mouth_A"],
    I: ["ih", "Ih", "IH", "ee", "Ee", "EE", "i", "I", "e", "E", "Fcl_MTH_I", "Fcl_MTH_E", "vrc.v_ih", "vrc.v_ee", "い", "え", "mouth_i", "mouth_e", "Mouth_I", "Mouth_E"],
    U: ["ou", "Ou", "OU", "oh", "Oh", "OH", "u", "U", "o", "O", "Fcl_MTH_U", "Fcl_MTH_O", "vrc.v_ou", "vrc.v_oh", "う", "お", "mouth_u", "mouth_o", "Mouth_U", "Mouth_O"],
    MOUTH_OPEN: ["mouthOpen", "MouthOpen", "jawOpen", "JawOpen", "open", "Open"],
    BLINK: ["blink", "Blink", "blinkLeft", "blinkRight", "Blink_L", "Blink_R", "Fcl_EYE_Close", "vrc.blink_left", "vrc.blink_right"]
};

const ALL_MOUTH_NAMES = [
    ...PHONEME_EXPRESSIONS.A,
    ...PHONEME_EXPRESSIONS.I,
    ...PHONEME_EXPRESSIONS.U,
    ...PHONEME_EXPRESSIONS.MOUTH_OPEN
];

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function smoothstep(t) {
    const x = Math.max(0, Math.min(1, t));
    return x * x * (3 - 2 * x);
}

function getCanvas() {
    return document.getElementById("vrmCanvas");
}

function getLoadingElement() {
    return document.getElementById("vrmLoading");
}

function showLoadingMessage(message) {
    const loading = getLoadingElement();

    if (loading) {
        loading.textContent = message;
        loading.classList.remove("hidden");
    }
}

function hideLoadingMessage() {
    const loading = getLoadingElement();

    if (loading) {
        loading.classList.add("hidden");
    }
}

function resizeRenderer() {
    const canvas = getCanvas();

    if (!canvas || !renderer || !camera) {
        return;
    }

    const container = canvas.parentElement;
    const width = container.clientWidth || 420;
    const height = container.clientHeight || 520;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function setupScene() {
    const canvas = getCanvas();

    if (!canvas) {
        throw new Error("No se encontró el canvas #vrmCanvas.");
    }

    scene = new THREE.Scene();
    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    camera.position.set(0, 0.98, 3.15);
    camera.lookAt(0, 0.92, 0);

    renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.85);
    keyLight.position.set(1.4, 2.4, 2.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9ec5ff, 0.9);
    fillLight.position.set(-1.6, 1.5, 1.6);
    scene.add(fillLight);

    addGroundReference();
    resizeRenderer();
    window.addEventListener("resize", resizeRenderer);
}

function addGroundReference() {
    const shadowGeometry = new THREE.CircleGeometry(0.62, 48);
    const shadowMaterial = new THREE.MeshBasicMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.16,
        depthWrite: false
    });

    groundShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    groundShadow.rotation.x = -Math.PI / 2;
    groundShadow.position.set(0, 0, 0.02);
    groundShadow.scale.set(1.1, 0.28, 1);
    scene.add(groundShadow);
}

function getBone(name) {
    // Validación defensiva: si no hay VRM o el hueso no existe, devuelve null sin romper.
    try {
        return currentVrm?.humanoid?.getNormalizedBoneNode(name) || null;
    } catch (error) {
        return null;
    }
}

function rememberBones() {
    availableBones = {};
    BODY_BONES.forEach((name) => {
        availableBones[name] = Boolean(getBone(name));
    });
}

function rememberExpressionNames(vrm) {
    knownExpressionNames = [];

    const manager = vrm?.expressionManager;
    if (!manager) {
        return;
    }

    try {
        if (manager._expressionMap) {
            knownExpressionNames = Array.from(manager._expressionMap.keys());
        } else if (manager.expressionMap) {
            knownExpressionNames = Array.from(manager.expressionMap.keys());
        } else if (manager._expressions) {
            knownExpressionNames = Object.keys(manager._expressions);
        }
    } catch (error) {
        knownExpressionNames = [];
    }
}

function rememberMouthTargets(vrm) {
    knownMouthTargets = [];

    if (!vrm?.scene) {
        return;
    }

    vrm.scene.traverse((object) => {
        if (object.isMesh && object.morphTargetDictionary) {
            Object.keys(object.morphTargetDictionary).forEach((name) => {
                if (/mouth|mth|jaw|aa|ih|ou|ee|oh|vrc\.v|口|あ|い|う|え|お/i.test(name)) {
                    knownMouthTargets.push({ mesh: object.name, name });
                }
            });
        }
    });

    console.log("Morph targets de boca detectados:", knownMouthTargets);
    console.log("Expresiones VRM detectadas:", knownExpressionNames);
}

// Aplica una postura completa de forma instantánea (sin damping).
// Se usa al cargar el avatar (para no mostrar la T-pose) y en las funciones de depuración.
function applyPoseInstant(poseKey) {
    const pose = POSE[poseKey];

    if (!pose) {
        return;
    }

    Object.keys(pose).forEach((boneName) => {
        const bone = getBone(boneName);

        if (!bone) {
            return;
        }

        const target = pose[boneName];
        bone.rotation.set(target.x, target.y, target.z);
    });
}

// Lleva un hueso hacia una rotación objetivo con suavizado independiente del framerate.
// Si el hueso no existe, simplemente no hace nada (robusto ante esqueletos incompletos).
function setBoneTarget(name, x, y, z, delta) {
    const bone = getBone(name);

    if (!bone) {
        return false;
    }

    bone.rotation.x = THREE.MathUtils.damp(bone.rotation.x, x, BONE_LAMBDA, delta);
    bone.rotation.y = THREE.MathUtils.damp(bone.rotation.y, y, BONE_LAMBDA, delta);
    bone.rotation.z = THREE.MathUtils.damp(bone.rotation.z, z, BONE_LAMBDA, delta);
    return true;
}

function alignAvatarToGround(vrm) {
    if (!vrm || !vrm.scene) {
        return;
    }

    vrm.scene.updateMatrixWorld(true);

    let box = new THREE.Box3().setFromObject(vrm.scene);
    if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) {
        vrm.scene.position.y = FOOT_Y;
        baseSceneY = FOOT_Y;
        return;
    }

    const height = Math.max(0.1, box.max.y - box.min.y);
    const scale = TARGET_AVATAR_HEIGHT / height;
    avatarHeight = TARGET_AVATAR_HEIGHT;

    vrm.scene.scale.setScalar(scale);
    vrm.scene.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(vrm.scene);
    vrm.scene.position.y += FOOT_Y - box.min.y;
    vrm.scene.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(vrm.scene);
    // Pequeña corrección negativa para que los pies queden visualmente apoyados en la sombra, no por encima.
    vrm.scene.position.y += FOOT_Y - box.min.y - 0.012;
    // baseSceneY se fija UNA sola vez. Nunca se acumula por frame, para evitar flotación.
    baseSceneY = vrm.scene.position.y;

    if (groundShadow) {
        groundShadow.position.y = 0;
        groundShadow.scale.set(0.92, 0.24, 1);
    }

    console.log("Alineación avatar:", { height, scale, baseSceneY, minY: box.min.y, maxY: box.max.y });
}

function loadVrm() {
    return new Promise((resolve, reject) => {
        showLoadingMessage("Cargando avatar 3D...");

        const loader = new GLTFLoader();

        loader.register((parser) => {
            return new VRMLoaderPlugin(parser);
        });

        loader.load(
            AVATAR_URL,
            (gltf) => {
                try {
                    const vrm = gltf.userData.vrm;

                    if (!vrm) {
                        throw new Error("El archivo se cargó, pero no contiene datos VRM válidos.");
                    }

                    VRMUtils.removeUnnecessaryVertices(gltf.scene);
                    VRMUtils.removeUnnecessaryJoints(gltf.scene);

                    currentVrm = vrm;
                    scene.add(vrm.scene);

                    // Si el modelo se ve de espaldas, cambie Math.PI por 0.
                    vrm.scene.rotation.y = DEFAULT_ROTATION_Y;
                    vrm.scene.position.set(0, 0, 0);

                    rememberExpressionNames(vrm);
                    rememberMouthTargets(vrm);
                    rememberBones();

                    // Aplica la postura de espera de inmediato para no mostrar la T-pose al cargar.
                    applyPoseInstant("idle");
                    poseBlend = 0;
                    poseOverride = null;

                    alignAvatarToGround(vrm);
                    resetMouth();

                    hideLoadingMessage();
                    animate();

                    console.log("Avatar VRM cargado correctamente:", currentVrm);
                    console.log("Huesos detectados para animación:", availableBones);
                    resolve(currentVrm);
                } catch (error) {
                    showLoadingMessage("No se pudo preparar el avatar VRM.");
                    reject(error);
                }
            },
            (progress) => {
                if (progress.total > 0) {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    showLoadingMessage(`Cargando avatar 3D... ${percent}%`);
                }
            },
            (error) => {
                showLoadingMessage("No se pudo cargar el avatar VRM. Revise la consola del navegador.");
                reject(error);
            }
        );
    });
}

function animate() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    const renderLoop = () => {
        animationFrameId = requestAnimationFrame(renderLoop);

        const delta = Math.min(0.05, clock.getDelta());
        const elapsed = clock.elapsedTime;

        if (currentVrm) {
            // Amplitud de la boca sigue al estado de habla.
            talkingBlend += ((isTalking ? 1 : 0) - talkingBlend) * Math.min(1, delta * 8);
            updateBodyMotion(elapsed, delta);
            updateBlink(delta);
            updateMouth(elapsed, delta);
            currentVrm.update(delta);
        }

        renderer.render(scene, camera);
    };

    renderLoop();
}

function updateBodyMotion(elapsed, delta) {
    if (!currentVrm || !currentVrm.scene) {
        return;
    }

    // Objetivo de pose: depende del override de depuración o del estado de habla.
    let targetPose;
    if (poseOverride === "idle") {
        targetPose = 0;
    } else if (poseOverride === "explain") {
        targetPose = 1;
    } else {
        targetPose = isTalking ? 1 : 0;
    }

    // Interpolación suave espera <-> habla (independiente del framerate).
    poseBlend = THREE.MathUtils.damp(poseBlend, targetPose, POSE_LAMBDA, delta);
    const b = smoothstep(poseBlend);
    const speaking = b;
    const idle = 1 - b;

    // Raíz SIEMPRE fija. La respiración se aplica en huesos internos, no en la raíz,
    // para que el modelo no parezca flotar hacia arriba y abajo.
    currentVrm.scene.position.y = baseSceneY;
    currentVrm.scene.rotation.y = DEFAULT_ROTATION_Y
        + Math.sin(elapsed * 0.45) * 0.010
        + Math.sin(elapsed * 1.15) * 0.018 * speaking;

    // Ciclo de respiración lento, compartido por torso/cuello/cabeza.
    const breath = Math.sin(elapsed * 1.05);

    // --- Columna y torso ---
    setBoneTarget(
        "spine",
        lerp(POSE.idle.spine.x, POSE.explain.spine.x, b) + breath * 0.010,
        lerp(POSE.idle.spine.y, POSE.explain.spine.y, b) + Math.sin(elapsed * 0.38) * 0.008 * idle,
        lerp(POSE.idle.spine.z, POSE.explain.spine.z, b),
        delta
    );

    setBoneTarget(
        "chest",
        lerp(POSE.idle.chest.x, POSE.explain.chest.x, b) + breath * 0.018,
        lerp(POSE.idle.chest.y, POSE.explain.chest.y, b) + Math.sin(elapsed * 0.55) * 0.012 * speaking,
        lerp(POSE.idle.chest.z, POSE.explain.chest.z, b) + Math.sin(elapsed * 0.7) * 0.010 * speaking,
        delta
    );

    // --- Cuello y cabeza (mirando al usuario) ---
    setBoneTarget(
        "neck",
        lerp(POSE.idle.neck.x, POSE.explain.neck.x, b) + breath * 0.008 + Math.sin(elapsed * 0.9) * 0.006 * speaking,
        lerp(POSE.idle.neck.y, POSE.explain.neck.y, b) + Math.sin(elapsed * 0.8 + 0.5) * (0.010 + speaking * 0.022),
        lerp(POSE.idle.neck.z, POSE.explain.neck.z, b),
        delta
    );

    setBoneTarget(
        "head",
        lerp(POSE.idle.head.x, POSE.explain.head.x, b) + Math.sin(elapsed * 1.25) * (0.010 + speaking * 0.030),
        lerp(POSE.idle.head.y, POSE.explain.head.y, b) + Math.sin(elapsed * 0.95) * (0.020 + speaking * 0.050),
        lerp(POSE.idle.head.z, POSE.explain.head.z, b) + Math.sin(elapsed * 0.75) * (0.010 + speaking * 0.015),
        delta
    );

    // --- Hombros (solo si existen) ---
    setBoneTarget(
        "leftShoulder",
        lerp(POSE.idle.leftShoulder.x, POSE.explain.leftShoulder.x, b),
        lerp(POSE.idle.leftShoulder.y, POSE.explain.leftShoulder.y, b),
        lerp(POSE.idle.leftShoulder.z, POSE.explain.leftShoulder.z, b) + breath * 0.005,
        delta
    );

    setBoneTarget(
        "rightShoulder",
        lerp(POSE.idle.rightShoulder.x, POSE.explain.rightShoulder.x, b),
        lerp(POSE.idle.rightShoulder.y, POSE.explain.rightShoulder.y, b),
        lerp(POSE.idle.rightShoulder.z, POSE.explain.rightShoulder.z, b) - breath * 0.005,
        delta
    );

    // --- Brazos superiores: gesticulación académica al hablar ---
    setBoneTarget(
        "leftUpperArm",
        lerp(POSE.idle.leftUpperArm.x, POSE.explain.leftUpperArm.x, b)
            + Math.sin(elapsed * 1.85 + 0.8) * 0.10 * speaking
            + Math.sin(elapsed * 0.5) * 0.010 * idle,
        lerp(POSE.idle.leftUpperArm.y, POSE.explain.leftUpperArm.y, b) + Math.sin(elapsed * 1.25) * 0.05 * speaking,
        lerp(POSE.idle.leftUpperArm.z, POSE.explain.leftUpperArm.z, b) + Math.sin(elapsed * 1.55) * 0.05 * speaking,
        delta
    );

    setBoneTarget(
        "rightUpperArm",
        lerp(POSE.idle.rightUpperArm.x, POSE.explain.rightUpperArm.x, b)
            + Math.sin(elapsed * 1.70 + 2.0) * 0.10 * speaking
            + Math.sin(elapsed * 0.45) * 0.010 * idle,
        lerp(POSE.idle.rightUpperArm.y, POSE.explain.rightUpperArm.y, b) + Math.sin(elapsed * 1.30 + 0.9) * 0.05 * speaking,
        lerp(POSE.idle.rightUpperArm.z, POSE.explain.rightUpperArm.z, b) + Math.sin(elapsed * 1.45 + 1.4) * 0.05 * speaking,
        delta
    );

    // --- Antebrazos: flexión y pequeños gestos ---
    setBoneTarget(
        "leftLowerArm",
        lerp(POSE.idle.leftLowerArm.x, POSE.explain.leftLowerArm.x, b) + Math.sin(elapsed * 1.8 + 0.4) * 0.04 * speaking,
        lerp(POSE.idle.leftLowerArm.y, POSE.explain.leftLowerArm.y, b) + Math.sin(elapsed * 2.1) * 0.06 * speaking,
        lerp(POSE.idle.leftLowerArm.z, POSE.explain.leftLowerArm.z, b),
        delta
    );

    setBoneTarget(
        "rightLowerArm",
        lerp(POSE.idle.rightLowerArm.x, POSE.explain.rightLowerArm.x, b) + Math.sin(elapsed * 1.7 + 1.2) * 0.04 * speaking,
        lerp(POSE.idle.rightLowerArm.y, POSE.explain.rightLowerArm.y, b) + Math.sin(elapsed * 1.95 + 1.1) * 0.06 * speaking,
        lerp(POSE.idle.rightLowerArm.z, POSE.explain.rightLowerArm.z, b),
        delta
    );

    // --- Manos: gesto muy leve, solo si existen ---
    setBoneTarget(
        "leftHand",
        lerp(POSE.idle.leftHand.x, POSE.explain.leftHand.x, b) + Math.sin(elapsed * 2.3) * 0.03 * speaking,
        lerp(POSE.idle.leftHand.y, POSE.explain.leftHand.y, b),
        lerp(POSE.idle.leftHand.z, POSE.explain.leftHand.z, b) + Math.sin(elapsed * 2.0 + 0.6) * 0.04 * speaking,
        delta
    );

    setBoneTarget(
        "rightHand",
        lerp(POSE.idle.rightHand.x, POSE.explain.rightHand.x, b) + Math.sin(elapsed * 2.2 + 0.9) * 0.03 * speaking,
        lerp(POSE.idle.rightHand.y, POSE.explain.rightHand.y, b),
        lerp(POSE.idle.rightHand.z, POSE.explain.rightHand.z, b) + Math.sin(elapsed * 1.9 + 1.5) * 0.04 * speaking,
        delta
    );
}

function updateBlink(delta) {
    blinkTimer += delta;

    if (blinkTimer > nextBlink) {
        setBlink(1.0);

        window.setTimeout(() => {
            setBlink(0.0);
        }, 115);

        blinkTimer = 0;
        nextBlink = 2.2 + Math.random() * 4.2;
    }
}

function estimateCharIndexFromTime() {
    if (!speechText) {
        return 0;
    }

    const elapsedMs = performance.now() - speechStartedAt;
    const estimatedCharsPerSecond = 14.2;
    const estimatedIndex = Math.floor((elapsedMs / 1000) * estimatedCharsPerSecond);
    return Math.max(speechBoundaryCharIndex, Math.min(speechText.length - 1, estimatedIndex));
}

function getCurrentSpeechCharacter() {
    if (!speechText) {
        return "a";
    }

    const index = estimateCharIndexFromTime();
    const windowText = speechText.slice(index, index + 10).toLowerCase();
    const vowelMatch = windowText.match(/[aeiouáéíóúü]/);

    return vowelMatch ? vowelMatch[0] : speechText[index].toLowerCase();
}

function getPhonemeGroup(character) {
    if (/[aá]/.test(character)) return "A";
    if (/[iíeé]/.test(character)) return "I";
    if (/[uúüoó]/.test(character)) return "U";
    return "A";
}

function updateMouth(elapsed, delta) {
    if (!isTalking) {
        resetMouth();
        return;
    }

    mouthTimer += delta;

    const character = getCurrentSpeechCharacter();
    const group = getPhonemeGroup(character);
    const timeSinceBoundary = performance.now() - lastBoundaryAt;
    const boundaryBoost = timeSinceBoundary < 170 ? 0.18 : 0;
    const rhythmicPulse = 0.18 + Math.abs(Math.sin(mouthTimer * 18.0)) * 0.66;
    const softerPulse = Math.abs(Math.sin(elapsed * 8.4)) * 0.12;
    const openness = Math.min(0.95, (rhythmicPulse + softerPulse + boundaryBoost) * talkingBlend);

    setMouthPhoneme(group, openness);
}

async function initVrmAvatar() {
    if (initialized) {
        return currentVrm;
    }

    if (loadingPromise) {
        return loadingPromise;
    }

    loadingPromise = (async () => {
        setupScene();
        const vrm = await loadVrm();
        initialized = true;
        return vrm;
    })();

    return loadingPromise;
}

function setExpression(name, value) {
    if (!currentVrm || !currentVrm.expressionManager) {
        return false;
    }

    try {
        currentVrm.expressionManager.setValue(name, value);
        return true;
    } catch (error) {
        return false;
    }
}

function setAnyExpression(names, value) {
    let applied = false;

    names.forEach((name) => {
        const ok = setExpression(name, value);
        if (ok) {
            applied = true;
        }
    });

    return applied;
}

function applyMorphTargetByName(possibleNames, value) {
    if (!currentVrm || !currentVrm.scene) {
        return false;
    }

    let applied = false;

    currentVrm.scene.traverse((object) => {
        if (!object.isMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) {
            return;
        }

        possibleNames.forEach((name) => {
            const index = object.morphTargetDictionary[name];

            if (index !== undefined) {
                object.morphTargetInfluences[index] = value;
                applied = true;
            }
        });
    });

    return applied;
}

function setNames(names, value) {
    const expressionApplied = setAnyExpression(names, value);
    const morphApplied = applyMorphTargetByName(names, value);
    return expressionApplied || morphApplied;
}

function resetMouth() {
    setNames(ALL_MOUTH_NAMES, 0);
}

function setMouthPhoneme(group, openness) {
    const mouthValue = Math.max(0, Math.min(1, openness));

    resetMouth();

    const phonemeNames = PHONEME_EXPRESSIONS[group] || PHONEME_EXPRESSIONS.A;
    const specificApplied = setNames(phonemeNames, mouthValue);
    const openApplied = setNames(PHONEME_EXPRESSIONS.MOUTH_OPEN, mouthValue * 0.75);

    if (!specificApplied && !openApplied && mouthValue > 0.05 && !hasWarnedMouth) {
        hasWarnedMouth = true;
        console.warn("No se encontró una expresión o morph target de boca compatible en este VRM. Use window.vrmAvatar.debug() para ver nombres disponibles.");
    }
}

function setMouthOpen(value) {
    setMouthPhoneme("A", value);
}

function setBlink(value) {
    const blinkValue = Math.max(0, Math.min(1, value));
    setNames(PHONEME_EXPRESSIONS.BLINK, blinkValue);
}

function startTalking(text = "") {
    isTalking = true;
    poseOverride = null; // al hablar, la pose vuelve a ser automática (explicativa)
    mouthTimer = 0;
    speechStartedAt = performance.now();
    lastBoundaryAt = performance.now();
    speechBoundaryCharIndex = 0;
    speechText = String(text || speechText || "");

    // La boca no se abre de golpe; se activa en updateMouth para coincidir con el inicio real de audio.
    resetMouth();
}

function updateSpeechProgress(progress = {}) {
    if (typeof progress.charIndex === "number") {
        speechBoundaryCharIndex = Math.max(0, progress.charIndex);
        lastBoundaryAt = performance.now();
    }
}

function stopTalking() {
    isTalking = false;
    poseOverride = null; // vuelve suavemente a la postura de espera
    mouthTimer = 0;
    speechBoundaryCharIndex = 0;
    speechText = "";
    resetMouth();
}

function forceIdlePose() {
    poseOverride = "idle";
    isTalking = false;
    resetMouth();
    return "forceIdlePose ejecutado";
}

function forceExplainPose() {
    poseOverride = "explain";
    return "forceExplainPose ejecutado";
}

function disposeVrmAvatar() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    window.removeEventListener("resize", resizeRenderer);
}

window.vrmAvatar = {
    init: initVrmAvatar,

    startTalking: function (text = "") {
        startTalking(text);
        return "startTalking ejecutado";
    },

    updateSpeechProgress: function (progress = {}) {
        updateSpeechProgress(progress);
        return "updateSpeechProgress ejecutado";
    },

    stopTalking: function () {
        stopTalking();
        return "stopTalking ejecutado";
    },

    // Alias por compatibilidad, por si app.js usa estos nombres.
    startSpeaking: function (text = "") {
        startTalking(text);
        return "startSpeaking ejecutado";
    },

    stopSpeaking: function () {
        stopTalking();
        return "stopSpeaking ejecutado";
    },

    testTalk: function (text = "Esta es una prueba breve de habla del avatar virtual.") {
        startTalking(text);

        setTimeout(() => {
            stopTalking();
        }, 3000);

        return "testTalk ejecutado por 3 segundos";
    },

    forceMouth: function (value = 1) {
        setMouthOpen(value);
        return `forceMouth aplicado con valor ${value}`;
    },

    forceIdlePose: function () {
        return forceIdlePose();
    },

    forceExplainPose: function () {
        return forceExplainPose();
    },

    debug: function () {
        console.log("currentVrm:", currentVrm);
        console.log("expressionManager:", currentVrm?.expressionManager);
        console.log("expresiones detectadas:", knownExpressionNames);
        console.log("morph targets de boca detectados:", knownMouthTargets);

        if (currentVrm?.scene) {
            const morphTargets = [];
            const bones = BODY_BONES.map((name) => ({ name, found: Boolean(getBone(name)) }));

            currentVrm.scene.traverse((object) => {
                if (object.isMesh && object.morphTargetDictionary) {
                    morphTargets.push({
                        name: object.name,
                        morphs: Object.keys(object.morphTargetDictionary)
                    });
                }
            });

            console.log("Huesos usados:", bones);
            console.log("Morph targets encontrados:", morphTargets);
            return { bones, knownExpressionNames, knownMouthTargets, morphTargets };
        }

        return [];
    },

    dispose: disposeVrmAvatar
};

console.log("VRM avatar controller exposed:", window.vrmAvatar);