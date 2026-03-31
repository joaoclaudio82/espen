from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://espen:espen@127.0.0.1:5433/espen"
    jwt_secret_key: str = "troque-esta-chave-em-producao"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720

    admin_cpf: str = "727.927.369-68"
    admin_nome: str = "Administrador ESPEN"
    admin_email: str = "admin@espen.gov.br"
    admin_cargo: str = "Administrador"
    admin_password: str = "admin123"

    cors_origins: str = "http://127.0.0.1:5500,http://localhost:5500"

    @property
    def cors_origins_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url.strip()

        # Railway normalmente injeta URLs como postgres:// ou postgresql://.
        # Aqui forçamos o dialeto do SQLAlchemy para usar psycopg (v3),
        # que já está em requirements.txt.
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url


settings = Settings()
