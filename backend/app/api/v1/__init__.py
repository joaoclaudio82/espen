from fastapi import APIRouter

from . import acoes, auth, matriz, pdi, storage, trilhas, users


api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(storage.router)
api_router.include_router(matriz.router)
api_router.include_router(acoes.router)
api_router.include_router(trilhas.router)
api_router.include_router(pdi.router)
