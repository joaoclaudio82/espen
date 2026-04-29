from ._crud import make_crud_router


router = make_crud_router(prefix="/api/trilhas", tag="trilhas", storage_key="espen_trilhas")
