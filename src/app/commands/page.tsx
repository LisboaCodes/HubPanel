"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  Database,
  Code2,
  Shield,
  GitBranch,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DbEngine = "pg" | "mysql" | "both";

interface SqlCommand {
  name: string;
  description: string;
  syntax: string;
  pgExample?: string;
  mysqlExample?: string;
  /** When both engines share the exact same syntax */
  commonExample?: string;
  engine: DbEngine;
}

interface CommandCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  commands: SqlCommand[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function engineBadge(engine: DbEngine) {
  switch (engine) {
    case "pg":
      return (
        <Badge
          variant="outline"
          className="border-blue-500/30 bg-blue-500/15 text-blue-400"
        >
          PostgreSQL
        </Badge>
      );
    case "mysql":
      return (
        <Badge
          variant="outline"
          className="border-orange-500/30 bg-orange-500/15 text-orange-400"
        >
          MySQL
        </Badge>
      );
    case "both":
      return (
        <Badge
          variant="outline"
          className="border-zinc-500/30 bg-zinc-500/15 text-zinc-400"
        >
          Ambos
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Command data
// ---------------------------------------------------------------------------

const categories: CommandCategory[] = [
  // ── DDL ──────────────────────────────────────────────────────────────────
  {
    id: "ddl",
    label: "DDL - Definicao",
    icon: Database,
    commands: [
      // CREATE DATABASE
      {
        name: "CREATE DATABASE",
        description: "Cria um novo banco de dados.",
        syntax: "CREATE DATABASE nome_banco;",
        pgExample: `CREATE DATABASE loja
  WITH OWNER = admin
       ENCODING = 'UTF8'
       LC_COLLATE = 'pt_BR.UTF-8'
       TEMPLATE = template0;`,
        mysqlExample: `CREATE DATABASE loja
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;`,
        engine: "both",
      },
      // DROP DATABASE
      {
        name: "DROP DATABASE",
        description: "Remove um banco de dados inteiro.",
        syntax: "DROP DATABASE [IF EXISTS] nome_banco;",
        commonExample: "DROP DATABASE IF EXISTS loja;",
        engine: "both",
      },
      // ALTER DATABASE
      {
        name: "ALTER DATABASE",
        description: "Altera propriedades de um banco de dados.",
        syntax: "ALTER DATABASE nome_banco SET ...;",
        pgExample: `ALTER DATABASE loja
  SET timezone TO 'America/Sao_Paulo';`,
        mysqlExample: `ALTER DATABASE loja
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;`,
        engine: "both",
      },
      // CREATE TABLE
      {
        name: "CREATE TABLE",
        description: "Cria uma nova tabela com colunas e constraints.",
        syntax: `CREATE TABLE nome_tabela (
  coluna tipo [constraints],
  ...
);`,
        pgExample: `CREATE TABLE produtos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  preco NUMERIC(10,2) DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  categoria_id INT REFERENCES categorias(id)
);`,
        mysqlExample: `CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  preco DECIMAL(10,2) DEFAULT 0,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  categoria_id INT,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        engine: "both",
      },
      // DROP TABLE
      {
        name: "DROP TABLE",
        description: "Remove uma tabela e todos os seus dados.",
        syntax: "DROP TABLE [IF EXISTS] nome_tabela [CASCADE];",
        pgExample: "DROP TABLE IF EXISTS produtos CASCADE;",
        mysqlExample: "DROP TABLE IF EXISTS produtos;",
        engine: "both",
      },
      // ALTER TABLE
      {
        name: "ALTER TABLE",
        description:
          "Modifica a estrutura de uma tabela (adicionar/remover colunas, constraints, etc).",
        syntax: `ALTER TABLE nome_tabela
  ADD COLUMN coluna tipo,
  DROP COLUMN coluna,
  ALTER COLUMN coluna SET ...;`,
        pgExample: `-- Adicionar coluna
ALTER TABLE produtos ADD COLUMN estoque INT DEFAULT 0;

-- Renomear coluna
ALTER TABLE produtos RENAME COLUMN preco TO valor;

-- Alterar tipo
ALTER TABLE produtos
  ALTER COLUMN nome TYPE TEXT;

-- Adicionar constraint
ALTER TABLE produtos
  ADD CONSTRAINT chk_valor CHECK (valor >= 0);`,
        mysqlExample: `-- Adicionar coluna
ALTER TABLE produtos ADD COLUMN estoque INT DEFAULT 0;

-- Renomear coluna
ALTER TABLE produtos CHANGE preco valor DECIMAL(10,2);

-- Alterar tipo
ALTER TABLE produtos
  MODIFY COLUMN nome TEXT;

-- Adicionar constraint
ALTER TABLE produtos
  ADD CONSTRAINT chk_valor CHECK (valor >= 0);`,
        engine: "both",
      },
      // TRUNCATE TABLE
      {
        name: "TRUNCATE TABLE",
        description:
          "Remove todos os registros de uma tabela de forma rapida (nao gera log por linha).",
        syntax: "TRUNCATE TABLE nome_tabela [CASCADE];",
        pgExample: "TRUNCATE TABLE pedidos RESTART IDENTITY CASCADE;",
        mysqlExample: "TRUNCATE TABLE pedidos;",
        engine: "both",
      },
      // CREATE INDEX
      {
        name: "CREATE INDEX",
        description: "Cria um indice para acelerar consultas.",
        syntax:
          "CREATE [UNIQUE] INDEX nome_idx ON tabela (coluna [, coluna2]);",
        pgExample: `-- Indice simples
CREATE INDEX idx_produtos_nome ON produtos (nome);

-- Indice parcial (PostgreSQL exclusivo)
CREATE INDEX idx_ativos ON produtos (nome)
  WHERE ativo = true;

-- Indice GIN para full-text / JSONB
CREATE INDEX idx_dados_gin ON docs USING GIN (dados);`,
        mysqlExample: `-- Indice simples
CREATE INDEX idx_produtos_nome ON produtos (nome);

-- Indice composto
CREATE INDEX idx_pedido_data ON pedidos (cliente_id, data_pedido);

-- Indice FULLTEXT
CREATE FULLTEXT INDEX idx_ft_nome ON produtos (nome);`,
        engine: "both",
      },
      // DROP INDEX
      {
        name: "DROP INDEX",
        description: "Remove um indice existente.",
        syntax: "DROP INDEX [IF EXISTS] nome_idx;",
        pgExample: "DROP INDEX IF EXISTS idx_produtos_nome;",
        mysqlExample: "DROP INDEX idx_produtos_nome ON produtos;",
        engine: "both",
      },
      // CREATE VIEW
      {
        name: "CREATE VIEW",
        description:
          "Cria uma view (tabela virtual baseada em uma consulta).",
        syntax: "CREATE [OR REPLACE] VIEW nome_view AS SELECT ...;",
        pgExample: `CREATE OR REPLACE VIEW vw_produtos_caros AS
SELECT id, nome, preco
FROM produtos
WHERE preco > 100
ORDER BY preco DESC;`,
        mysqlExample: `CREATE OR REPLACE VIEW vw_produtos_caros AS
SELECT id, nome, preco
FROM produtos
WHERE preco > 100
ORDER BY preco DESC;`,
        engine: "both",
      },
      // DROP VIEW
      {
        name: "DROP VIEW",
        description: "Remove uma view existente.",
        syntax: "DROP VIEW [IF EXISTS] nome_view;",
        commonExample: "DROP VIEW IF EXISTS vw_produtos_caros;",
        engine: "both",
      },
      // CREATE SCHEMA
      {
        name: "CREATE SCHEMA",
        description: "Cria um schema para organizar objetos do banco.",
        syntax: "CREATE SCHEMA [IF NOT EXISTS] nome_schema;",
        pgExample: `CREATE SCHEMA IF NOT EXISTS vendas
  AUTHORIZATION admin;

-- Acessar tabela no schema
SELECT * FROM vendas.pedidos;`,
        mysqlExample: `-- No MySQL, schema = database
CREATE DATABASE IF NOT EXISTS vendas;`,
        engine: "both",
      },
      // DROP SCHEMA
      {
        name: "DROP SCHEMA",
        description: "Remove um schema e opcionalmente seus objetos.",
        syntax: "DROP SCHEMA [IF EXISTS] nome_schema [CASCADE];",
        pgExample: "DROP SCHEMA IF EXISTS vendas CASCADE;",
        mysqlExample: "DROP DATABASE IF EXISTS vendas;",
        engine: "both",
      },
    ],
  },

  // ── DML ──────────────────────────────────────────────────────────────────
  {
    id: "dml",
    label: "DML - Manipulacao",
    icon: Code2,
    commands: [
      // SELECT
      {
        name: "SELECT",
        description:
          "Consulta dados de uma ou mais tabelas. O comando mais utilizado em SQL.",
        syntax: `SELECT [DISTINCT] colunas
FROM tabela
[JOIN ...]
[WHERE condicao]
[GROUP BY colunas]
[HAVING condicao]
[ORDER BY colunas [ASC|DESC]]
[LIMIT n OFFSET m];`,
        commonExample: `-- Simples
SELECT nome, preco FROM produtos WHERE preco > 50;

-- Com alias e ordenacao
SELECT p.nome AS produto, c.nome AS categoria
FROM produtos p
INNER JOIN categorias c ON c.id = p.categoria_id
ORDER BY p.preco DESC
LIMIT 10;

-- Agregacao
SELECT categoria_id, COUNT(*) AS total,
       AVG(preco) AS media_preco
FROM produtos
GROUP BY categoria_id
HAVING COUNT(*) > 5;

-- Subquery
SELECT * FROM produtos
WHERE preco > (SELECT AVG(preco) FROM produtos);`,
        engine: "both",
      },
      // SELECT com JOINs
      {
        name: "SELECT com JOINs",
        description:
          "Combina registros de duas ou mais tabelas com base em colunas relacionadas.",
        syntax: `SELECT ...
FROM tabela_a a
[INNER] JOIN tabela_b b ON a.id = b.a_id
LEFT  JOIN tabela_c c ON ...
RIGHT JOIN tabela_d d ON ...
FULL  JOIN tabela_e e ON ...  -- PG apenas
CROSS JOIN tabela_f;`,
        pgExample: `-- INNER JOIN
SELECT p.nome, c.nome AS categoria
FROM produtos p
INNER JOIN categorias c ON c.id = p.categoria_id;

-- LEFT JOIN (inclui produtos sem categoria)
SELECT p.nome, COALESCE(c.nome, 'Sem categoria')
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id;

-- FULL OUTER JOIN (PG)
SELECT p.nome, c.nome
FROM produtos p
FULL OUTER JOIN categorias c ON c.id = p.categoria_id;

-- Multiplos JOINs
SELECT pe.id, cl.nome, pr.nome, pe.quantidade
FROM pedidos pe
JOIN clientes cl ON cl.id = pe.cliente_id
JOIN produtos pr ON pr.id = pe.produto_id
WHERE pe.data > '2025-01-01';`,
        mysqlExample: `-- INNER JOIN
SELECT p.nome, c.nome AS categoria
FROM produtos p
INNER JOIN categorias c ON c.id = p.categoria_id;

-- LEFT JOIN
SELECT p.nome, COALESCE(c.nome, 'Sem categoria')
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id;

-- MySQL nao suporta FULL OUTER JOIN nativo
-- Workaround com UNION:
SELECT p.nome, c.nome
FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
UNION
SELECT p.nome, c.nome
FROM produtos p RIGHT JOIN categorias c ON c.id = p.categoria_id;`,
        engine: "both",
      },
      // INSERT
      {
        name: "INSERT",
        description: "Insere novos registros em uma tabela.",
        syntax: `INSERT INTO tabela (col1, col2, ...)
VALUES (val1, val2, ...);`,
        pgExample: `-- Inserir unico
INSERT INTO produtos (nome, preco, categoria_id)
VALUES ('Notebook', 3500.00, 1);

-- Inserir multiplos
INSERT INTO produtos (nome, preco, categoria_id)
VALUES
  ('Mouse', 89.90, 2),
  ('Teclado', 199.90, 2),
  ('Monitor', 1200.00, 1);

-- Retornar dados inseridos (PG)
INSERT INTO produtos (nome, preco)
VALUES ('Webcam', 299.90)
RETURNING id, nome;`,
        mysqlExample: `-- Inserir unico
INSERT INTO produtos (nome, preco, categoria_id)
VALUES ('Notebook', 3500.00, 1);

-- Inserir multiplos
INSERT INTO produtos (nome, preco, categoria_id)
VALUES
  ('Mouse', 89.90, 2),
  ('Teclado', 199.90, 2),
  ('Monitor', 1200.00, 1);

-- Obter ultimo ID inserido
SELECT LAST_INSERT_ID();`,
        engine: "both",
      },
      // INSERT ... SELECT
      {
        name: "INSERT ... SELECT",
        description:
          "Insere registros a partir de uma consulta em outra tabela.",
        syntax: `INSERT INTO tabela_destino (col1, col2)
SELECT col1, col2 FROM tabela_origem
WHERE condicao;`,
        commonExample: `-- Copiar produtos caros para tabela de destaque
INSERT INTO produtos_destaque (nome, preco)
SELECT nome, preco
FROM produtos
WHERE preco > 500;

-- Copiar estrutura e dados
INSERT INTO backup_clientes
SELECT * FROM clientes
WHERE criado_em >= '2025-01-01';`,
        engine: "both",
      },
      // UPDATE
      {
        name: "UPDATE",
        description: "Atualiza registros existentes em uma tabela.",
        syntax: `UPDATE tabela
SET col1 = val1, col2 = val2
WHERE condicao;`,
        pgExample: `-- Update simples
UPDATE produtos
SET preco = preco * 1.10
WHERE categoria_id = 3;

-- Update com RETURNING (PG)
UPDATE produtos
SET preco = 199.90
WHERE id = 42
RETURNING id, nome, preco;`,
        mysqlExample: `-- Update simples
UPDATE produtos
SET preco = preco * 1.10
WHERE categoria_id = 3;

-- Update com LIMIT (MySQL)
UPDATE produtos
SET destaque = true
ORDER BY vendas DESC
LIMIT 10;`,
        engine: "both",
      },
      // UPDATE com JOIN
      {
        name: "UPDATE com JOIN",
        description: "Atualiza registros usando dados de outra tabela.",
        syntax: `-- Sintaxe varia por engine`,
        pgExample: `-- PostgreSQL usa FROM
UPDATE produtos p
SET preco = p.preco * 0.90
FROM categorias c
WHERE c.id = p.categoria_id
  AND c.nome = 'Eletronicos';`,
        mysqlExample: `-- MySQL usa JOIN direto
UPDATE produtos p
INNER JOIN categorias c ON c.id = p.categoria_id
SET p.preco = p.preco * 0.90
WHERE c.nome = 'Eletronicos';`,
        engine: "both",
      },
      // DELETE
      {
        name: "DELETE",
        description: "Remove registros de uma tabela.",
        syntax: `DELETE FROM tabela
WHERE condicao;`,
        pgExample: `-- Delete simples
DELETE FROM produtos WHERE id = 42;

-- Delete com RETURNING (PG)
DELETE FROM produtos
WHERE estoque = 0
RETURNING id, nome;

-- Deletar todos (cuidado!)
DELETE FROM log_acessos
WHERE data < NOW() - INTERVAL '90 days';`,
        mysqlExample: `-- Delete simples
DELETE FROM produtos WHERE id = 42;

-- Delete com LIMIT (MySQL)
DELETE FROM log_acessos
WHERE data < DATE_SUB(NOW(), INTERVAL 90 DAY)
LIMIT 1000;`,
        engine: "both",
      },
      // DELETE com JOIN
      {
        name: "DELETE com JOIN",
        description: "Remove registros usando condicao de outra tabela.",
        syntax: `-- Sintaxe varia por engine`,
        pgExample: `-- PostgreSQL usa USING
DELETE FROM produtos p
USING categorias c
WHERE c.id = p.categoria_id
  AND c.ativo = false;`,
        mysqlExample: `-- MySQL usa JOIN
DELETE p FROM produtos p
INNER JOIN categorias c ON c.id = p.categoria_id
WHERE c.ativo = false;`,
        engine: "both",
      },
      // UPSERT
      {
        name: "UPSERT (Insert ou Update)",
        description:
          "Insere um registro ou atualiza caso ja exista (conflito de chave).",
        syntax: `-- PG: ON CONFLICT ... DO UPDATE
-- MySQL: ON DUPLICATE KEY UPDATE`,
        pgExample: `-- PostgreSQL: ON CONFLICT
INSERT INTO produtos (sku, nome, preco)
VALUES ('SKU-001', 'Mouse Gamer', 189.90)
ON CONFLICT (sku) DO UPDATE
SET nome = EXCLUDED.nome,
    preco = EXCLUDED.preco,
    atualizado_em = NOW();

-- Ignorar conflito
INSERT INTO logs (evento, data)
VALUES ('login', NOW())
ON CONFLICT DO NOTHING;`,
        mysqlExample: `-- MySQL: ON DUPLICATE KEY
INSERT INTO produtos (sku, nome, preco)
VALUES ('SKU-001', 'Mouse Gamer', 189.90)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  preco = VALUES(preco),
  atualizado_em = NOW();

-- INSERT IGNORE (ignora duplicados)
INSERT IGNORE INTO logs (evento, data)
VALUES ('login', NOW());`,
        engine: "both",
      },
    ],
  },

  // ── DCL ──────────────────────────────────────────────────────────────────
  {
    id: "dcl",
    label: "DCL - Controle de Acesso",
    icon: Shield,
    commands: [
      // CREATE USER / ROLE
      {
        name: "CREATE USER / CREATE ROLE",
        description: "Cria um novo usuario ou role no banco de dados.",
        syntax: "CREATE USER nome WITH PASSWORD 'senha';",
        pgExample: `-- Criar usuario
CREATE USER app_user WITH PASSWORD 'SenhaSegura123!';

-- Criar role (sem login)
CREATE ROLE readonly;

-- Criar role com login
CREATE ROLE app_admin WITH LOGIN PASSWORD 'Admin123!'
  CREATEDB CREATEROLE;

-- Role com validade
CREATE ROLE temp_user WITH LOGIN PASSWORD 'tmp'
  VALID UNTIL '2026-12-31';`,
        mysqlExample: `-- Criar usuario
CREATE USER 'app_user'@'%'
  IDENTIFIED BY 'SenhaSegura123!';

-- Criar usuario para host especifico
CREATE USER 'app_user'@'192.168.1.%'
  IDENTIFIED BY 'SenhaSegura123!';

-- Criar role (MySQL 8+)
CREATE ROLE 'readonly';`,
        engine: "both",
      },
      // DROP USER / ROLE
      {
        name: "DROP USER / DROP ROLE",
        description: "Remove um usuario ou role.",
        syntax: "DROP USER [IF EXISTS] nome;",
        pgExample: `DROP USER IF EXISTS app_user;
DROP ROLE IF EXISTS readonly;`,
        mysqlExample: `DROP USER IF EXISTS 'app_user'@'%';
DROP ROLE IF EXISTS 'readonly';`,
        engine: "both",
      },
      // GRANT
      {
        name: "GRANT",
        description:
          "Concede privilegios a um usuario ou role.",
        syntax: `GRANT privilegio ON objeto TO usuario;`,
        pgExample: `-- Todos os privilegios em um banco
GRANT ALL PRIVILEGES ON DATABASE loja TO app_admin;

-- Permissoes em tabela
GRANT SELECT, INSERT, UPDATE ON produtos TO app_user;

-- Permissoes em todas as tabelas de um schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- Privilegios default para tabelas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO readonly;

-- Conceder role a usuario
GRANT readonly TO app_user;`,
        mysqlExample: `-- Todos os privilegios em um banco
GRANT ALL PRIVILEGES ON loja.* TO 'app_admin'@'%';

-- Permissoes em tabela
GRANT SELECT, INSERT, UPDATE ON loja.produtos
  TO 'app_user'@'%';

-- Apenas leitura em todo o banco
GRANT SELECT ON loja.* TO 'readonly'@'%';

-- Conceder role (MySQL 8+)
GRANT 'readonly' TO 'app_user'@'%';

-- Aplicar privilegios
FLUSH PRIVILEGES;`,
        engine: "both",
      },
      // REVOKE
      {
        name: "REVOKE",
        description: "Revoga privilegios de um usuario ou role.",
        syntax: `REVOKE privilegio ON objeto FROM usuario;`,
        pgExample: `-- Revogar todos os privilegios
REVOKE ALL PRIVILEGES ON DATABASE loja FROM app_user;

-- Revogar permissao especifica
REVOKE INSERT, UPDATE ON produtos FROM app_user;

-- Revogar de todas as tabelas
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;`,
        mysqlExample: `-- Revogar todos os privilegios
REVOKE ALL PRIVILEGES ON loja.* FROM 'app_user'@'%';

-- Revogar permissao especifica
REVOKE INSERT, UPDATE ON loja.produtos FROM 'app_user'@'%';

FLUSH PRIVILEGES;`,
        engine: "both",
      },
      // ALTER USER / ROLE
      {
        name: "ALTER USER / ALTER ROLE",
        description: "Modifica propriedades de um usuario ou role.",
        syntax: "ALTER USER nome ... ;",
        pgExample: `-- Alterar senha
ALTER USER app_user WITH PASSWORD 'NovaSenha456!';

-- Alterar role
ALTER ROLE app_user WITH CREATEDB;

-- Definir parametro para role
ALTER ROLE app_user SET search_path TO vendas, public;

-- Renomear
ALTER USER app_user RENAME TO api_user;`,
        mysqlExample: `-- Alterar senha
ALTER USER 'app_user'@'%'
  IDENTIFIED BY 'NovaSenha456!';

-- Bloquear conta
ALTER USER 'app_user'@'%' ACCOUNT LOCK;

-- Desbloquear
ALTER USER 'app_user'@'%' ACCOUNT UNLOCK;

-- Expirar senha
ALTER USER 'app_user'@'%' PASSWORD EXPIRE;

-- Renomear
RENAME USER 'app_user'@'%' TO 'api_user'@'%';`,
        engine: "both",
      },
    ],
  },

  // ── TCL ──────────────────────────────────────────────────────────────────
  {
    id: "tcl",
    label: "TCL - Transacoes",
    icon: GitBranch,
    commands: [
      // BEGIN
      {
        name: "BEGIN / START TRANSACTION",
        description:
          "Inicia uma nova transacao. Todas as operacoes seguintes serao atomicas.",
        syntax: "BEGIN; -- ou START TRANSACTION;",
        pgExample: `BEGIN;

UPDATE contas SET saldo = saldo - 500 WHERE id = 1;
UPDATE contas SET saldo = saldo + 500 WHERE id = 2;

COMMIT;

-- Transacao com isolamento (PG)
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- ... operacoes ...
COMMIT;`,
        mysqlExample: `START TRANSACTION;

UPDATE contas SET saldo = saldo - 500 WHERE id = 1;
UPDATE contas SET saldo = saldo + 500 WHERE id = 2;

COMMIT;

-- MySQL: desabilitar autocommit
SET autocommit = 0;
-- ... operacoes ...
COMMIT;
SET autocommit = 1;`,
        engine: "both",
      },
      // COMMIT
      {
        name: "COMMIT",
        description:
          "Confirma todas as operacoes da transacao atual, tornando-as permanentes.",
        syntax: "COMMIT;",
        commonExample: `BEGIN;
INSERT INTO pedidos (cliente_id, total)
VALUES (1, 299.90);
INSERT INTO itens_pedido (pedido_id, produto_id, qtd)
VALUES (LASTVAL(), 5, 2);
COMMIT; -- Tudo salvo permanentemente`,
        engine: "both",
      },
      // ROLLBACK
      {
        name: "ROLLBACK",
        description:
          "Desfaz todas as operacoes da transacao atual.",
        syntax: "ROLLBACK;",
        commonExample: `BEGIN;
DELETE FROM produtos WHERE categoria_id = 5;
-- Ops! Nao era isso que eu queria
ROLLBACK; -- Nada foi deletado`,
        engine: "both",
      },
      // SAVEPOINT
      {
        name: "SAVEPOINT",
        description:
          "Cria um ponto de restauracao dentro de uma transacao.",
        syntax: "SAVEPOINT nome_savepoint;",
        commonExample: `BEGIN;

INSERT INTO pedidos (cliente_id, total) VALUES (1, 100);
SAVEPOINT sp_pedido_criado;

INSERT INTO itens_pedido (pedido_id, produto_id, qtd)
VALUES (1, 999, 1); -- produto 999 nao existe, deu erro

ROLLBACK TO SAVEPOINT sp_pedido_criado;
-- Pedido ainda existe, mas o item com erro foi desfeito

INSERT INTO itens_pedido (pedido_id, produto_id, qtd)
VALUES (1, 5, 1); -- agora o correto

COMMIT;`,
        engine: "both",
      },
      // RELEASE SAVEPOINT
      {
        name: "RELEASE SAVEPOINT",
        description:
          "Remove um savepoint, liberando recursos. As operacoes feitas apos o savepoint permanecem.",
        syntax: "RELEASE SAVEPOINT nome_savepoint;",
        commonExample: `BEGIN;
SAVEPOINT sp1;
INSERT INTO logs (msg) VALUES ('passo 1');
RELEASE SAVEPOINT sp1;
-- sp1 nao existe mais, mas o INSERT permanece
COMMIT;`,
        engine: "both",
      },
    ],
  },

  // ── Utility ──────────────────────────────────────────────────────────────
  {
    id: "utility",
    label: "Utilitarios",
    icon: Wrench,
    commands: [
      // EXPLAIN
      {
        name: "EXPLAIN / EXPLAIN ANALYZE",
        description:
          "Mostra o plano de execucao de uma consulta. ANALYZE executa de fato e mostra tempos reais.",
        syntax: "EXPLAIN [ANALYZE] SELECT ...;",
        pgExample: `-- Plano estimado
EXPLAIN SELECT * FROM produtos WHERE preco > 100;

-- Plano com execucao real
EXPLAIN ANALYZE SELECT * FROM produtos
WHERE preco > 100;

-- Formato detalhado (PG)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT p.nome, c.nome
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id;`,
        mysqlExample: `-- Plano de execucao
EXPLAIN SELECT * FROM produtos WHERE preco > 100;

-- Formato JSON (MySQL 5.7+)
EXPLAIN FORMAT=JSON
SELECT * FROM produtos WHERE preco > 100;

-- Analyze (MySQL 8.0.18+)
EXPLAIN ANALYZE
SELECT * FROM produtos WHERE preco > 100;`,
        engine: "both",
      },
      // VACUUM / OPTIMIZE
      {
        name: "VACUUM (PG) / OPTIMIZE TABLE (MySQL)",
        description:
          "Recupera espaco em disco e atualiza estatisticas. Essencial para performance.",
        syntax: `-- PG: VACUUM [FULL] [ANALYZE] tabela;
-- MySQL: OPTIMIZE TABLE tabela;`,
        pgExample: `-- Vacuum basico (nao bloqueia)
VACUUM produtos;

-- Vacuum com analise de estatisticas
VACUUM ANALYZE produtos;

-- Vacuum full (bloqueia a tabela, recupera mais espaco)
VACUUM FULL produtos;

-- Vacuum em todo o banco
VACUUM;`,
        mysqlExample: `-- Otimizar tabela (InnoDB - recria tabela)
OPTIMIZE TABLE produtos;

-- Otimizar multiplas tabelas
OPTIMIZE TABLE produtos, pedidos, clientes;`,
        engine: "both",
      },
      // ANALYZE
      {
        name: "ANALYZE",
        description:
          "Atualiza as estatisticas do planejador de consultas para otimizar performance.",
        syntax: "ANALYZE [tabela];",
        pgExample: `-- Analisar tabela especifica
ANALYZE produtos;

-- Analisar coluna especifica
ANALYZE produtos (preco, nome);

-- Analisar todas as tabelas
ANALYZE;`,
        mysqlExample: `-- Analisar tabela
ANALYZE TABLE produtos;

-- Analisar multiplas tabelas
ANALYZE TABLE produtos, pedidos;`,
        engine: "both",
      },
      // SHOW / pg_settings
      {
        name: "SHOW (MySQL) / pg_settings (PG)",
        description:
          "Exibe configuracoes e informacoes do servidor.",
        syntax: `-- PG: SHOW parametro; / SELECT FROM pg_settings
-- MySQL: SHOW VARIABLES / SHOW STATUS`,
        pgExample: `-- Ver parametro especifico
SHOW work_mem;
SHOW max_connections;
SHOW shared_buffers;

-- Listar todas as configuracoes
SELECT name, setting, unit, short_desc
FROM pg_settings
ORDER BY name;

-- Configuracoes alteradas
SELECT name, setting, boot_val
FROM pg_settings
WHERE setting != boot_val;

-- Ver tabelas
\\dt
-- ou
SELECT tablename FROM pg_tables
WHERE schemaname = 'public';

-- Ver tamanho do banco
SELECT pg_size_pretty(pg_database_size('loja'));`,
        mysqlExample: `-- Ver variaveis
SHOW VARIABLES LIKE 'max_connections';
SHOW VARIABLES LIKE '%buffer%';

-- Ver status do servidor
SHOW STATUS LIKE 'Threads_connected';
SHOW GLOBAL STATUS;

-- Ver tabelas
SHOW TABLES;
SHOW FULL TABLES;

-- Ver colunas
SHOW COLUMNS FROM produtos;
DESCRIBE produtos;

-- Ver processos ativos
SHOW PROCESSLIST;

-- Ver tamanho dos bancos
SELECT table_schema AS banco,
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'MB'
FROM information_schema.tables
GROUP BY table_schema;`,
        engine: "both",
      },
      // COPY / LOAD DATA
      {
        name: "COPY (PG) / LOAD DATA (MySQL)",
        description:
          "Importa/exporta dados em massa de/para arquivos CSV.",
        syntax: `-- PG: COPY tabela FROM/TO 'arquivo';
-- MySQL: LOAD DATA INFILE 'arquivo' INTO TABLE ...;`,
        pgExample: `-- Exportar para CSV
COPY produtos TO '/tmp/produtos.csv'
  WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- Importar de CSV
COPY produtos (nome, preco, categoria_id)
FROM '/tmp/import.csv'
WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- Usando STDIN (util com psql)
\\copy produtos TO 'produtos.csv' CSV HEADER

-- Exportar consulta
COPY (SELECT * FROM produtos WHERE preco > 100)
TO '/tmp/caros.csv'
WITH (FORMAT CSV, HEADER);`,
        mysqlExample: `-- Importar de CSV
LOAD DATA INFILE '/tmp/import.csv'
INTO TABLE produtos
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
IGNORE 1 ROWS
(nome, preco, categoria_id);

-- Exportar para CSV
SELECT * FROM produtos
INTO OUTFILE '/tmp/produtos.csv'
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\\n';

-- Importar de arquivo local
LOAD DATA LOCAL INFILE '/home/user/dados.csv'
INTO TABLE produtos
FIELDS TERMINATED BY ','
IGNORE 1 ROWS;`,
        engine: "both",
      },
      // pg_dump / mysqldump
      {
        name: "pg_dump / mysqldump (CLI)",
        description:
          "Ferramentas de linha de comando para backup e restauracao de bancos.",
        syntax: `-- PG: pg_dump / pg_restore
-- MySQL: mysqldump / mysql`,
        pgExample: `# Backup completo (SQL)
pg_dump -U admin -d loja > backup_loja.sql

# Backup comprimido (custom format)
pg_dump -U admin -Fc -d loja -f backup_loja.dump

# Backup apenas estrutura
pg_dump -U admin -s -d loja > schema_loja.sql

# Backup apenas dados
pg_dump -U admin -a -d loja > dados_loja.sql

# Backup de tabela especifica
pg_dump -U admin -t produtos -d loja > produtos.sql

# Restaurar SQL
psql -U admin -d loja < backup_loja.sql

# Restaurar custom format
pg_restore -U admin -d loja backup_loja.dump

# Backup de todos os bancos
pg_dumpall -U admin > todos_bancos.sql`,
        mysqlExample: `# Backup completo
mysqldump -u admin -p loja > backup_loja.sql

# Backup comprimido
mysqldump -u admin -p loja | gzip > backup.sql.gz

# Backup apenas estrutura
mysqldump -u admin -p --no-data loja > schema.sql

# Backup apenas dados
mysqldump -u admin -p --no-create-info loja > dados.sql

# Backup de tabela especifica
mysqldump -u admin -p loja produtos > produtos.sql

# Restaurar
mysql -u admin -p loja < backup_loja.sql

# Restaurar de gzip
gunzip < backup.sql.gz | mysql -u admin -p loja

# Backup de todos os bancos
mysqldump -u admin -p --all-databases > todos.sql`,
        engine: "both",
      },
      // CTE
      {
        name: "CTE (Common Table Expressions)",
        description:
          "Expressoes de tabela comuns - consultas nomeadas reutilizaveis em um mesmo statement.",
        syntax: `WITH nome_cte AS (
  SELECT ...
)
SELECT * FROM nome_cte;`,
        pgExample: `-- CTE simples
WITH vendas_mes AS (
  SELECT produto_id, SUM(total) AS total_vendas
  FROM pedidos
  WHERE data >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY produto_id
)
SELECT p.nome, vm.total_vendas
FROM produtos p
JOIN vendas_mes vm ON vm.produto_id = p.id
ORDER BY vm.total_vendas DESC;

-- CTE recursiva (arvore de categorias)
WITH RECURSIVE arvore AS (
  SELECT id, nome, pai_id, 1 AS nivel
  FROM categorias WHERE pai_id IS NULL
  UNION ALL
  SELECT c.id, c.nome, c.pai_id, a.nivel + 1
  FROM categorias c
  JOIN arvore a ON a.id = c.pai_id
)
SELECT * FROM arvore ORDER BY nivel, nome;`,
        mysqlExample: `-- CTE simples (MySQL 8.0+)
WITH vendas_mes AS (
  SELECT produto_id, SUM(total) AS total_vendas
  FROM pedidos
  WHERE data >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  GROUP BY produto_id
)
SELECT p.nome, vm.total_vendas
FROM produtos p
JOIN vendas_mes vm ON vm.produto_id = p.id
ORDER BY vm.total_vendas DESC;

-- CTE recursiva (MySQL 8.0+)
WITH RECURSIVE arvore AS (
  SELECT id, nome, pai_id, 1 AS nivel
  FROM categorias WHERE pai_id IS NULL
  UNION ALL
  SELECT c.id, c.nome, c.pai_id, a.nivel + 1
  FROM categorias c
  JOIN arvore a ON a.id = c.pai_id
)
SELECT * FROM arvore ORDER BY nivel, nome;`,
        engine: "both",
      },
      // Window Functions
      {
        name: "Window Functions",
        description:
          "Funcoes de janela para calculos sobre conjuntos de linhas relacionadas.",
        syntax: `SELECT col,
  funcao() OVER (
    [PARTITION BY col]
    [ORDER BY col]
    [ROWS/RANGE ...]
  )
FROM tabela;`,
        commonExample: `-- Numero da linha
SELECT nome, preco,
  ROW_NUMBER() OVER (ORDER BY preco DESC) AS posicao
FROM produtos;

-- Ranking por categoria
SELECT nome, categoria_id, preco,
  RANK() OVER (
    PARTITION BY categoria_id
    ORDER BY preco DESC
  ) AS rank_categoria
FROM produtos;

-- Media movel
SELECT data, valor,
  AVG(valor) OVER (
    ORDER BY data
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS media_7dias
FROM vendas;

-- Acumulado
SELECT data, valor,
  SUM(valor) OVER (
    ORDER BY data
    ROWS UNBOUNDED PRECEDING
  ) AS acumulado
FROM vendas;

-- Lead / Lag
SELECT data, valor,
  LAG(valor, 1) OVER (ORDER BY data) AS anterior,
  LEAD(valor, 1) OVER (ORDER BY data) AS proximo
FROM vendas;`,
        engine: "both",
      },
      // JSON
      {
        name: "Funcoes JSON",
        description:
          "Operacoes com dados JSON armazenados no banco de dados.",
        syntax: `-- PG: JSONB com operadores ->  ->>  @>  ?
-- MySQL: JSON com funcoes JSON_*`,
        pgExample: `-- Criar tabela com JSONB
CREATE TABLE configs (
  id SERIAL PRIMARY KEY,
  dados JSONB NOT NULL DEFAULT '{}'
);

-- Inserir
INSERT INTO configs (dados)
VALUES ('{"tema": "dark", "idioma": "pt-BR"}');

-- Consultar campo
SELECT dados->>'tema' AS tema FROM configs;

-- Filtrar por valor JSON
SELECT * FROM configs
WHERE dados @> '{"idioma": "pt-BR"}';

-- Atualizar campo JSON
UPDATE configs
SET dados = jsonb_set(dados, '{tema}', '"light"')
WHERE id = 1;

-- Agregar para JSON
SELECT jsonb_agg(
  jsonb_build_object('id', id, 'nome', nome)
) FROM produtos;`,
        mysqlExample: `-- Criar tabela com JSON
CREATE TABLE configs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dados JSON NOT NULL
);

-- Inserir
INSERT INTO configs (dados)
VALUES ('{"tema": "dark", "idioma": "pt-BR"}');

-- Consultar campo
SELECT JSON_EXTRACT(dados, '$.tema') AS tema
FROM configs;
-- ou: SELECT dados->>'$.tema' FROM configs;

-- Filtrar por valor
SELECT * FROM configs
WHERE JSON_EXTRACT(dados, '$.idioma') = 'pt-BR';

-- Atualizar campo JSON
UPDATE configs
SET dados = JSON_SET(dados, '$.tema', 'light')
WHERE id = 1;

-- Agregar para JSON
SELECT JSON_ARRAYAGG(
  JSON_OBJECT('id', id, 'nome', nome)
) FROM produtos;`,
        engine: "both",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

type DbFilter = "all" | "pg" | "mysql";

function filterCommands(
  cmds: SqlCommand[],
  search: string,
  dbFilter: DbFilter
): SqlCommand[] {
  return cmds.filter((cmd) => {
    // database filter
    if (dbFilter === "pg" && cmd.engine === "mysql") return false;
    if (dbFilter === "mysql" && cmd.engine === "pg") return false;

    // text search
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      cmd.name.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.syntax.toLowerCase().includes(q) ||
      (cmd.pgExample && cmd.pgExample.toLowerCase().includes(q)) ||
      (cmd.mysqlExample && cmd.mysqlExample.toLowerCase().includes(q)) ||
      (cmd.commonExample && cmd.commonExample.toLowerCase().includes(q))
    );
  });
}

// ---------------------------------------------------------------------------
// Command Card component
// ---------------------------------------------------------------------------

function CommandCard({ cmd, dbFilter }: { cmd: SqlCommand; dbFilter: DbFilter }) {
  const showPg = dbFilter !== "mysql";
  const showMysql = dbFilter !== "pg";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Code2 className="h-4 w-4 shrink-0 text-primary" />
            {cmd.name}
          </CardTitle>
          {engineBadge(cmd.engine)}
        </div>
        <p className="text-sm text-muted-foreground">{cmd.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Syntax */}
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sintaxe
          </p>
          <pre className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-300">
            <code>{cmd.syntax}</code>
          </pre>
        </div>

        {/* Common example (when both engines share the same syntax) */}
        {cmd.commonExample && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Exemplo
            </p>
            <pre className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-300">
              <code>{cmd.commonExample}</code>
            </pre>
          </div>
        )}

        {/* PG example */}
        {cmd.pgExample && showPg && (
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <p className="text-xs font-medium uppercase tracking-wider text-blue-400">
                PostgreSQL
              </p>
            </div>
            <pre className="overflow-x-auto rounded-md border border-blue-500/10 bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-300">
              <code>{cmd.pgExample}</code>
            </pre>
          </div>
        )}

        {/* MySQL example */}
        {cmd.mysqlExample && showMysql && (
          <div>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              <p className="text-xs font-medium uppercase tracking-wider text-orange-400">
                MySQL / MariaDB
              </p>
            </div>
            <pre className="overflow-x-auto rounded-md border border-orange-500/10 bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-300">
              <code>{cmd.mysqlExample}</code>
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommandsPage() {
  const [search, setSearch] = useState("");
  const [dbFilter, setDbFilter] = useState<DbFilter>("all");
  const [activeTab, setActiveTab] = useState("ddl");

  // Count of matching commands per tab (for badges)
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const cat of categories) {
      result[cat.id] = filterCommands(cat.commands, search, dbFilter).length;
    }
    return result;
  }, [search, dbFilter]);

  const totalCommands = categories.reduce(
    (sum, cat) => sum + cat.commands.length,
    0
  );
  const filteredTotal = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Referencia de Comandos SQL
              </h1>
              <p className="text-sm text-muted-foreground">
                {totalCommands} comandos &middot; PostgreSQL &amp; MySQL / MariaDB
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar comandos, sintaxe ou palavras-chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* DB filter */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setDbFilter("all")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                dbFilter === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setDbFilter("pg")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                dbFilter === "pg"
                  ? "border-blue-500 bg-blue-500/15 text-blue-400"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
              PostgreSQL
            </button>
            <button
              onClick={() => setDbFilter("mysql")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                dbFilter === "mysql"
                  ? "border-orange-500 bg-orange-500/15 text-orange-400"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
              MySQL
            </button>
          </div>
        </div>

        {/* Results count */}
        {(search || dbFilter !== "all") && (
          <p className="text-sm text-muted-foreground">
            Exibindo{" "}
            <span className="font-medium text-foreground">{filteredTotal}</span>{" "}
            de {totalCommands} comandos
          </p>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full flex-wrap gap-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="flex items-center gap-1.5 text-xs sm:text-sm"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{cat.label}</span>
                  <span className="sm:hidden">
                    {cat.label.split(" - ")[1] || cat.label}
                  </span>
                  {counts[cat.id] !== undefined && (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-5 min-w-[20px] px-1 text-[10px]"
                    >
                      {counts[cat.id]}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {categories.map((cat) => {
            const filtered = filterCommands(cat.commands, search, dbFilter);
            return (
              <TabsContent key={cat.id} value={cat.id} className="mt-4">
                {filtered.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-12">
                      <Search className="h-10 w-10 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Nenhum comando encontrado para os filtros selecionados.
                      </p>
                      <button
                        onClick={() => {
                          setSearch("");
                          setDbFilter("all");
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        Limpar filtros
                      </button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {filtered.map((cmd) => (
                      <CommandCard
                        key={cmd.name}
                        cmd={cmd}
                        dbFilter={dbFilter}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AppShell>
  );
}
