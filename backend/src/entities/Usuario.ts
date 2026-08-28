import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type Perfil = 'SOLICITANTE' | 'APROVADOR' | 'ADMIN';

@Entity({ name: 'usuarios' })
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text', unique: true })
  oid!: string;

  @Column({ type: 'text', default: 'SOLICITANTE' })
  perfil!: Perfil;

  @Column({ type: 'boolean', default: true })
  ativo!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
