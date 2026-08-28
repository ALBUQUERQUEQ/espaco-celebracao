# Sistema de Telas

Aplicacao corporativa para solicitar, aprovar e publicar conteudo em tres monitores.

## Estrutura

- `frontend/`: interface web e paginas dos monitores.
- `backend/`: API TypeScript, entidades TypeORM e migrations.
- `local-launcher/`: agente local Node.js que abre as tres telas nos monitores.
- `render.yaml`: configuracao de deploy da API no Render.
- `DEPLOY.md`: configuracao de Supabase, Render, GitHub Pages e Entra ID.

## Frontend

- `frontend/index.html`: tela principal, solicitacoes e gerenciamento.
- `frontend/esquerda.html`: monitor esquerdo.
- `frontend/centro.html`: monitor central.
- `frontend/direita.html`: monitor direito.
- `frontend/api-config.js`: URL publica da API.
- `frontend/auth-config.js`: configuracao do Microsoft Entra ID.
- `frontend/auth.js`: login OIDC com PKCE e envio do JWT.

## Backend

- `backend/src/server.ts`: rotas HTTP e regras de autorizacao.
- `backend/src/entities/`: entidades `Usuario`, `Solicitacao`, `Gatilho` e `Auditoria`.
- `backend/src/migrations/`: schema versionado do PostgreSQL.
- `backend/src/data-source.ts`: conexao TypeORM.

Comandos do backend:

```text
cd backend
npm install
npm run build
npm run migration:run
npm start
```

Comandos do agente local:

```text
cd local-launcher
npm install
npm start
```

Nao coloque chaves, tokens ou arquivos `.env` no repositorio.
