import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'gatilhos' })
export class Gatilho {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text' })
  nome!: string;

  @Column({ type: 'text', default: 'tecla' })
  tipo!: string;

  @Column({ type: 'text', default: '' })
  tecla!: string;

  @Column({ type: 'text', default: '' })
  horario!: string;

  @Column({ name: 'duracao_minutos', type: 'numeric', default: 3 })
  duracaoMinutos!: number;

  @Column({ type: 'text', default: '' })
  esquerda!: string;

  @Column({ type: 'text', default: '' })
  centro!: string;

  @Column({ type: 'text', default: '' })
  direita!: string;
}
