# Instruções de Primeira Execução

Este guia mostra como rodar o sistema do zero pela primeira vez no Windows (PowerShell).

## 1) Pré-requisitos

Verifique se você já tem instalado:

- Python 3.12+
- Node.js + npm
- Docker Desktop

Comandos para checar:

```powershell
python --version
node --version
npm --version
docker --version
```

## 2) Abrir o projeto

```powershell
cd f:\sispen
```

## 3) Subir o PostgreSQL

Este projeto usa Docker Compose e expõe o banco na porta `5433`.

```powershell
docker compose up -d postgres
```

Se quiser conferir:

```powershell
docker compose ps
```

## 4) Configurar backend (FastAPI)

Entre na pasta `backend` e crie um ambiente virtual Python:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Instale as dependências:

```powershell
pip install -r requirements.txt
```

Crie o arquivo de ambiente local:

```powershell
copy .env.example .env
```

## 5) Rodar a API

Ainda dentro de `backend`:

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

API disponível em:

- `http://127.0.0.1:8001`
- Healthcheck: `http://127.0.0.1:8001/api/health`

Deixe esse terminal aberto.

## 6) Rodar o frontend

Abra um **novo terminal** (sem fechar o backend), volte para a raiz e rode:

```powershell
cd f:\sispen
npm install
npm run start
```

Frontend disponível em:

- `http://127.0.0.1:5500`

## 7) Primeiro login

Usuário administrador inicial (seed do backend):

- CPF: `727.927.369-68`
- Senha: `admin123`

## 8) Fluxo esperado

Com backend + frontend ativos:

1. Abrir `http://127.0.0.1:5500`
2. Fazer login com admin
3. Criar/editar registros (matriz, ações, trilhas, plano de ensino, usuários)
4. Os dados passam a ser persistidos no PostgreSQL

## 9) Parar os serviços

Parar frontend/backend: `Ctrl + C` em cada terminal.

Parar o banco:

```powershell
cd f:\sispen
docker compose down
```

## 10) Solução rápida de problemas

### Porta 8001 em uso

Troque a porta da API no comando do `uvicorn` e ajuste `API_BASE` em `index.html` se necessário.

### Porta 5500 em uso

Altere o script `start` no `package.json` para outra porta.

### Erro de conexão com banco

Confirme:

- Container do Postgres está `Up` (`docker compose ps`)
- `DATABASE_URL` no `.env` aponta para `127.0.0.1:5433`

### Dependências Python não encontradas

Verifique se o ambiente virtual está ativo:

```powershell
.\.venv\Scripts\Activate.ps1
```
