# ESPEN — Sistema de Gestão por Competências

SPA Vanilla JS + FastAPI + PostgreSQL para a Escola Nacional de Serviços Penais (ESPEN/SENAPPEN).

## Estrutura

```
espen/
├── backend/                    # FastAPI 0.116 + SQLAlchemy 2 + psycopg3
│   ├── app/
│   │   ├── core/              # config, security (PBKDF2 + JWT), CPF, middleware HTTPS
│   │   ├── db/                # session SQLAlchemy
│   │   ├── models/            # User, Storage (JSONB blobs), Relations
│   │   ├── schemas/           # Pydantic — split por agregado
│   │   ├── repositories/      # Acesso a dados
│   │   ├── services/          # Regra de negócio (users, seed)
│   │   ├── api/v1/            # Routers HTTP finos (auth, users, storage, matriz, ...)
│   │   └── main.py            # App FastAPI + lifespan
│   ├── alembic/               # Migrations versionadas
│   ├── tests/                 # pytest (cpf + security)
│   ├── pyproject.toml         # Deps + ruff + pytest config
│   └── requirements.txt       # Compat para `pip install -r`
├── frontend/                   # SPA Vanilla JS bundled com Vite
│   ├── src/
│   │   ├── api/               # client HTTP (fetch async) + cache de storage
│   │   ├── auth/              # crypto (SHA-256), CPF, sessão (login/registro)
│   │   ├── shared/            # toast, escape, formatadores
│   │   ├── styles/main.css    # CSS extraído do monólito (~890 linhas, idêntico)
│   │   ├── legacy.js          # Renderers + lógica de páginas (transição em andamento)
│   │   └── main.js            # Entry point
│   ├── public/                # Logos, imagens
│   ├── index.html             # Shell HTML enxuto
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml          # PostgreSQL 16 (porta 5433)
└── templates/                  # XLSX MCN 2026 + Modelo de Plano de Ensino DOCX
```

## Pré-requisitos

- Python 3.12+
- Node.js 20+ (npm)
- Docker (apenas para o PostgreSQL)

## Rodando localmente

### 1. Banco de dados

```bash
docker compose up -d postgres
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # no Windows: .\.venv\Scripts\Activate.ps1
pip install -e .[dev]              # ou: pip install -r requirements.txt
cp .env.example .env

# Aplica as migrations:
alembic upgrade head

# Sobe a API:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

API disponível em `http://127.0.0.1:8001` — `/api/health`, `/api/auth/login`, etc.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

SPA em `http://127.0.0.1:5173`.

### Login padrão

- CPF: `727.927.369-68`
- Senha: `admin123`

O usuário admin é criado automaticamente no primeiro start da API (vide [`backend/app/services/seed.py`](backend/app/services/seed.py)).

## Build de produção

```bash
cd frontend
npm run build              # gera frontend/dist/
```

Sirva o `dist/` por trás de qualquer servidor estático (nginx, Caddy, S3+CloudFront, etc.). A API
respeita `X-Forwarded-Proto` para emitir HSTS — basta `FORCE_HTTPS=true` ou rodar em ambiente com
`RAILWAY_ENVIRONMENT` definido.

## Testes

Backend:

```bash
cd backend
pytest
```

## Funcionalidades

- **Auth:** login JWT (PBKDF2 + SHA-256 hex), registro com aprovação, troca de senha, perfis Admin/Gestor/Usuário
- **Matriz de Competências:** CRUD, paginação, filtros por categoria/cargo/eixo/complexidade/ano, exportação CSV/DOCX
- **Ações Educativas:** formulário com 27 campos em 4 seções, cards/lista, exportação DOCX
- **Trilhas de Aprendizagem:** vinculação a ações, carga horária automática
- **Planos de Ensino:** wizard multi-etapas, geração DOCX a partir de template
- **Moderação:** fila de aprovações para gestores; histórico de decisões
- **Importação XLSX:** upload da matriz e ações via planilha
- **Dashboard:** KPIs + 5 gráficos Chart.js (eixo, complexidade, categoria, cargo, top unidades)

## Refator em andamento

`frontend/src/legacy.js` ainda concentra ~5400 linhas (renderers das páginas). Próxima fase
quebra em `src/pages/*.js` e elimina os `onclick="…"` inline em favor de `addEventListener`.
