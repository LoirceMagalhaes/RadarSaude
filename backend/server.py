from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# --- Setup ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

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
async def create_doc(body: DocumentoInput, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user.get("estabelecimento_id") != body.estabelecimento_id:
        raise HTTPException(403, "Sem permissão")
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_utc().isoformat()
    await db.documentos.insert_one(doc)
    _clean(doc)
    return doc


@api.put("/documentos/{doc_id}")
async def update_doc(doc_id: str, body: DocumentoInput, user: dict = Depends(get_current_user)):
    existing = await db.documentos.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(404, "Documento não encontrado")
    if user["role"] != "admin" and user.get("estabelecimento_id") != existing.get("estabelecimento_id"):
        raise HTTPException(403, "Sem permissão")
    await db.documentos.update_one({"id": doc_id}, {"$set": body.model_dump()})
    doc = await db.documentos.find_one({"id": doc_id})
    return _clean(doc)


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
