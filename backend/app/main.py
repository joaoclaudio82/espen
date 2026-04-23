from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine
from .middleware_https import ForceHTTPSMiddleware
from .routers import acoes, auth, matriz, pdi, storage, trilhas, users
from .seed import ensure_admin_user, upgrade_default_admin_password_wire


@asynccontextmanager
async def lifespan(_: FastAPI):
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
# Registrado por último = executa primeiro na requisição (redireciona antes do restante).
app.add_middleware(ForceHTTPSMiddleware)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(storage.router)
app.include_router(matriz.router)
app.include_router(acoes.router)
app.include_router(trilhas.router)
app.include_router(pdi.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
