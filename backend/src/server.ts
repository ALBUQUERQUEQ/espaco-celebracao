import 'reflect-metadata';
import 'dotenv/config';
import cors from 'cors';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { AppDataSource } from './data-source.js';
import { Gatilho } from './entities/Gatilho.js';
import { Aprovacao, Solicitacao } from './entities/Solicitacao.js';
import { Perfil, Usuario } from './entities/Usuario.js';
import { Auditoria } from './entities/Auditoria.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const solicitacoes = AppDataSource.getRepository(Solicitacao);
const gatilhos = AppDataSource.getRepository(Gatilho);
const usuarios = AppDataSource.getRepository(Usuario);
const auditorias = AppDataSource.getRepository(Auditoria);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']);
type State = { contador: number; contadorCancelar: number; intervaloFundo: number; duracao?: number; esquerda?: string; centro?: string; direita?: string };
type AuthenticatedRequest = Request & { user?: JWTPayload };
type RequestWithUser = AuthenticatedRequest & { appUser?: Usuario };
let state: State = { contador: 0, contadorCancelar: 0, intervaloFundo: 10 };
const oidcIssuer = process.env.OIDC_ISSUER;
const oidcAudience = process.env.OIDC_AUDIENCE;
const oidcJwks = process.env.OIDC_JWKS_URL ? createRemoteJWKSet(new URL(process.env.OIDC_JWKS_URL)) : null;

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false }));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use(express.json({ limit: '1mb' }));

function fail(response: Response, status: number, message: string) {
  return response.status(status).json({ error: message });
}

function filePath(requestId: string, side: string, originalName: string) {
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${requestId}/${side}-${safeName}`;
}

async function requireJwt(request: RequestWithUser, response: Response, next: express.NextFunction) {
  if (!oidcIssuer || !oidcAudience || !oidcJwks) return fail(response, 503, 'OIDC nao configurado');
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return fail(response, 401, 'Token Bearer obrigatorio');
  try {
    const token = authorization.slice('Bearer '.length);
    const { payload } = await jwtVerify(token, oidcJwks, { issuer: oidcIssuer, audience: oidcAudience });
    const oid = String(payload.oid || payload.sub || '');
    const email = String(payload.preferred_username || payload.email || '');
    if (!oid || !email) return fail(response, 401, 'JWT sem identificacao corporativa');
    const roles = Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === 'string') : [];
    const adminRoles = (process.env.OIDC_ADMIN_ROLES || 'Totem.Admin').split(',').map((role) => role.trim());
    const approverRoles = (process.env.OIDC_APPROVER_ROLES || 'Totem.Approver').split(',').map((role) => role.trim());
    const perfil: Perfil = roles.some((role) => adminRoles.includes(role)) ? 'ADMIN' : roles.some((role) => approverRoles.includes(role)) ? 'APROVADOR' : 'SOLICITANTE';
    let appUser = await usuarios.findOneBy({ oid });
    if (!appUser) appUser = usuarios.create({ oid, email, nome: String(payload.name || email), perfil, ativo: true });
    else { appUser.email = email; appUser.nome = String(payload.name || appUser.nome); if (perfil !== 'SOLICITANTE') appUser.perfil = perfil; }
    if (!appUser.ativo) return fail(response, 403, 'Usuario desativado');
    request.appUser = appUser;
    await usuarios.save(appUser);
    request.user = payload;
    return next();
  } catch { return fail(response, 401, 'JWT invalido ou expirado'); }
}

function requireAdmin(request: AuthenticatedRequest, response: Response, next: express.NextFunction) {
  const required = (process.env.OIDC_ADMIN_ROLES || 'Totem.Admin').split(',').map((role) => role.trim());
  const roles = Array.isArray(request.user?.roles) ? request.user.roles.filter((role): role is string => typeof role === 'string') : [];
  if (!required.some((role) => roles.includes(role))) return fail(response, 403, 'Permissao de administrador obrigatoria');
  return next();
}

function requireRole(...perfis: Perfil[]) {
  return (request: RequestWithUser, response: Response, next: express.NextFunction) => {
    if (!request.appUser || !perfis.includes(request.appUser.perfil)) return fail(response, 403, 'Permissao insuficiente');
    return next();
  };
}

app.get('/health', (_request, response) => response.json({ ok: true }));
app.use(requireJwt);
app.get('/me', (request: RequestWithUser, response) => response.json(request.appUser));
app.get('/usuarios', requireRole('ADMIN'), async (_request, response) => {
  return response.json({ usuarios: await usuarios.find({ order: { nome: 'ASC' } }) });
});
app.patch('/usuarios/:id', requireRole('ADMIN'), async (request: RequestWithUser, response) => {
  const usuario = await usuarios.findOneBy({ id: String(request.params.id) });
  if (!usuario) return fail(response, 404, 'Usuario nao encontrado');
  if (request.body.perfil && ['SOLICITANTE', 'APROVADOR', 'ADMIN'].includes(request.body.perfil)) usuario.perfil = request.body.perfil;
  if (typeof request.body.ativo === 'boolean') usuario.ativo = request.body.ativo;
  const salvo = await usuarios.save(usuario);
  await auditorias.save(auditorias.create({ usuarioId: request.appUser!.id, acao: 'USUARIO_ATUALIZADO', entidadeId: usuario.id, detalhes: { perfil: usuario.perfil, ativo: usuario.ativo } }));
  return response.json(salvo);
});
app.get('/config', (_request, response) => response.json({ intervaloFundoSegundos: state.intervaloFundo, teclaCancelar: '' }));
app.get('/estado', (_request, response) => response.json(state));

app.get('/gatilhos', async (_request, response) => {
  try { return response.json({ gatilhos: await gatilhos.find() }); }
  catch (error) { return fail(response, 500, (error as Error).message); }
});

app.get('/lista', async (request, response) => {
  const folder = String(request.query.pasta || '');
  if (!folder || /[\\/]/.test(folder)) return response.json({ arquivos: [] });
  const { data, error } = await supabase.storage.from(process.env.SUPABASE_CONTENT_BUCKET || 'conteudo').list(folder);
  if (error) return fail(response, 500, error.message);
  return response.json({ arquivos: (data || []).map((file) => file.name) });
});

app.get('/conteudo/*path', async (request, response) => {
  const path = Array.isArray(request.params.path) ? request.params.path.join('/') : request.params.path;
  const { data, error } = await supabase.storage.from(process.env.SUPABASE_CONTENT_BUCKET || 'conteudo').createSignedUrl(path, 3600);
  if (error) return fail(response, 404, error.message);
  return response.redirect(data.signedUrl);
});

app.get('/disparar', async (request, response) => {
  const gatilho = await gatilhos.findOneBy({ id: String(request.query.id) });
  if (!gatilho) return fail(response, 404, 'Gatilho nao encontrado');
  state = { ...state, contador: state.contador + 1, duracao: Number(gatilho.duracaoMinutos || 3) * 60, esquerda: gatilho.esquerda, centro: gatilho.centro, direita: gatilho.direita };
  return response.json({ ok: true });
});

app.get('/cancelar', (_request, response) => {
  state = { ...state, contadorCancelar: state.contadorCancelar + 1 };
  return response.json({ ok: true });
});

app.get('/solicitacoes', async (request: RequestWithUser, response) => {
  try {
    const itens = request.appUser?.perfil === 'SOLICITANTE'
      ? await solicitacoes.find({ where: { usuarioId: request.appUser.id }, order: { criadaEm: 'DESC' } })
      : await solicitacoes.find({ order: { criadaEm: 'DESC' } });
    return response.json({ solicitacoes: itens });
  }
  catch (error) { return fail(response, 500, (error as Error).message); }
});

app.post('/solicitacoes', upload.fields([
  { name: 'arquivoEsquerda', maxCount: 1 }, { name: 'arquivoCentro', maxCount: 1 }, { name: 'arquivoDireita', maxCount: 1 },
]), async (request: RequestWithUser, response: Response) => {
  try {
    const { titulo, tipoServico, inicio, fim, detalhes } = request.body;
    if (!titulo || !tipoServico || !inicio || !fim) return fail(response, 400, 'Campos obrigatorios ausentes');
    const id = randomUUID();
    const files: Record<string, string> = {};
    const fields: Record<string, string> = { esquerda: 'arquivoEsquerda', centro: 'arquivoCentro', direita: 'arquivoDireita' };
    const received = request.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    for (const [side, field] of Object.entries(fields)) {
      const file = received?.[field]?.[0];
      if (!file) continue;
      if (!allowedTypes.has(file.mimetype)) return fail(response, 400, 'Tipo de arquivo nao permitido');
      const path = filePath(id, side, file.originalname);
      const { error } = await supabase.storage.from(process.env.SUPABASE_BUCKET || 'anexos').upload(path, file.buffer, { contentType: file.mimetype });
      if (error) return fail(response, 500, error.message);
      files[side] = path;
    }

    const item = solicitacoes.create({ id, usuarioId: request.appUser!.id, titulo, tipoServico, inicio: new Date(inicio), fim: new Date(fim), detalhes: detalhes || '', aprovacao: 'pendente', aprovadoPor: null, dataAprovacao: null, arquivos: files });
    const salvo = await solicitacoes.save(item);
    await auditorias.save(auditorias.create({ usuarioId: request.appUser!.id, acao: 'SOLICITACAO_CRIADA', entidadeId: id, detalhes: { titulo } }));
    return response.status(201).json(salvo);
  } catch (error) { return fail(response, 500, (error as Error).message); }
});

app.patch('/solicitacoes/:id', requireRole('APROVADOR', 'ADMIN'), async (request: RequestWithUser, response) => {
  const aprovacao = request.body.aprovacao as Aprovacao;
  if (!['pendente', 'aprovado', 'reprovado'].includes(aprovacao)) return fail(response, 400, 'Status invalido');
  const id = String(request.params.id);
  const item = await solicitacoes.findOneBy({ id });
  if (!item) return fail(response, 404, 'Solicitacao nao encontrada');
  item.aprovacao = aprovacao;
  item.aprovadoPor = request.appUser!.id;
  item.dataAprovacao = new Date();
  const salvo = await solicitacoes.save(item);
  await auditorias.save(auditorias.create({ usuarioId: request.appUser!.id, acao: aprovacao === 'aprovado' ? 'SOLICITACAO_APROVADA' : 'SOLICITACAO_REPROVADA', entidadeId: id, detalhes: {} }));
  return response.json(salvo);
});

app.get('/anexos/*path', async (request, response) => {
  const path = Array.isArray(request.params.path) ? request.params.path.join('/') : request.params.path;
  const { data, error } = await supabase.storage.from(process.env.SUPABASE_BUCKET || 'anexos').createSignedUrl(path, 3600);
  if (error) return fail(response, 404, error.message);
  return response.redirect(data.signedUrl);
});

AppDataSource.initialize().then(() => {
  app.listen(port, () => console.log(`API TypeScript online na porta ${port}`));
}).catch((error) => {
  console.error('Falha ao conectar ao banco:', error);
  process.exit(1);
});
