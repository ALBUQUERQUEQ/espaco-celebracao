import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auditorias' })
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({ type: 'text' })
  acao!: string;

  @Column({ name: 'entidade_id', type: 'text', nullable: true })
  entidadeId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  detalhes!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
