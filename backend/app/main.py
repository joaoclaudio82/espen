from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import api_router
from .core.config import settings
from .core.middleware_https import ForceHTTPSMiddleware
from .db.session import Base, SessionLocal, engine
from .services.seed import ensure_admin_user, upgrade_default_admin_password_wire


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Cria tabelas que ainda não existem; migrations versionadas via Alembic.
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_admin_user(db)
        upgrade_default_admin_password_wire(db)
    yield


app = FastAPI(title="ESPEN API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Registrado por último = executa primeiro (redireciona antes do restante).
app.add_middleware(ForceHTTPSMiddleware)

app.include_router(api_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
