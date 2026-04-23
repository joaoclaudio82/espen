# Backend FastAPI + PostgreSQL

## 1) Subir PostgreSQL

```bash
docker compose up -d postgres
```

## 2) Configurar ambiente Python

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

## 3) Aplicar migração inicial (opcional)

```bash
python -m scripts.run_sql_migration
```

## 4) Rodar API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Railway / proxy reverso

Para `X-Forwarded-Proto` / `X-Forwarded-Host` funcionarem (redirecionamento HTTP→HTTPS e HSTS na API), suba o Uvicorn com:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
```

Com `RAILWAY_ENVIRONMENT` definido (padrão no Railway) ou `FORCE_HTTPS=true`, o middleware de HTTPS é ativado. Veja `.env.example`.

Obs.: o `docker-compose.yml` deste projeto publica o PostgreSQL na porta `5433`.

## Endpoints principais

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `GET /api/users` (admin)
- `POST /api/users` (admin)
- `PUT /api/users/{id}` (admin)
- `PATCH /api/users/{id}/toggle` (admin)
- `POST /api/users/change-password`
- `GET /api/storage/{key}` (`espen_matriz`, `espen_acoes`, `espen_trilhas`, `espen_pdi`)
- `PUT /api/storage/{key}` (admin)
- `DELETE /api/storage/{key}` (admin)
