# Instruções de Primeira Execução (Windows)

Guia para rodar o sistema do zero. Para Linux/macOS troque `Activate.ps1` por `source .venv/bin/activate`.

## 1) Pré-requisitos

```powershell
python --version       # >= 3.12
node --version         # >= 20
npm --version
docker --version
```

## 2) Clonar/abrir o projeto

```powershell
cd f:\sispen
```

## 3) Subir o PostgreSQL

```powershell
docker compose up -d postgres
docker compose ps
```

O Postgres expõe `localhost:5433` (DB `espen`, user `espen`, senha `espen`).

## 4) Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Instalação (escolha um):
pip install -e .[dev]
# ou
pip install -r requirements.txt

copy .env.example .env

# Cria/atualiza schema:
alembic upgrade head

# Sobe a API:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

API disponível em:
- `http://127.0.0.1:8001`
- `http://127.0.0.1:8001/api/health`

Mantenha o terminal aberto.

## 5) Frontend (Vite)

Em **outro terminal**, na raiz do projeto:

```powershell
cd f:\sispen\frontend
npm install
npm run dev
```

SPA em `http://127.0.0.1:5173`.

## 6) Primeiro login

Admin padrão (criado pelo seed na primeira subida da API):

- CPF: `727.927.369-68`
- Senha: `admin123`

## 7) Fluxo esperado

1. Abrir `http://127.0.0.1:5173`
2. Login com admin
3. **Importar a matriz** via tela "Matriz de Competências" → botão de importação XLSX
4. **Importar ações educativas** via tela "Ações Educativas" → botão de importação XLSX
5. Criar trilhas, planos de ensino, novos usuários — tudo persiste em PostgreSQL via API

## 8) Build de produção do frontend

```powershell
cd f:\sispen\frontend
npm run build
```

Artefatos em `frontend/dist/`. Sirva por nginx/Caddy ou hospede estático (Railway, Vercel, S3).

## 9) Parar serviços

- Frontend / Backend: `Ctrl + C` em cada terminal
- Banco: `docker compose down`

## 10) Rodando os testes do backend

```powershell
cd f:\sispen\backend
.\.venv\Scripts\Activate.ps1
pytest
```

## 11) Solução de problemas

### Porta 8001 em uso
Mude `--port` no `uvicorn` e ajuste `CORS_ORIGINS` (ou aponte `window.ESPEN_API_BASE` no frontend).

### Porta 5173 em uso
Edite `frontend/vite.config.js` ou rode `npm run dev -- --port 5174`.

### Erro de conexão com banco
- `docker compose ps` deve mostrar `postgres` Up
- `DATABASE_URL` no `.env` aponta para `127.0.0.1:5433`

### "alembic: command not found"
Ambiente virtual não está ativo (`.\.venv\Scripts\Activate.ps1`).

### `npm run dev` falha por dependências
Apague `frontend/node_modules` e `frontend/package-lock.json`, rode `npm install` de novo.
