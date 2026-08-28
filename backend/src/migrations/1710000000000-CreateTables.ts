import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateTables1710000000000 implements MigrationInterface {
  name = 'CreateTables1710000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'solicitacoes',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true },
        { name: 'titulo', type: 'text' },
        { name: 'tipo_servico', type: 'text' },
        { name: 'inicio', type: 'timestamptz' },
        { name: 'fim', type: 'timestamptz' },
        { name: 'detalhes', type: 'text', default: "''" },
        { name: 'aprovacao', type: 'text', default: "'pendente'" },
        { name: 'arquivos', type: 'jsonb', default: "'{}'" },
        { name: 'created_at', type: 'timestamptz', default: 'now()' },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'gatilhos',
      columns: [
        { name: 'id', type: 'text', isPrimary: true },
        { name: 'nome', type: 'text' },
        { name: 'tipo', type: 'text', default: "'tecla'" },
        { name: 'tecla', type: 'text', default: "''" },
        { name: 'horario', type: 'text', default: "''" },
        { name: 'duracao_minutos', type: 'numeric', default: '3' },
        { name: 'esquerda', type: 'text', default: "''" },
        { name: 'centro', type: 'text', default: "''" },
        { name: 'direita', type: 'text', default: "''" },
      ],
    }), true);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('gatilhos', true);
    await queryRunner.dropTable('solicitacoes', true);
  }
}
