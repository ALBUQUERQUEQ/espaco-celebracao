import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type Aprovacao = 'pendente' | 'aprovado' | 'reprovado';

@Entity({ name: 'solicitacoes' })
export class Solicitacao {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @Column({ name: 'aprovado_por', type: 'uuid', nullable: true })
  aprovadoPor!: string | null;

  @Column({ name: 'data_aprovacao', type: 'timestamptz', nullable: true })
  dataAprovacao!: Date | null;

  @Column({ type: 'text' })
  titulo!: string;

  @Column({ name: 'tipo_servico', type: 'text' })
  tipoServico!: string;

  @Column({ type: 'timestamptz' })
  inicio!: Date;

  @Column({ type: 'timestamptz' })
  fim!: Date;

  @Column({ type: 'text', default: '' })
  detalhes!: string;

  @Column({ type: 'text', default: 'pendente' })
  aprovacao!: Aprovacao;

  @Column({ type: 'jsonb', default: {} })
  arquivos!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  criadaEm!: Date;
}
