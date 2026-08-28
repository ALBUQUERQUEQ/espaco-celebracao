# Documentacao do Sistema de Telas

Este documento descreve o projeto para que outra pessoa ou uma IA possa entender a arquitetura antes de fazer alteracoes.

## 1. Objetivo do sistema

A aplicacao permite solicitar conteudo para publicacao em tres monitores:

- Monitor esquerdo.
- Monitor central.
- Monitor direito.

O usuario acessa uma interface web, cria uma solicitacao, envia imagens ou videos, acompanha o status e, conforme sua permissao, aprova ou reprova a solicitacao. Os arquivos das telas ficam em armazenamento cloud. Um agente instalado no computador dos monitores abre as tres paginas da nuvem em janelas locais separadas.

A arquitetura planejada e hibrida:

- Frontend: paginas HTML, CSS e JavaScript puro, publicadas no GitHub Pages ou outro host estatico.
- Backend: Node.js + TypeScript + Express, publicado no Render.
- Banco: PostgreSQL do Supabase, acessado pelo TypeORM.
- Arquivos: Supabase Storage.
- Identidade: Microsoft Entra ID usando OAuth 2.0 + OpenID Connect.
- Monitores: agente Node.js local.

## 2. Estrutura atual

```text
/
|-- frontend/
|   |-- index.html
|   |-- esquerda.html
|   |-- centro.html
|   |-- direita.html
|   |-- api-config.js
|   |-- auth-config.js
|   |-- auth.js
|
|-- backend/
|   |-- package.json
|   |-- tsconfig.json
|   |-- .env.example
|   |-- src/
|       |-- server.ts
|       |-- data-source.ts
|       |-- entities/
|       |   |-- Usuario.ts
|       |   |-- Solicitacao.ts
|       |   |-- Gatilho.ts
|       |   |-- Auditoria.ts
|       |-- migrations/
|           |-- 1710000000000-CreateTables.ts
|           |-- 1710000001000-AddCorporateAuth.ts
|
|-- local-launcher/
|   |-- index.js
|   |-- package.json
|
|-- render.yaml
|-- DEPLOY.md
|-- README.md
|-- .gitignore
```

Arquivos antigos em PowerShell, paginas antigas e dados JSON locais foram removidos da arquitetura oficial. O frontend e o backend devem ser tratados como projetos separados.

## 3. Frontend

### `frontend/index.html`

E a tela principal do sistema. Contem a estrutura visual, menu lateral e as telas internas:

- **Iniciar telas**: chama o agente local em `http://127.0.0.1:8899/start`.
- **Solicitar espaco de conteudo**: formulario para titulo, tipo de servico, inicio, fim, anexos e observacoes.
- **Gerenciamento**: lista solicitacoes e exibe botoes para aprovar/reprovar.

A navegacao e feita trocando o HTML da area principal, sem trocar de site.

O formulario envia `multipart/form-data` para `POST /solicitacoes`.

O gerenciamento usa:

- `GET /solicitacoes`.
- `PATCH /solicitacoes/:id`.
- Links `GET /anexos/:caminho`.

O menu lateral se fecha depois que uma opcao e escolhida.

### `frontend/esquerda.html`

Pagina operacional do monitor esquerdo. Ela:

- Consulta os gatilhos na API.
- Consulta o estado atual.
- Consulta a lista da pasta `fundo-esquerda`.
- Exibe imagens em slideshow.
- Reproduz videos de fundo.
- Exibe conteudo de gatilho recebido para o lado esquerdo.
- Reage a atalhos de teclado.

### `frontend/centro.html`

Tem a mesma responsabilidade de `esquerda.html`, mas usa:

```javascript
const LADO = "centro";
const PASTA_FUNDO = "fundo-centro";
```

### `frontend/direita.html`

Tem a mesma responsabilidade de `esquerda.html`, mas usa:

```javascript
const LADO = "direita";
const PASTA_FUNDO = "fundo-direita";
```

Ao alterar o comportamento comum das tres telas, as tres paginas devem ser atualizadas. Nao alterar somente uma sem verificar as outras.

### `frontend/api-config.js`

Define a URL publica do backend:

```javascript
window.API_BASE_URL = 'https://seu-backend.onrender.com';
```

Antes da publicacao, substituir o placeholder pela URL real do Render. Este arquivo nao deve conter segredo.

### `frontend/auth-config.js`

Define os dados publicos do aplicativo SPA registrado no Microsoft Entra ID:

- `clientId`: ID publico do frontend.
- `authority`: tenant do Entra ID.
- `apiScope`: escopo publico solicitado para acessar a API.

Nunca colocar client secret, certificado privado, service role key ou qualquer segredo aqui.

### `frontend/auth.js`

Implementa o cliente de autenticacao usando `@azure/msal-browser` carregado por ESM:

- Authorization Code Flow com PKCE.
- Login por `loginRedirect`.
- Renovacao silenciosa do token.
- Redirecionamento para login quando nao existe conta.
- Logout por `logoutRedirect`.
- Interceptacao de `window.fetch`.
- Inclusao automatica de `Authorization: Bearer <access_token>` nas chamadas para `API_BASE_URL`.
- Funcao `getAuthenticatedUser()` para consultar `/me`.

O sistema nao cria senha, nao armazena senha e nao implementa login proprio.

## 4. Backend

### `backend/src/server.ts`

E o ponto principal da API Express. Responsabilidades:

- Inicializar Express.
- Configurar CORS.
- Configurar Helmet.
- Configurar rate limiting.
- Validar JWT recebido do Entra ID.
- Criar ou atualizar o usuario local no primeiro acesso.
- Aplicar permissoes por perfil.
- Manipular uploads.
- Usar repositories do TypeORM.
- Usar Supabase Storage para imagens e videos.
- Registrar auditoria.

### Middleware `requireJwt`

O middleware exige:

```http
Authorization: Bearer <JWT>
```

Ele valida:

- Assinatura por JWKS.
- `issuer`.
- `audience`.
- Expiracao do token.
- Identidade corporativa por `oid` ou `sub`.
- Email por `preferred_username` ou `email`.

Depois do JWT valido, o usuario e criado ou atualizado pelo identificador corporativo. O perfil inicial e `SOLICITANTE`.

Se o token possuir as app roles configuradas, o perfil pode ser:

- Role presente em `OIDC_ADMIN_ROLES` -> `ADMIN`.
- Role presente em `OIDC_APPROVER_ROLES` -> `APROVADOR`.
- Caso contrario -> `SOLICITANTE`.

Usuario com `ativo = false` recebe `403`.

### Middleware `requireRole`

Restringe endpoints por perfil. Exemplo:

```typescript
requireRole('APROVADOR', 'ADMIN')
```

Solicitantes nao podem aprovar ou reprovar solicitacoes.

### Rotas da API

| Metodo | Rota | Protecao | Funcao |
|---|---|---|---|
| GET | `/health` | Publica | Verifica disponibilidade da API. |
| GET | `/me` | JWT | Retorna o usuario logado. |
| GET | `/config` | JWT | Retorna configuracoes das telas. |
| GET | `/estado` | JWT | Retorna o estado atual de exibicao. |
| GET | `/gatilhos` | JWT | Lista gatilhos. |
| GET | `/lista?pasta=...` | JWT | Lista arquivos de uma pasta de conteudo. |
| GET | `/conteudo/...` | JWT | Gera URL assinada para conteudo. |
| GET | `/disparar?id=...` | JWT | Dispara um gatilho. |
| GET | `/cancelar` | JWT | Cancela o conteudo ativo. |
| GET | `/solicitacoes` | JWT | Lista solicitacoes; solicitante ve as proprias. |
| POST | `/solicitacoes` | JWT | Cria solicitacao e envia anexos. |
| PATCH | `/solicitacoes/:id` | APROVADOR ou ADMIN | Aprova/reprova solicitacao. |
| GET | `/anexos/...` | JWT | Gera URL assinada para anexo privado. |
| GET | `/usuarios` | ADMIN | Lista usuarios. |
| PATCH | `/usuarios/:id` | ADMIN | Altera perfil ou ativa/desativa usuario. |

### `backend/src/data-source.ts`

Configura o TypeORM:

- Driver PostgreSQL.
- URL em `DATABASE_URL`.
- SSL em producao.
- `synchronize: false`.
- Entidades carregadas explicitamente.
- Migrations compiladas em `dist/migrations/*.js`.

Nao usar `synchronize: true` em producao. Alteracoes de banco devem ser feitas por migration.

## 5. Entidades TypeORM

### `Usuario.ts`

Tabela `usuarios`:

- `id`: UUID.
- `nome`: nome vindo do token corporativo.
- `email`: email corporativo unico.
- `oid`: identificador unico do Entra ID.
- `perfil`: `SOLICITANTE`, `APROVADOR` ou `ADMIN`.
- `ativo`: bloqueia acesso quando falso.
- `createdAt`.
- `updatedAt`.

### `Solicitacao.ts`

Tabela `solicitacoes`:

- `id`: UUID.
- `usuarioId`: quem criou.
- `titulo`.
- `tipoServico` -> coluna `tipo_servico`.
- `inicio`.
- `fim`.
- `detalhes`.
- `aprovacao`: `pendente`, `aprovado` ou `reprovado`.
- `aprovadoPor`: usuario que decidiu.
- `dataAprovacao`.
- `arquivos`: JSON com caminhos no Storage.
- `criadaEm` -> coluna `created_at`.

### `Gatilho.ts`

Tabela `gatilhos` usada pelas telas operacionais:

- `id`.
- `nome`.
- `tipo`.
- `tecla`.
- `horario`.
- `duracaoMinutos`.
- `esquerda`.
- `centro`.
- `direita`.

### `Auditoria.ts`

Tabela `auditorias`:

- `id`.
- `usuarioId`.
- `acao`.
- `entidadeId`.
- `detalhes`.
- `createdAt`.

Acoes atuais registradas:

- `SOLICITACAO_CRIADA`.
- `SOLICITACAO_APROVADA`.
- `SOLICITACAO_REPROVADA`.
- `USUARIO_ATUALIZADO`.

## 6. Migrations

### `1710000000000-CreateTables.ts`

Migration inicial para as tabelas de solicitacoes e gatilhos.

### `1710000001000-AddCorporateAuth.ts`

Migration para:

- Criar `usuarios`.
- Criar `auditorias`.
- Adicionar `usuario_id` em solicitacoes.
- Adicionar `aprovado_por` em solicitacoes.
- Adicionar `data_aprovacao` em solicitacoes.

Toda alteracao de tabela deve gerar uma nova migration. Nunca apagar uma migration ja executada em producao.

## 7. Armazenamento de arquivos

Existem dois buckets privados planejados no Supabase Storage:

- `anexos`: arquivos enviados em solicitacoes.
- `conteudo`: imagens e videos usados pelas telas.

Os caminhos dos anexos sao gravados no campo JSON `solicitacoes.arquivos`.

O backend nao deve tornar os buckets publicos. Para abrir um arquivo, deve gerar URL assinada com validade limitada.

Arquivos permitidos:

- PNG.
- JPEG.
- GIF.
- WebP.
- MP4.
- WebM.

O upload possui limite de 200 MB por arquivo no backend atual. Para arquivos maiores, usar upload resumable ou upload direto para o Storage com URL assinada.

## 8. Autenticacao Microsoft Entra ID

### Aplicacoes necessarias

Recomenda-se registrar dois aplicativos:

1. Aplicativo SPA para o frontend.
2. Aplicativo de API para o backend.

Na API:

- Expor o escopo `access_as_user`.
- Criar app role `Totem.Admin`.
- Criar app role `Totem.Approver`.
- Atribuir usuarios ou grupos corporativos a essas roles.

No SPA:

- Adicionar os redirect URIs HTTPS das paginas publicadas.
- Configurar o escopo da API.
- Nao usar client secret.

### Variaveis de ambiente do backend

```text
PORT=3000
DATABASE_URL=postgresql://...
FRONTEND_ORIGIN=https://empresa.github.io/repositorio
OIDC_ISSUER=https://login.microsoftonline.com/TENANT_ID/v2.0
OIDC_AUDIENCE=CLIENT_ID_DA_API
OIDC_JWKS_URL=https://login.microsoftonline.com/TENANT_ID/discovery/v2.0/keys
OIDC_ADMIN_ROLES=Totem.Admin
OIDC_APPROVER_ROLES=Totem.Approver
SUPABASE_URL=https://projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_BUCKET=anexos
SUPABASE_CONTENT_BUCKET=conteudo
```

`SUPABASE_SERVICE_ROLE_KEY` deve existir somente no backend/Render. Nunca publicar no GitHub, frontend ou logs.

## 9. Agente local dos monitores

### `local-launcher/index.js`

Agente Node.js executado no computador ligado aos tres monitores.

Endpoint:

```text
POST http://127.0.0.1:8899/start
```

Funcao:

1. Receber o comando do frontend cloud.
2. Abrir o navegador configurado.
3. Abrir as URLs cloud de esquerda, centro e direita.
4. Posicionar cada janela conforme `TOTEM_MONITORS`.

Variaveis:

```text
TOTEM_SITE_URL=https://usuario.github.io/repositorio
TOTEM_BROWSER=msedge.exe
TOTEM_MONITORS=0,0;1920,0;3840,0
```

O agente e local por necessidade: um servidor cloud nao consegue abrir janelas fisicas no computador dos monitores.

## 10. Deploy

### Backend no Render

1. Enviar o projeto para GitHub.
2. Criar um Web Service usando `backend` como root directory.
3. Build: `npm install` ou `npm ci`.
4. Build TypeScript: `npm run build`.
5. Migration: `npm run migration:run`.
6. Start: `npm start`.
7. Configurar as variaveis secretas no painel do Render.

### Frontend no GitHub Pages

1. Definir a URL do Render em `frontend/api-config.js`.
2. Definir client ID e authority em `frontend/auth-config.js`.
3. Publicar a pasta `frontend`.
4. Configurar os redirect URIs no Entra ID.
5. Usar HTTPS.

### Banco Supabase

1. Criar projeto PostgreSQL.
2. Criar buckets privados `anexos` e `conteudo`.
3. Configurar `DATABASE_URL`.
4. Rodar as migrations TypeORM.
5. Configurar politicas de Storage conforme o modelo de acesso do backend.

## 11. Comandos

Backend:

```text
cd backend
npm install
npm run build
npm run migration:run
npm start
```

Desenvolvimento do backend:

```text
cd backend
npm run dev
```

Agente local:

```text
cd local-launcher
npm install
npm start
```

## 12. Regras para futuras alteracoes

1. Nao criar autenticacao propria com senha.
2. Nao armazenar tokens ou secrets no frontend.
3. Toda rota nova deve declarar sua protecao JWT e permissao.
4. Toda mudanca de banco deve ser uma migration TypeORM.
5. Toda acao administrativa ou de aprovacao deve gerar auditoria.
6. Solicitantes nunca podem consultar ou alterar solicitacoes de outros usuarios.
7. Aprovadores nao devem receber permissoes de ADMIN sem necessidade.
8. Nao tornar buckets de arquivos publicos.
9. Validar tipo, tamanho e nome de todo upload.
10. Nao usar `synchronize: true` em producao.
11. Nao remover arquivos referenciados pelas tres telas sem atualizar a configuracao.
12. Testar frontend e backend depois de cada alteracao.
13. Manter `API_BASE_URL` e configuracoes OIDC separados de secrets.
14. Usar mensagens de erro genericas para nao expor detalhes internos.
15. Nao registrar JWT, senha, chave de API ou conteudo sensivel nos logs.

## 13. Estado atual e pontos pendentes

A estrutura TypeScript e as entidades ja existem, e o backend compila. Para funcionamento real em producao ainda e necessario:

- Criar e configurar o projeto Supabase.
- Executar as migrations no PostgreSQL.
- Criar os buckets privados.
- Registrar os aplicativos no Microsoft Entra ID.
- Preencher as variaveis do Render.
- Trocar os placeholders em `frontend/api-config.js` e `frontend/auth-config.js`.
- Publicar o frontend.
- Instalar e configurar o agente local nos monitores.
- Validar as coordenadas dos tres monitores.

Nao assumir que `https://seu-backend.onrender.com` ou `SEU_TENANT_ID` sao enderecos reais. Sao apenas placeholders.
