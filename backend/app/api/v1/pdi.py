from ._crud import make_crud_router


router = make_crud_router(prefix="/api/pdi", tag="pdi", storage_key="espen_pdi")
