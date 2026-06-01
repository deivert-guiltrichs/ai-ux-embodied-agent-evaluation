from typing import Dict, Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from src.gemini_client import GeminiClient
from src.session_logger import SessionLogger
from src.ux_human_evaluation import UXHumanEvaluationService
from src.ux_ai_evaluator import UXAIEvaluatorService


app = FastAPI(
    title="AI UX Embodied Agent Backend",
    description="Backend local para PoC de agente virtual académico con Gemini.",
    version="0.5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="src/static"), name="static")
templates = Jinja2Templates(directory="src/templates")

gemini_client = GeminiClient()
session_logger = SessionLogger()
ux_human_service = UXHumanEvaluationService()
ux_ai_service = UXAIEvaluatorService()


class StartSessionRequest(BaseModel):
    consent_accepted: bool
    condition: Optional[str] = "random"


class StartSessionResponse(BaseModel):
    session_id: str
    participant_id: str
    condition: str
    message: str


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    session_id: str
    response: str
    response_source: str


class EndSessionRequest(BaseModel):
    session_id: str


class EndSessionResponse(BaseModel):
    session_id: str
    participant_id: Optional[str] = None
    condition: Optional[str] = None
    ended: bool
    duration_seconds: Optional[float] = None
    transcript_path: str


class HumanUXEvaluationRequest(BaseModel):
    session_id: str
    answers: Dict[str, int]
    godspeed_answers: Dict[str, int] = Field(default_factory=dict)
    open_comment: str = ""


class HumanUXEvaluationResponse(BaseModel):
    session_id: str
    saved: bool
    evaluation_path: str
    scores: Dict[str, float]


class AIUXEvaluationRequest(BaseModel):
    session_id: str


class AIUXEvaluationResponse(BaseModel):
    session_id: str
    saved: bool
    evaluation_path: str
    scores: Dict[str, float]
    answers: Dict[str, int]
    justification: str


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FastAPI + Gemini + Web Agent PoC",
        "version": "0.5.0"
    }


@app.post("/session/start", response_model=StartSessionResponse)
def start_session(request: StartSessionRequest):
    try:
        session = session_logger.create_session(
            condition=request.condition,
            consent_accepted=request.consent_accepted
        )

        return StartSessionResponse(**session)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.post("/agent/chat", response_model=ChatResponse)
def chat_with_agent(request: ChatRequest):
    try:
        result = gemini_client.generate_agent_response_with_source(request.message)

        agent_response = result["response"]
        response_source = result["source"]

        session_logger.add_turn(
            session_id=request.session_id,
            user_message=request.message,
            agent_response=agent_response,
            response_source=response_source
        )

        return ChatResponse(
            session_id=request.session_id,
            response=agent_response,
            response_source=response_source
        )

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error interno en /agent/chat: {str(error)}"
        )


@app.post("/session/end", response_model=EndSessionResponse)
def end_session(request: EndSessionRequest):
    try:
        result = session_logger.end_session(request.session_id)
        return EndSessionResponse(**result)

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )


@app.get("/session/{session_id}")
def get_session(session_id: str):
    try:
        return session_logger.get_session(session_id)

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )


@app.post("/ux/human", response_model=HumanUXEvaluationResponse)
def save_human_ux_evaluation(request: HumanUXEvaluationRequest):
    try:
        result = ux_human_service.save_evaluation(request.model_dump())
        session_logger.mark_human_evaluation_completed(request.session_id)

        return HumanUXEvaluationResponse(**result)

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


@app.post("/ux/ai-evaluate", response_model=AIUXEvaluationResponse)
def evaluate_ux_with_ai(request: AIUXEvaluationRequest):
    try:
        result = ux_ai_service.evaluate_session(request.session_id)
        session_logger.mark_ai_evaluation_completed(request.session_id)

        return AIUXEvaluationResponse(**result)

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar evaluación UX con IA: {str(error)}"
        )