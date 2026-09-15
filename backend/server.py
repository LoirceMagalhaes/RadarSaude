from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

import json
import secrets as _secrets
import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# Twilio
try:
    from twilio.rest import Client as TwilioClient
    from twilio.request_validator import RequestValidator
    from twilio.twiml.messaging_response import MessagingResponse
    _twilio_available = True
except Exception:
    _twilio_available = False

# --- Setup ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "")
TWILIO_REMINDER_CONTENT_SID = os.environ.get("TWILIO_REMINDER_CONTENT_SID", "")
PUBLIC_API_URL = os.environ.get("PUBLIC_API_URL", "").rstrip("/")
APP_TIMEZONE = os.environ.get("APP_TIMEZONE", "America/Sao_Paulo")
WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")

WHATSAPP_CLOUD_TOKEN = os.environ.get("WHATSAPP_CLOUD_TOKEN", "")
WHATSAPP_CLOUD_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "")
WHATSAPP_CLOUD_API_VERSION = os.environ.get("WHATSAPP_CLOUD_API_VERSION", "v20.0")
WHATSAPP_WELCOME_TEMPLATE = os.environ.get("WHATSAPP_WELCOME_TEMPLATE", "hello_world")
WHATSAPP_TEMPLATE_LANG = os.environ.get("WHATSAPP_TEMPLATE_LANG", "en_US")
CALLMEBOT_ADMIN_PHONE = os.environ.get("CALLMEBOT_ADMIN_PHONE", "")
CALLMEBOT_APIKEY = os.environ.get("CALLMEBOT_APIKEY", "")
ADMIN_WHATSAPP_NUMBER = os.environ.get("ADMIN_WHATSAPP_NUMBER", "")

try:
    import httpx  # noqa
    _http_available = True
except Exception:
    _http_available = False

_twilio_client = None
def get_twilio():
    global _twilio_client
    if not _twilio_available or not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return None
    if _twilio_client is None:
        _twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    return _twilio_client

app = FastAPI(title="Radar Sanitário API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("radar")


# --- Utils ---
def now_utc():
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": now_utc() + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0})
    if not user:
        raise HTTPException(401, "Usuário não encontrado")
    user.pop("_id", None)
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Acesso restrito ao administrador")
    return user


# --- Models ---
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    nome_fantasia: Optional[str] = None


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class EstabelecimentoInput(BaseModel):
    nome_fantasia: str
    razao_social: Optional[str] = ""
    tipo: str  # Hospital, Clínica Odontológica, etc
    cnpj: Optional[str] = ""
    cidade: Optional[str] = ""
    uf: Optional[str] = ""
    responsavel_tecnico: Optional[str] = ""
    telefone: Optional[str] = ""
    email: Optional[str] = ""
    whatsapp: Optional[str] = ""  # E.164, e.g. +5541999999999
    grau_risco: Optional[str] = "II"  # I, II, III
    ativo: bool = True


class DocumentoInput(BaseModel):
    estabelecimento_id: str
    tipo: str  # AFE, PGRSS, MTR, Alvará, Contrato RSS...
    numero: Optional[str] = ""
    emissao: str  # ISO date
    validade: str  # ISO date
    observacoes: Optional[str] = ""


class VisitaInput(BaseModel):
    estabelecimento_id: str
    data: str  # ISO date
    tipo: str  # Coleta, Inspeção, Consultoria
    responsavel: Optional[str] = ""
    observacoes: Optional[str] = ""
    status: str = "agendada"  # agendada, concluida, cancelada


# --- Startup ---
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.estabelecimentos.create_index("id", unique=True)
    await db.documentos.create_index("id", unique=True)
    await db.visitas.create_index("id", unique=True)
    await db.reminder_sends.create_index(
        [("document_id", 1), ("bucket", 1), ("local_date", 1)], unique=True
    )
    await db.support_messages.create_index([("thread_key", 1), ("created_at", 1)])

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Administrador Radar Sanitário",
            "role": "admin",
            "estabelecimento_id": None,
            "created_at": now_utc().isoformat(),
        })
        logger.info(f"Admin criado: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )


# --- Auth Endpoints ---
def _set_cookie(resp: Response, token: str):
    resp.set_cookie(
        key="access_token", value=token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 3600, path="/",
    )


def _user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u["role"],
        "estabelecimento_id": u.get("estabelecimento_id"),
    }


@api.post("/auth/register")
async def register(body: RegisterInput, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "E-mail já cadastrado")

    # Create paired estabelecimento for empresa user
    estab_id = str(uuid.uuid4())
    await db.estabelecimentos.insert_one({
        "id": estab_id,
        "nome_fantasia": body.nome_fantasia or body.name,
        "razao_social": "",
        "tipo": "Clínica Odontológica",
        "cnpj": "",
        "cidade": "",
        "uf": "",
        "responsavel_tecnico": body.name,
        "telefone": "",
        "email": email,
        "grau_risco": "II",
        "ativo": True,
        "owner_id": None,
        "created_at": now_utc().isoformat(),
    })

    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "empresa",
        "estabelecimento_id": estab_id,
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    await db.estabelecimentos.update_one({"id": estab_id}, {"$set": {"owner_id": user_id}})

    token = create_access_token(user_id, email, "empresa")
    _set_cookie(response, token)
    return {"user": _user_public(user), "access_token": token}


@api.post("/auth/login")
async def login(body: LoginInput, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "E-mail ou senha inválidos")
    token = create_access_token(user["id"], user["email"], user["role"])
    _set_cookie(response, token)
    return {"user": _user_public(user), "access_token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return _user_public(user)


# --- Helper: scope filter ---
def scope_filter(user: dict) -> dict:
    if user["role"] == "admin":
        return {}
    return {"estabelecimento_id": user.get("estabelecimento_id")}


def _clean(doc):
    doc.pop("_id", None)
    return doc


def _dias_para_vencer(validade_iso: str) -> int:
    try:
        d = datetime.fromisoformat(validade_iso).date()
    except Exception:
        return 9999
    return (d - date.today()).days


def _status_from_dias(dias: int) -> str:
    if dias < 0:
        return "vencido"
    if dias <= 30:
        return "critico_30d"
    if dias <= 90:
        return "atencao_90d"
    return "vigente"


# --- Twilio WhatsApp helpers ---
def _wa(number: str) -> Optional[str]:
    if not number:
        return None
    n = number.strip().replace(" ", "").replace("-", "")
    if not n.startswith("+"):
        return None
    return f"whatsapp:{n}"


def _classify_bucket(validade_iso: str) -> Optional[str]:
    dias = _dias_para_vencer(validade_iso)
    if dias < 0:
        return "vencido"
    if dias <= 3:
        return "3_dias"
    if dias <= 30:
        return "30_dias"
    return None


def _format_reminder_body(estab_nome: str, tipo: str, numero: str, validade: str, bucket: str) -> str:
    label = {"vencido": "VENCIDO", "3_dias": "vence em até 3 dias", "30_dias": "vence em até 30 dias"}[bucket]
    n = f" nº {numero}" if numero else ""
    return (
        f"🚨 *Radar Sanitário*\n\n"
        f"Documento *{tipo}*{n} do estabelecimento *{estab_nome}* {label}.\n"
        f"Validade: {validade}\n\n"
        f"Acesse o painel para renovar. Responda AJUDA para suporte."
    )


async def _send_wa(to_e164: str, body: str, content_sid: Optional[str] = None,
                   content_variables: Optional[dict] = None) -> Optional[str]:
    tw = get_twilio()
    if not tw or not TWILIO_WHATSAPP_FROM:
        logger.warning("Twilio não configurado — mensagem não enviada")
        return None
    to = _wa(to_e164)
    if not to:
        logger.warning(f"Número inválido: {to_e164}")
        return None
    try:
        kwargs = {"from_": TWILIO_WHATSAPP_FROM, "to": to}
        if content_sid:
            kwargs["content_sid"] = content_sid
            if content_variables is not None:
                kwargs["content_variables"] = json.dumps(content_variables)
        else:
            kwargs["body"] = body
        msg = tw.messages.create(**kwargs)
        return msg.sid
    except Exception as e:
        logger.error(f"Erro Twilio: {e}")
        return None


async def _notify_if_due(doc: dict) -> Optional[str]:
    """Send WhatsApp reminder if document is expired/<=3d/<=30d. Idempotent per (doc, bucket, day)."""
    bucket = _classify_bucket(doc.get("validade", ""))
    if not bucket:
        return None
    estab = await db.estabelecimentos.find_one({"id": doc.get("estabelecimento_id")})
    if not estab:
        return None
    to = (estab.get("whatsapp") or "").strip()
    if not to:
        return None
    local_date = date.today().isoformat()
    key = {"document_id": doc["id"], "bucket": bucket, "local_date": local_date}
    try:
        await db.reminder_sends.insert_one({**key, "status": "reserved", "created_at": now_utc().isoformat()})
    except Exception:
        return None  # already sent today for this bucket
    body = _format_reminder_body(
        estab.get("nome_fantasia", ""),
        doc.get("tipo", ""),
        doc.get("numero", ""),
        doc.get("validade", ""),
        bucket,
    )
    content_vars = None
    if TWILIO_REMINDER_CONTENT_SID:
        content_vars = {
            "1": estab.get("nome_fantasia", ""),
            "2": doc.get("tipo", ""),
            "3": doc.get("validade", ""),
        }
    sid = await _send_wa(to, body, TWILIO_REMINDER_CONTENT_SID or None, content_vars)
    await db.reminder_sends.update_one(
        key,
        {"$set": {"status": "sent" if sid else "failed",
                  "twilio_sid": sid,
                  "sent_at": now_utc().isoformat(),
                  "to": to}}
    )
    return sid


# --- Estabelecimentos ---
@api.get("/estabelecimentos")
async def list_estab(user: dict = Depends(get_current_user)):
    q = {} if user["role"] == "admin" else {"id": user.get("estabelecimento_id")}
    items = await db.estabelecimentos.find(q).to_list(1000)
    return [_clean(x) for x in items]


@api.post("/estabelecimentos")
async def create_estab(body: EstabelecimentoInput, user: dict = Depends(require_admin)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc().isoformat()
    await db.estabelecimentos.insert_one(doc)
    return _clean(doc)


@api.put("/estabelecimentos/{estab_id}")
async def update_estab(estab_id: str, body: EstabelecimentoInput, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user.get("estabelecimento_id") != estab_id:
        raise HTTPException(403, "Sem permissão")
    await db.estabelecimentos.update_one({"id": estab_id}, {"$set": body.model_dump()})
    doc = await db.estabelecimentos.find_one({"id": estab_id})
    return _clean(doc)


@api.delete("/estabelecimentos/{estab_id}")
async def delete_estab(estab_id: str, user: dict = Depends(require_admin)):
    await db.estabelecimentos.delete_one({"id": estab_id})
    await db.documentos.delete_many({"estabelecimento_id": estab_id})
    await db.visitas.delete_many({"estabelecimento_id": estab_id})
    return {"ok": True}


# --- Documentos ---
@api.get("/documentos")
async def list_docs(user: dict = Depends(get_current_user)):
    q = scope_filter(user)
    items = await db.documentos.find(q).to_list(2000)
    # attach status + dias + nome
    estabs = {e["id"]: e async for e in db.estabelecimentos.find({})}
    result = []
    for x in items:
        _clean(x)
        dias = _dias_para_vencer(x.get("validade", ""))
        x["dias_para_vencer"] = dias
        x["status"] = _status_from_dias(dias)
        est = estabs.get(x.get("estabelecimento_id"))
        x["estabelecimento_nome"] = est["nome_fantasia"] if est else "—"
        result.append(x)
    result.sort(key=lambda d: d["dias_para_vencer"])
    return result


@api.post("/documentos")
async def create_doc(body: DocumentoInput, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user.get("estabelecimento_id") != body.estabelecimento_id:
        raise HTTPException(403, "Sem permissão")
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc().isoformat()
    await db.documentos.insert_one(doc)
    _clean(doc)
    background.add_task(_notify_if_due, dict(doc))
    return doc


@api.put("/documentos/{doc_id}")
async def update_doc(doc_id: str, body: DocumentoInput, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    existing = await db.documentos.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(404, "Documento não encontrado")
    if user["role"] != "admin" and user.get("estabelecimento_id") != existing.get("estabelecimento_id"):
        raise HTTPException(403, "Sem permissão")
    await db.documentos.update_one({"id": doc_id}, {"$set": body.model_dump()})
    doc = await db.documentos.find_one({"id": doc_id})
    _clean(doc)
    background.add_task(_notify_if_due, dict(doc))
    return doc


@api.post("/documentos/{doc_id}/renovar")
async def renovar_doc(doc_id: str, meses: int = 12, user: dict = Depends(get_current_user)):
    existing = await db.documentos.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(404, "Documento não encontrado")
    if user["role"] != "admin" and user.get("estabelecimento_id") != existing.get("estabelecimento_id"):
        raise HTTPException(403, "Sem permissão")
    hoje = date.today()
    nova_val = hoje + timedelta(days=30 * meses)
    await db.documentos.update_one(
        {"id": doc_id},
        {"$set": {
            "emissao": hoje.isoformat(),
            "validade": nova_val.isoformat(),
            "renovado_em": now_utc().isoformat(),
        }}
    )
    doc = await db.documentos.find_one({"id": doc_id})
    return _clean(doc)


@api.delete("/documentos/{doc_id}")
async def delete_doc(doc_id: str, user: dict = Depends(get_current_user)):
    existing = await db.documentos.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(404, "Documento não encontrado")
    if user["role"] != "admin" and user.get("estabelecimento_id") != existing.get("estabelecimento_id"):
        raise HTTPException(403, "Sem permissão")
    await db.documentos.delete_one({"id": doc_id})
    return {"ok": True}


# --- Visitas ---
@api.get("/visitas")
async def list_visitas(user: dict = Depends(get_current_user)):
    q = scope_filter(user)
    items = await db.visitas.find(q).to_list(2000)
    estabs = {e["id"]: e async for e in db.estabelecimentos.find({})}
    for x in items:
        _clean(x)
        est = estabs.get(x.get("estabelecimento_id"))
        x["estabelecimento_nome"] = est["nome_fantasia"] if est else "—"
    items.sort(key=lambda d: d.get("data", ""))
    return items


@api.post("/visitas")
async def create_visita(body: VisitaInput, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user.get("estabelecimento_id") != body.estabelecimento_id:
        raise HTTPException(403, "Sem permissão")
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc().isoformat()
    await db.visitas.insert_one(doc)
    return _clean(doc)


@api.put("/visitas/{v_id}")
async def update_visita(v_id: str, body: VisitaInput, user: dict = Depends(get_current_user)):
    existing = await db.visitas.find_one({"id": v_id})
    if not existing:
        raise HTTPException(404, "Não encontrado")
    if user["role"] != "admin" and user.get("estabelecimento_id") != existing.get("estabelecimento_id"):
        raise HTTPException(403, "Sem permissão")
    await db.visitas.update_one({"id": v_id}, {"$set": body.model_dump()})
    v = await db.visitas.find_one({"id": v_id})
    return _clean(v)


@api.delete("/visitas/{v_id}")
async def delete_visita(v_id: str, user: dict = Depends(get_current_user)):
    existing = await db.visitas.find_one({"id": v_id})
    if not existing:
        raise HTTPException(404, "Não encontrado")
    if user["role"] != "admin" and user.get("estabelecimento_id") != existing.get("estabelecimento_id"):
        raise HTTPException(403, "Sem permissão")
    await db.visitas.delete_one({"id": v_id})
    return {"ok": True}


# --- Dashboard ---
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    q = scope_filter(user)
    docs = await db.documentos.find(q).to_list(5000)
    estabs = await db.estabelecimentos.find(q if user["role"] != "admin" else {}).to_list(5000)
    visitas = await db.visitas.find(q).to_list(5000)

    kpi = {"vencidos": 0, "criticos": 0, "atencao": 0, "vigentes": 0}
    alertas = []
    estab_map = {e["id"]: e for e in estabs}
    for d in docs:
        dias = _dias_para_vencer(d.get("validade", ""))
        st = _status_from_dias(dias)
        if st == "vencido":
            kpi["vencidos"] += 1
        elif st == "critico_30d":
            kpi["criticos"] += 1
        elif st == "atencao_90d":
            kpi["atencao"] += 1
        else:
            kpi["vigentes"] += 1
        if st in ("vencido", "critico_30d"):
            est = estab_map.get(d.get("estabelecimento_id"))
            alertas.append({
                "id": d["id"],
                "estabelecimento_id": d.get("estabelecimento_id"),
                "estabelecimento_nome": est["nome_fantasia"] if est else "—",
                "tipo": d.get("tipo"),
                "numero": d.get("numero", ""),
                "validade": d.get("validade"),
                "dias_para_vencer": dias,
                "status": st,
            })
    alertas.sort(key=lambda x: x["dias_para_vencer"])

    # 12 months history
    today = date.today()
    history = []
    for i in range(11, -1, -1):
        # compute year/month
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        first = date(year, month, 1)
        if month == 12:
            last = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last = date(year, month + 1, 1) - timedelta(days=1)
        # count expirations in that month
        vencidos_mes = 0
        renovados_mes = 0
        for d in docs:
            try:
                val = datetime.fromisoformat(d.get("validade", "")).date()
                if first <= val <= last:
                    vencidos_mes += 1
            except Exception:
                pass
            try:
                em = datetime.fromisoformat(d.get("emissao", "")).date()
                if first <= em <= last:
                    renovados_mes += 1
            except Exception:
                pass
        history.append({
            "mes": first.strftime("%b/%y"),
            "ano_mes": first.strftime("%Y-%m"),
            "vencimentos": vencidos_mes,
            "renovacoes": renovados_mes,
        })

    # weekly tasks (things due this week)
    week_end = today + timedelta(days=7)
    checklist = []
    for d in docs:
        try:
            val = datetime.fromisoformat(d.get("validade", "")).date()
        except Exception:
            continue
        if val <= week_end:
            est = estab_map.get(d.get("estabelecimento_id"))
            checklist.append({
                "id": d["id"],
                "titulo": f"{d.get('tipo')} — {est['nome_fantasia'] if est else ''}",
                "validade": d.get("validade"),
                "dias": (val - today).days,
            })
    checklist.sort(key=lambda x: x["dias"])

    return {
        "kpi": kpi,
        "alertas": alertas[:20],
        "history": history,
        "checklist": checklist,
        "totais": {
            "estabelecimentos": len(estabs),
            "documentos": len(docs),
            "visitas": len(visitas),
        }
    }


# --- Seed demo data (admin only) ---
@api.post("/dev/seed")
async def seed_demo(user: dict = Depends(require_admin)):
    # only seeds once
    count = await db.estabelecimentos.count_documents({})
    if count > 0:
        return {"ok": True, "message": "Dados já existem"}

    hoje = date.today()
    demo_estabs = [
        {"nome_fantasia": "Clínica Sorriso", "razao_social": "Clínica Sorriso Ltda", "tipo": "Clínica Odontológica", "cnpj": "98.765.432/0001-10", "cidade": "Curitiba", "uf": "PR", "responsavel_tecnico": "Dra. Ana Souza", "telefone": "(41) 3222-1010", "email": "contato@sorriso.com.br", "grau_risco": "II"},
        {"nome_fantasia": "Hospital Vida Plena", "razao_social": "Hospital Vida Plena S.A.", "tipo": "Hospital", "cnpj": "12.345.678/0001-99", "cidade": "Londrina", "uf": "PR", "responsavel_tecnico": "Dr. Marcos Lima", "telefone": "(43) 3333-2020", "email": "adm@vidaplena.com.br", "grau_risco": "III"},
        {"nome_fantasia": "Laboratório Analisa", "razao_social": "Analisa Diagnósticos Ltda", "tipo": "Laboratório de Análises Clínicas", "cnpj": "22.111.333/0001-44", "cidade": "Maringá", "uf": "PR", "responsavel_tecnico": "Bioq. Paula Reis", "telefone": "(44) 3030-4040", "email": "lab@analisa.com.br", "grau_risco": "II"},
        {"nome_fantasia": "Vet Amigo Fiel", "razao_social": "Amigo Fiel Clínica Veterinária", "tipo": "Clínica Veterinária", "cnpj": "33.222.111/0001-55", "cidade": "Curitiba", "uf": "PR", "responsavel_tecnico": "MV Rafael Torres", "telefone": "(41) 3555-6060", "email": "vet@amigofiel.com.br", "grau_risco": "II"},
    ]
    estab_ids = []
    for e in demo_estabs:
        e["id"] = str(uuid.uuid4())
        e["ativo"] = True
        e["created_at"] = now_utc().isoformat()
        await db.estabelecimentos.insert_one(dict(e))
        estab_ids.append(e["id"])

    tipos = [
        ("Contrato de Coleta e Destinação RSS", "CONTR-RSS"),
        ("Autorização de Funcionamento AFE", "AFE"),
        ("Plano de Gerenciamento RSS (PGRSS)", "PGRSS"),
        ("Alvará Sanitário", "ALV-VS"),
        ("Manifesto de Transporte de Resíduos (MTR)", "MTR"),
        ("Licença Ambiental de Operação", "LAO"),
    ]
    offsets = [-25, -8, 12, 45, 90, 180, 300, -50, 20, 60, 5, 200]
    idx = 0
    for eid in estab_ids:
        for tipo, prefix in tipos:
            offset = offsets[idx % len(offsets)]
            idx += 1
            emissao = hoje - timedelta(days=365 - max(offset, 0))
            validade = hoje + timedelta(days=offset)
            await db.documentos.insert_one({
                "id": str(uuid.uuid4()),
                "estabelecimento_id": eid,
                "tipo": tipo,
                "numero": f"{prefix}-{idx:04d}",
                "emissao": emissao.isoformat(),
                "validade": validade.isoformat(),
                "observacoes": "",
                "created_at": now_utc().isoformat(),
            })

    # visitas
    for i, eid in enumerate(estab_ids):
        await db.visitas.insert_one({
            "id": str(uuid.uuid4()),
            "estabelecimento_id": eid,
            "data": (hoje + timedelta(days=3 + i * 2)).isoformat(),
            "tipo": "Coleta de Resíduos Infectantes",
            "responsavel": "Equipe Radar Sanitário",
            "observacoes": "Coleta programada",
            "status": "agendada",
            "created_at": now_utc().isoformat(),
        })

    return {"ok": True, "estabelecimentos": len(estab_ids)}


# --- Cron: daily 08h sweep (Emergent platform cron) ---
async def _check_cron_auth(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer")
    provided = auth[7:]
    if not _secrets.compare_digest(provided, WEBHOOK_CRON_SECRET or ""):
        raise HTTPException(401, "Invalid cron secret")


async def _run_sweep():
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    docs = await db.documentos.find({}).to_list(10000)
    sent = 0
    for d in docs:
        d = dict(d); d.pop("_id", None)
        sid = await _notify_if_due(d)
        if sid:
            sent += 1
    logger.info(f"[cron] whatsapp-sweep done. sent={sent} scanned={len(docs)}")


@api.post("/cron/whatsapp-sweep")
async def cron_whatsapp_sweep(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    await _check_cron_auth(request)
    background.add_task(_run_sweep)
    return {"ok": True, "queued": True}


# --- Twilio incoming webhook (support Q&A) ---
FAQ_ANSWERS = [
    (("horario", "horário", "atendimento"), "🕒 Nosso suporte funciona de segunda a sexta, das 8h às 18h (horário de Brasília)."),
    (("prazo", "vencimento", "vence"), "📅 Você pode ver todos os prazos no painel do Radar Sanitário em Documentos & Licenças. Renovações ficam ativas por 12 meses."),
    (("pgrss",), "📄 O PGRSS (Plano de Gerenciamento de RSS) precisa de revisão anual. No painel, cadastre com a data da última revisão."),
    (("mtr",), "🚛 O Manifesto de Transporte de Resíduos (MTR) deve ser emitido a cada coleta. Registre no painel para receber lembretes."),
    (("alvara", "alvará", "vigilancia", "vigilância"), "🏥 O Alvará Sanitário costuma valer 12 meses. Cadastre a data no painel e receba alertas em 30/3 dias antes do vencimento."),
    (("preco", "preço", "plano", "valor"), "💚 Temos 3 planos: Essencial R$149/mês, Pro Clínica R$349/mês e Hospitalar (sob consulta). Fale com nosso time!"),
    (("suporte", "humano", "atendente"), "👋 Ok! Um consultor humano falará com você em breve neste mesmo canal."),
    (("ajuda", "help", "menu", "opcoes", "opções"), "📚 Envie: HORÁRIO, PRAZO, PGRSS, MTR, ALVARÁ, PREÇO ou SUPORTE."),
]


def _faq_response(body: str) -> str:
    t = (body or "").casefold().strip()
    if not t:
        return "Olá! 👋 Envie AJUDA para ver os assuntos disponíveis."
    for keywords, resp in FAQ_ANSWERS:
        if any(k in t for k in keywords):
            return resp
    return "Não encontrei uma resposta automática. Digite AJUDA para ver as opções ou SUPORTE para falar com nossa equipe."


@api.post("/twilio/whatsapp/incoming")
async def twilio_incoming(request: Request):
    # Twilio sends application/x-www-form-urlencoded
    form = await request.form()
    params = {str(k): str(v) for k, v in form.items()}

    # Optional signature validation (skipped if creds missing)
    signature = request.headers.get("X-Twilio-Signature", "")
    if TWILIO_AUTH_TOKEN and _twilio_available and PUBLIC_API_URL and signature:
        try:
            validator = RequestValidator(TWILIO_AUTH_TOKEN)
            url = f"{PUBLIC_API_URL}/api/twilio/whatsapp/incoming"
            if not validator.validate(url, params, signature):
                logger.warning("Twilio signature inválida")
                raise HTTPException(403, "invalid signature")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Erro validando assinatura Twilio: {e}")

    from_num = params.get("From", "")
    to_num = params.get("To", "")
    body = params.get("Body", "")
    sid = params.get("MessageSid", "")
    thread_key = from_num  # thread per whatsapp sender

    # persist inbound
    await db.support_messages.insert_one({
        "id": str(uuid.uuid4()),
        "thread_key": thread_key,
        "direction": "in",
        "from": from_num,
        "to": to_num,
        "body": body,
        "twilio_sid": sid,
        "created_at": now_utc().isoformat(),
    })

    reply = _faq_response(body)
    # persist outbound
    await db.support_messages.insert_one({
        "id": str(uuid.uuid4()),
        "thread_key": thread_key,
        "direction": "out",
        "from": to_num,
        "to": from_num,
        "body": reply,
        "twilio_sid": None,
        "created_at": now_utc().isoformat(),
        "auto": True,
    })

    # Respond with TwiML so Twilio replies inline (no second API call needed)
    if _twilio_available:
        twiml = MessagingResponse()
        twiml.message(reply)
        return PlainTextResponse(str(twiml), media_type="application/xml")
    return PlainTextResponse("<Response></Response>", media_type="application/xml")


# --- Support chat endpoints ---
@api.get("/support/threads")
async def list_threads(user: dict = Depends(require_admin)):
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$thread_key",
            "last_message": {"$first": "$body"},
            "last_direction": {"$first": "$direction"},
            "last_at": {"$first": "$created_at"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 200},
    ]
    threads = []
    async for t in db.support_messages.aggregate(pipeline):
        threads.append({
            "thread_key": t["_id"],
            "last_message": t.get("last_message", ""),
            "last_direction": t.get("last_direction", ""),
            "last_at": t.get("last_at"),
            "count": t.get("count", 0),
        })
    return threads


@api.get("/support/threads/{thread_key:path}")
async def get_thread(thread_key: str, user: dict = Depends(require_admin)):
    msgs = await db.support_messages.find({"thread_key": thread_key}).sort("created_at", 1).to_list(500)
    return [_clean(m) for m in msgs]


class ReplyInput(BaseModel):
    thread_key: str
    body: str


class LeadInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    whatsapp: str = Field(min_length=8, max_length=25)
    estabelecimento: Optional[str] = ""
    tipo: Optional[str] = ""
    email: Optional[str] = ""
    mensagem: Optional[str] = ""
    origem: Optional[str] = "landing"


@api.post("/support/reply")
async def support_reply(body: ReplyInput, user: dict = Depends(require_admin)):
    to = body.thread_key.replace("whatsapp:", "")
    sid = await _send_wa(to, body.body)
    await db.support_messages.insert_one({
        "id": str(uuid.uuid4()),
        "thread_key": body.thread_key,
        "direction": "out",
        "from": TWILIO_WHATSAPP_FROM,
        "to": body.thread_key,
        "body": body.body,
        "twilio_sid": sid,
        "created_at": now_utc().isoformat(),
        "manual": True,
        "sent": bool(sid),
    })
    return {"ok": True, "sent": bool(sid), "sid": sid}


# --- Lead Converter (WhatsApp Cloud API + CallMeBot + wa.me) ---
def _normalize_phone(raw: str) -> Optional[str]:
    if not raw:
        return None
    digits = "".join(c for c in raw if c.isdigit() or c == "+")
    if not digits:
        return None
    if not digits.startswith("+"):
        # Assume BR default if user didn't provide country code
        digits = "+55" + digits.lstrip("0")
    if len(digits) < 10:
        return None
    return digits


async def _send_whatsapp_cloud_template(to_e164: str, variables: List[str]) -> Optional[str]:
    """Send welcome via WhatsApp Cloud API (Meta). Returns message id or None."""
    if not _http_available or not WHATSAPP_CLOUD_TOKEN or not WHATSAPP_CLOUD_PHONE_NUMBER_ID:
        return None
    import httpx
    url = f"https://graph.facebook.com/{WHATSAPP_CLOUD_API_VERSION}/{WHATSAPP_CLOUD_PHONE_NUMBER_ID}/messages"
    template = {"name": WHATSAPP_WELCOME_TEMPLATE, "language": {"code": WHATSAPP_TEMPLATE_LANG}}
    if variables:
        template["components"] = [{
            "type": "body",
            "parameters": [{"type": "text", "text": v} for v in variables],
        }]
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_e164.lstrip("+"),
        "type": "template",
        "template": template,
    }
    headers = {"Authorization": f"Bearer {WHATSAPP_CLOUD_TOKEN}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, headers=headers, json=payload)
        if r.is_error:
            logger.warning(f"WhatsApp Cloud API erro {r.status_code}: {r.text[:300]}")
            return None
        data = r.json()
        return (data.get("messages") or [{}])[0].get("id")
    except Exception as e:
        logger.error(f"WhatsApp Cloud API exceção: {e}")
        return None


async def _send_callmebot(text: str) -> bool:
    """Notify admin via CallMeBot (free)."""
    if not _http_available or not CALLMEBOT_ADMIN_PHONE or not CALLMEBOT_APIKEY:
        return False
    import httpx
    phone = CALLMEBOT_ADMIN_PHONE.lstrip("+")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://api.callmebot.com/whatsapp.php",
                params={"phone": phone, "text": text, "apikey": CALLMEBOT_APIKEY},
            )
        return r.status_code == 200
    except Exception as e:
        logger.error(f"CallMeBot exceção: {e}")
        return False


async def _process_lead_async(lead_id: str):
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        return
    # 1) Welcome via WhatsApp Cloud API
    wa_id = await _send_whatsapp_cloud_template(
        lead["whatsapp"],
        variables=[lead.get("name", "")],
    )
    # 2) Notify admin via CallMeBot
    admin_text = (
        f"🚨 Novo lead Radar Sanitário!\n"
        f"Nome: {lead.get('name','')}\n"
        f"WhatsApp: {lead.get('whatsapp','')}\n"
        f"Estabelecimento: {lead.get('estabelecimento','') or '—'}\n"
        f"Tipo: {lead.get('tipo','') or '—'}\n"
        f"Mensagem: {lead.get('mensagem','') or '—'}"
    )
    admin_ok = await _send_callmebot(admin_text)
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {
            "whatsapp_welcome_id": wa_id,
            "whatsapp_welcome_status": "sent" if wa_id else "skipped",
            "admin_notified": admin_ok,
            "processed_at": now_utc().isoformat(),
        }}
    )


@api.post("/leads")
async def create_lead(body: LeadInput, background: BackgroundTasks):
    phone = _normalize_phone(body.whatsapp)
    if not phone:
        raise HTTPException(400, "Número de WhatsApp inválido. Use o formato +55DDNNNNNNNNN.")
    lead_id = str(uuid.uuid4())
    doc = body.model_dump()
    doc.update({
        "id": lead_id,
        "whatsapp": phone,
        "status": "novo",
        "created_at": now_utc().isoformat(),
        "whatsapp_welcome_status": "queued",
        "admin_notified": False,
    })
    await db.leads.insert_one(doc)

    # wa.me link para o próprio visitante iniciar conversa com o admin
    admin_wa = (ADMIN_WHATSAPP_NUMBER or CALLMEBOT_ADMIN_PHONE or "").lstrip("+")
    wa_me_message = (
        f"Olá! Sou {body.name} e quero saber mais sobre o Radar Sanitário. "
        f"Meu estabelecimento: {body.estabelecimento or '—'}."
    )
    from urllib.parse import quote
    wa_me_link = f"https://wa.me/{admin_wa}?text={quote(wa_me_message)}" if admin_wa else None

    background.add_task(_process_lead_async, lead_id)

    return {
        "ok": True,
        "id": lead_id,
        "wa_me_link": wa_me_link,
        "message": "Recebemos seu contato! Você receberá uma mensagem no WhatsApp em instantes.",
    }


@api.get("/leads")
async def list_leads(user: dict = Depends(require_admin)):
    items = await db.leads.find({}).sort("created_at", -1).to_list(1000)
    return [_clean(x) for x in items]


@api.patch("/leads/{lead_id}")
async def update_lead_status(lead_id: str, body: dict, user: dict = Depends(require_admin)):
    allowed = {"novo", "em_contato", "convertido", "perdido"}
    status = body.get("status")
    if status not in allowed:
        raise HTTPException(400, "status inválido")
    await db.leads.update_one({"id": lead_id}, {"$set": {"status": status, "updated_at": now_utc().isoformat()}})
    doc = await db.leads.find_one({"id": lead_id})
    return _clean(doc)


@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(require_admin)):
    await db.leads.delete_one({"id": lead_id})
    return {"ok": True}


@api.get("/")
async def root():
    return {"app": "Radar Sanitário", "status": "ok", "time": now_utc().isoformat()}


app.include_router(api)

# CORS - allow credentials with specific origins
origins_env = os.environ.get("CORS_ORIGINS", "*")
if origins_env == "*":
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins_env.split(","),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.on_event("shutdown")
async def shutdown():
    client.close()
