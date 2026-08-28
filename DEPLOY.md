# Publicar o sistema

## 1. Supabase

1. Crie um projeto em https://supabase.com.
2. Copie a URL do banco PostgreSQL em Project Settings > Database.
3. Copie a URL do projeto e a `service_role key` em Project Settings > API.
4. Crie os buckets privados `anexos` e `conteudo` em Storage.
5. Nunca coloque a `service_role key` no frontend ou no GitHub Pages.

## 2. API no Render

1. Envie este repositorio para o GitHub.
2. No Render, escolha New > Blueprint e selecione o repositorio.
3. Configure `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `FRONTEND_ORIGIN`.
4. Execute `npm run migration:run` uma vez para criar as tabelas TypeORM.
5. `FRONTEND_ORIGIN` deve ser a URL do GitHub Pages, por exemplo `https://usuario.github.io/repositorio`.
6. O endereco da API sera parecido com `https://gatilho-telas-api.onrender.com`.
 
## 2.1 OAuth 2.0 + OpenID Connect

1. No Entra ID, Okta ou outro provedor OIDC, registre um aplicativo SPA para o frontend.
2. Registre uma API separada e defina o escopo `access_as_user`.
3. Crie o app role `Totem.Admin` para quem pode aprovar solicitações.
4. Em `frontend/auth-config.js`, configure o client ID, authority e escopo da API.
5. No backend, configure `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` e `OIDC_ADMIN_ROLES`.
6. Cadastre no provedor os redirect URIs de `frontend/index.html`, `frontend/esquerda.html`, `frontend/centro.html` e `frontend/direita.html`.

O backend valida assinatura, emissor, audiência, expiração e role do JWT. Tokens, senhas e chaves privadas não são armazenados pelo sistema.

## 3. Frontend no GitHub Pages

1. Edite `frontend/api-config.js` e troque `https://seu-backend.onrender.com` pela URL real do Render.
2. No GitHub, abra Settings > Pages.
3. Escolha GitHub Actions ou a pasta `frontend` como origem.
4. Publique a pasta `frontend`.

## 4. Agente dos monitores

No computador conectado aos tres monitores, dentro de `local-launcher`:

```text
npm install
set TOTEM_SITE_URL=https://usuario.github.io/repositorio
set TOTEM_MONITORS=0,0;1920,0;3840,0
npm start
```

Mantenha o agente rodando nesse computador. O botao da pagina em nuvem chama `http://127.0.0.1:8899/start`; ele abre as tres telas da nuvem localmente, uma em cada monitor.

`TOTEM_MONITORS` usa a posicao X,Y de cada monitor, da esquerda para a direita. Ajuste os valores conforme a resolucao e a disposicao dos monitores.

O navegador pode bloquear a chamada local se o site estiver em uma origem diferente. Nesse caso, o agente deve ser executado com a configuracao de CORS atual e o computador precisa acessar o site por HTTPS.
