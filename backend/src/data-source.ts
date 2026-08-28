import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Gatilho } from './entities/Gatilho.js';
import { Solicitacao } from './entities/Solicitacao.js';
import { Usuario } from './entities/Usuario.js';
import { Auditoria } from './entities/Auditoria.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: false,
  entities: [Gatilho, Solicitacao, Usuario, Auditoria],
  migrations: ['dist/migrations/*.js'],
});
