from ._crud import make_crud_router


router = make_crud_router(prefix="/api/matriz", tag="matriz", storage_key="espen_matriz")
