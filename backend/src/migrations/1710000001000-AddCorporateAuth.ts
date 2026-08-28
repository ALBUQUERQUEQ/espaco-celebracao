import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddCorporateAuth1710000001000 implements MigrationInterface {
  name = 'AddCorporateAuth1710000001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({ name: 'usuarios', columns: [
      { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
      { name: 'nome', type: 'text' }, { name: 'email', type: 'text', isUnique: true },
      { name: 'oid', type: 'text', isUnique: true }, { name: 'perfil', type: 'text', default: "'SOLICITANTE'" },
      { name: 'ativo', type: 'boolean', default: true }, { name: 'created_at', type: 'timestamptz', default: 'now()' },
      { name: 'updated_at', type: 'timestamptz', default: 'now()' },
    ] }), true);
    await queryRunner.createTable(new Table({ name: 'auditorias', columns: [
      { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
      { name: 'usuario_id', type: 'uuid' }, { name: 'acao', type: 'text' },
      { name: 'entidade_id', type: 'text', isNullable: true }, { name: 'detalhes', type: 'jsonb', default: "'{}'" },
      { name: 'created_at', type: 'timestamptz', default: 'now()' },
    ] }), true);
    await queryRunner.addColumns('solicitacoes', [
      { name: 'usuario_id', type: 'uuid', isNullable: true },
      { name: 'aprovado_por', type: 'uuid', isNullable: true },
      { name: 'data_aprovacao', type: 'timestamptz', isNullable: true },
    ].map((definition) => ({ ...definition, isNullable: true }) as any));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('solicitacoes', 'data_aprovacao');
    await queryRunner.dropColumn('solicitacoes', 'aprovado_por');
    await queryRunner.dropColumn('solicitacoes', 'usuario_id');
    await queryRunner.dropTable('auditorias', true);
    await queryRunner.dropTable('usuarios', true);
  }
}
