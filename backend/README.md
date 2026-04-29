# Backend FastAPI + PostgreSQL

## Estrutura

```
backend/
├── app/
│   ├── core/         # config, security (PBKDF2 + JWT), CPF, middleware HTTPS
│   ├── db/           # session SQLAlchemy
│   ├── models/       # User, Storage (JSONB), Relations
│   ├── schemas/      # Pydantic — split por agregado
│   ├── repositories/ # Acesso a dados
│   ├── services/     # Regra de negócio (users, seed)
│   ├── api/v1/       # Routers HTTP finos
│   └── main.py
├── alembic/          # Migrations versionadas
├── tests/            # pytest
├── pyproject.toml    # Deps + ruff + pytest config
└── requirements.txt  # Compat
```

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .\.venv\Scripts\Activate.ps1
pip install -e .[dev]
cp .env.example .env

# Sobe Postgres na porta 5433:
docker compose -f ../docker-compose.yml up -d postgres

# Aplica migrations:
alembic upgrade head

# Sobe API:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## Railway / proxy reverso

Para `X-Forwarded-Proto`/`X-Forwarded-Host` funcionarem (redirecionamento HTTP→HTTPS e HSTS):

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
```

Com `RAILWAY_ENVIRONMENT` definido ou `FORCE_HTTPS=true`, o middleware é ativado.

## Migrations

```bash
# Cria nova revisão a partir do diff dos modelos:
alembic revision --autogenerate -m "descricao da mudanca"

# Aplica:
alembic upgrade head

# Reverte uma revisão:
alembic downgrade -1
```

## Testes

```bash
pytest
```

Suite mínima cobre validação de CPF e ciclo PBKDF2/JWT.

## Endpoints principais

| Método | Rota | Auth | Função |
|---|---|---|---|
| POST | `/api/auth/login` | público | Login com CPF + senha (SHA-256 hex) → JWT |
| POST | `/api/auth/register` | público | Cadastro inativo aguardando aprovação |
| GET  | `/api/auth/me` | usuário | Dados do usuário logado |
| GET  | `/api/users` | admin | Lista todos os usuários |
| GET  | `/api/users/directory` | usuário | Diretório mínimo (id/nome/cargo/acesso) |
| POST | `/api/users` | admin | Cria usuário ativo |
| PUT  | `/api/users/{id}` | admin | Atualiza usuário |
| PATCH| `/api/users/{id}/toggle` | admin | Ativa/desativa |
| POST | `/api/users/change-password` | usuário | Troca a própria senha |
| GET  | `/api/storage/{key}` | usuário | Lista itens (filtra moderação por solicitante) |
| PUT  | `/api/storage/{key}` | admin (gestor em dashboard/moderacao) | Substitui coleção |
| DELETE | `/api/storage/{key}` | admin | Limpa coleção |
| POST | `/api/storage/espen_moderacao/append` | qualquer | Enfileira solicitação atomicamente |
| GET/POST/PUT/DELETE | `/api/{matriz,acoes,trilhas,pdi}` | admin (writes), usuário (reads) | CRUD por agregado |

Chaves válidas para `/api/storage/{key}`:
`espen_matriz`, `espen_acoes`, `espen_trilhas`, `espen_pdi`, `espen_dashboard`,
`espen_moderacao`, `espen_moderacao_historico`.
