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


settings = Settings()
