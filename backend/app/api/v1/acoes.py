from ._crud import make_crud_router


router = make_crud_router(prefix="/api/acoes", tag="acoes", storage_key="espen_acoes")
