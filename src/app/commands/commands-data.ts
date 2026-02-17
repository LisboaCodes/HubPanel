import {
  Database,
  Code2,
  Shield,
  GitBranch,
  Wrench,
  FunctionSquare,
  Layers,
  type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DbEngine = "pg" | "mysql" | "both";

export interface SqlCommand {
  name: string;
  description: string;
  syntax: string;
  pgExample?: string;
  mysqlExample?: string;
  commonExample?: string;
  engine: DbEngine;
}

export interface CommandCategory {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  commands: SqlCommand[];
}

// ---------------------------------------------------------------------------
// Categories & Commands
// ---------------------------------------------------------------------------

export const categories: CommandCategory[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DDL - Data Definition Language
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "ddl",
    label: "DDL - Definicao de Dados",
    shortLabel: "DDL",
    icon: Database,
    commands: [
      {
        name: "CREATE DATABASE",
        description: "Cria um novo banco de dados no servidor.",
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
      {
        name: "DROP DATABASE",
        description: "Remove um banco de dados inteiro e todos os seus objetos.",
        syntax: "DROP DATABASE [IF EXISTS] nome_banco;",
        commonExample: "DROP DATABASE IF EXISTS loja;",
        engine: "both",
      },
      {
        name: "ALTER DATABASE",
        description: "Altera propriedades de um banco de dados existente.",
        syntax: "ALTER DATABASE nome_banco SET ...;",
        pgExample: `ALTER DATABASE loja SET timezone TO 'America/Sao_Paulo';
ALTER DATABASE loja SET default_transaction_isolation TO 'read committed';`,
        mysqlExample: `ALTER DATABASE loja
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;`,
        engine: "both",
      },
      {
        name: "CREATE TABLE",
        description: "Cria uma nova tabela com colunas, tipos e constraints.",
        syntax: `CREATE TABLE nome (
  coluna tipo [constraints],
  ...
);`,
        pgExample: `CREATE TABLE produtos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  preco NUMERIC(10,2) DEFAULT 0 CHECK (preco >= 0),
  ativo BOOLEAN DEFAULT true,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  categoria_id INT REFERENCES categorias(id) ON DELETE SET NULL
);`,
        mysqlExample: `CREATE TABLE produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  preco DECIMAL(10,2) DEFAULT 0 CHECK (preco >= 0),
  ativo TINYINT(1) DEFAULT 1,
  metadata JSON,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  categoria_id INT,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
        engine: "both",
      },
      {
        name: "CREATE TABLE AS",
        description: "Cria uma tabela a partir do resultado de uma consulta.",
        syntax: "CREATE TABLE nova AS SELECT ... FROM existente;",
        pgExample: `CREATE TABLE produtos_backup AS
SELECT * FROM produtos WHERE ativo = true;

-- Com tabela vazia (apenas estrutura)
CREATE TABLE produtos_vazio AS
SELECT * FROM produtos WHERE false;`,
        mysqlExample: `CREATE TABLE produtos_backup AS
SELECT * FROM produtos WHERE ativo = 1;

-- Copiar apenas estrutura
CREATE TABLE produtos_vazio LIKE produtos;`,
        engine: "both",
      },
      {
        name: "DROP TABLE",
        description: "Remove uma tabela e todos os seus dados permanentemente.",
        syntax: "DROP TABLE [IF EXISTS] nome [CASCADE];",
        pgExample: "DROP TABLE IF EXISTS produtos CASCADE;",
        mysqlExample: "DROP TABLE IF EXISTS produtos;",
        engine: "both",
      },
      {
        name: "ALTER TABLE",
        description: "Modifica estrutura de uma tabela: colunas, constraints, etc.",
        syntax: `ALTER TABLE tabela
  ADD COLUMN col tipo,
  DROP COLUMN col,
  RENAME COLUMN col TO novo;`,
        pgExample: `-- Adicionar coluna
ALTER TABLE produtos ADD COLUMN estoque INT DEFAULT 0;

-- Renomear coluna
ALTER TABLE produtos RENAME COLUMN preco TO valor;

-- Alterar tipo
ALTER TABLE produtos ALTER COLUMN nome TYPE TEXT;

-- NOT NULL
ALTER TABLE produtos ALTER COLUMN nome SET NOT NULL;
ALTER TABLE produtos ALTER COLUMN nome DROP NOT NULL;

-- Default
ALTER TABLE produtos ALTER COLUMN ativo SET DEFAULT true;

-- Adicionar constraint
ALTER TABLE produtos ADD CONSTRAINT chk_valor CHECK (valor >= 0);
ALTER TABLE produtos ADD CONSTRAINT uq_nome UNIQUE (nome);

-- Remover constraint
ALTER TABLE produtos DROP CONSTRAINT chk_valor;

-- Renomear tabela
ALTER TABLE produtos RENAME TO itens;`,
        mysqlExample: `-- Adicionar coluna
ALTER TABLE produtos ADD COLUMN estoque INT DEFAULT 0;

-- Renomear coluna (MySQL 8+)
ALTER TABLE produtos RENAME COLUMN preco TO valor;

-- Alterar tipo
ALTER TABLE produtos MODIFY COLUMN nome TEXT;

-- Mudar nome e tipo ao mesmo tempo
ALTER TABLE produtos CHANGE preco valor DECIMAL(10,2);

-- Adicionar constraint
ALTER TABLE produtos ADD CONSTRAINT chk_valor CHECK (valor >= 0);
ALTER TABLE produtos ADD UNIQUE INDEX uq_nome (nome);

-- Remover constraint
ALTER TABLE produtos DROP CHECK chk_valor;

-- Renomear tabela
ALTER TABLE produtos RENAME TO itens;
-- ou: RENAME TABLE produtos TO itens;`,
        engine: "both",
      },
      {
        name: "TRUNCATE TABLE",
        description: "Remove TODOS os registros de forma rapida (sem log por linha). Mais rapido que DELETE.",
        syntax: "TRUNCATE TABLE nome [RESTART IDENTITY] [CASCADE];",
        pgExample: `TRUNCATE TABLE pedidos RESTART IDENTITY CASCADE;

-- Truncar varias tabelas
TRUNCATE TABLE pedidos, itens_pedido RESTART IDENTITY;`,
        mysqlExample: `TRUNCATE TABLE pedidos;

-- MySQL nao suporta CASCADE em TRUNCATE
-- Desabilitar FK checks temporariamente:
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE pedidos;
TRUNCATE TABLE itens_pedido;
SET FOREIGN_KEY_CHECKS = 1;`,
        engine: "both",
      },
      {
        name: "CREATE INDEX",
        description: "Cria um indice para acelerar consultas. Essencial para performance.",
        syntax: "CREATE [UNIQUE] INDEX nome ON tabela (coluna [, ...]);",
        pgExample: `-- Indice B-tree (padrao)
CREATE INDEX idx_produtos_nome ON produtos (nome);

-- Indice unico
CREATE UNIQUE INDEX idx_produtos_sku ON produtos (sku);

-- Indice composto
CREATE INDEX idx_pedido ON pedidos (cliente_id, data_pedido DESC);

-- Indice parcial (filtra registros)
CREATE INDEX idx_ativos ON produtos (nome) WHERE ativo = true;

-- Indice GIN (JSONB, arrays, full-text)
CREATE INDEX idx_tags ON produtos USING GIN (tags);
CREATE INDEX idx_meta ON produtos USING GIN (metadata jsonb_path_ops);

-- Indice GiST (geoespacial, range)
CREATE INDEX idx_geo ON locais USING GIST (coordenadas);

-- Indice BRIN (dados ordenados, tabelas grandes)
CREATE INDEX idx_data ON logs USING BRIN (criado_em);

-- Indice hash
CREATE INDEX idx_hash ON sessoes USING HASH (token);

-- Indice de expressao
CREATE INDEX idx_lower_email ON users (LOWER(email));`,
        mysqlExample: `-- Indice B-tree (padrao)
CREATE INDEX idx_produtos_nome ON produtos (nome);

-- Indice unico
CREATE UNIQUE INDEX idx_produtos_sku ON produtos (sku);

-- Indice composto
CREATE INDEX idx_pedido ON pedidos (cliente_id, data_pedido);

-- Indice com prefixo (para TEXT/BLOB)
CREATE INDEX idx_desc ON produtos (descricao(100));

-- Indice FULLTEXT
CREATE FULLTEXT INDEX idx_ft ON produtos (nome, descricao);

-- Indice espacial
CREATE SPATIAL INDEX idx_geo ON locais (coordenadas);

-- Indice invisivel (MySQL 8+, para testar impacto)
CREATE INDEX idx_test ON produtos (preco) INVISIBLE;
ALTER TABLE produtos ALTER INDEX idx_test VISIBLE;`,
        engine: "both",
      },
      {
        name: "DROP INDEX",
        description: "Remove um indice existente.",
        syntax: "DROP INDEX [IF EXISTS] nome;",
        pgExample: `DROP INDEX IF EXISTS idx_produtos_nome;
DROP INDEX CONCURRENTLY idx_produtos_nome; -- sem bloquear tabela`,
        mysqlExample: `DROP INDEX idx_produtos_nome ON produtos;
ALTER TABLE produtos DROP INDEX idx_produtos_nome;`,
        engine: "both",
      },
      {
        name: "CREATE VIEW",
        description: "Cria uma view (tabela virtual baseada em consulta). Nao armazena dados.",
        syntax: "CREATE [OR REPLACE] VIEW nome AS SELECT ...;",
        pgExample: `CREATE OR REPLACE VIEW vw_produtos_ativos AS
SELECT p.id, p.nome, p.preco, c.nome AS categoria
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id
WHERE p.ativo = true;

-- Usar como tabela normal
SELECT * FROM vw_produtos_ativos WHERE preco > 100;`,
        mysqlExample: `CREATE OR REPLACE VIEW vw_produtos_ativos AS
SELECT p.id, p.nome, p.preco, c.nome AS categoria
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id
WHERE p.ativo = 1;

SELECT * FROM vw_produtos_ativos WHERE preco > 100;`,
        engine: "both",
      },
      {
        name: "CREATE MATERIALIZED VIEW",
        description: "View que armazena dados fisicamente. Precisa de REFRESH para atualizar. Ideal para consultas pesadas.",
        syntax: `CREATE MATERIALIZED VIEW nome AS SELECT ...;
REFRESH MATERIALIZED VIEW nome;`,
        pgExample: `-- Criar
CREATE MATERIALIZED VIEW mv_vendas_mes AS
SELECT
  DATE_TRUNC('month', data) AS mes,
  SUM(total) AS total_vendas,
  COUNT(*) AS num_pedidos
FROM pedidos
GROUP BY DATE_TRUNC('month', data);

-- Atualizar dados
REFRESH MATERIALIZED VIEW mv_vendas_mes;

-- Atualizar sem bloquear leitura
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendas_mes;

-- Criar indice na materialized view
CREATE UNIQUE INDEX idx_mv_mes ON mv_vendas_mes (mes);`,
        engine: "pg",
      },
      {
        name: "CREATE SEQUENCE",
        description: "Cria um gerador de numeros sequenciais (auto-incremento customizado).",
        syntax: "CREATE SEQUENCE nome [START n] [INCREMENT n];",
        pgExample: `-- Criar sequence
CREATE SEQUENCE pedido_seq START 1000 INCREMENT 1;

-- Usar
SELECT nextval('pedido_seq'); -- 1000
SELECT nextval('pedido_seq'); -- 1001
SELECT currval('pedido_seq'); -- 1001

-- Usar em INSERT
INSERT INTO pedidos (id, descricao)
VALUES (nextval('pedido_seq'), 'Pedido novo');

-- Resetar
ALTER SEQUENCE pedido_seq RESTART WITH 1;

-- Associar a coluna
ALTER SEQUENCE pedido_seq OWNED BY pedidos.id;`,
        engine: "pg",
      },
      {
        name: "CREATE TYPE / ENUM",
        description: "Cria um tipo customizado ou enumeracao.",
        syntax: "CREATE TYPE nome AS ENUM ('val1', 'val2');",
        pgExample: `-- Enum
CREATE TYPE status_pedido AS ENUM (
  'pendente', 'processando', 'enviado', 'entregue', 'cancelado'
);

-- Usar em tabela
CREATE TABLE pedidos (
  id SERIAL PRIMARY KEY,
  status status_pedido DEFAULT 'pendente'
);

-- Adicionar valor ao enum
ALTER TYPE status_pedido ADD VALUE 'devolvido' AFTER 'entregue';

-- Tipo composto
CREATE TYPE endereco AS (
  rua TEXT,
  numero INT,
  cidade TEXT,
  estado CHAR(2),
  cep VARCHAR(9)
);`,
        mysqlExample: `-- Enum direto na coluna
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  status ENUM('pendente','processando','enviado',
              'entregue','cancelado') DEFAULT 'pendente'
);

-- SET (multiplos valores)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  permissoes SET('ler','escrever','deletar','admin')
);
INSERT INTO users (permissoes) VALUES ('ler,escrever');`,
        engine: "both",
      },
      {
        name: "CREATE SCHEMA",
        description: "Cria um namespace para organizar objetos do banco.",
        syntax: "CREATE SCHEMA [IF NOT EXISTS] nome;",
        pgExample: `CREATE SCHEMA IF NOT EXISTS vendas AUTHORIZATION admin;

-- Tabela dentro do schema
CREATE TABLE vendas.pedidos (
  id SERIAL PRIMARY KEY,
  total NUMERIC(10,2)
);

-- Acessar
SELECT * FROM vendas.pedidos;

-- Alterar search_path
SET search_path TO vendas, public;`,
        mysqlExample: `-- Em MySQL, schema = database
CREATE DATABASE IF NOT EXISTS vendas;
USE vendas;`,
        engine: "both",
      },
      {
        name: "CREATE TRIGGER",
        description: "Cria um trigger que executa automaticamente em INSERT, UPDATE ou DELETE.",
        syntax: "CREATE TRIGGER nome BEFORE|AFTER INSERT|UPDATE|DELETE ON tabela ...;",
        pgExample: `-- Funcao do trigger
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trg_atualizar_timestamp
  BEFORE UPDATE ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_timestamp();

-- Trigger com condicao
CREATE TRIGGER trg_log_preco
  AFTER UPDATE OF preco ON produtos
  FOR EACH ROW
  WHEN (OLD.preco IS DISTINCT FROM NEW.preco)
  EXECUTE FUNCTION log_mudanca_preco();

-- Remover
DROP TRIGGER trg_atualizar_timestamp ON produtos;`,
        mysqlExample: `-- Trigger BEFORE UPDATE
DELIMITER //
CREATE TRIGGER trg_atualizar_timestamp
  BEFORE UPDATE ON produtos
  FOR EACH ROW
BEGIN
  SET NEW.atualizado_em = NOW();
END //
DELIMITER ;

-- Trigger AFTER INSERT (log)
DELIMITER //
CREATE TRIGGER trg_log_insert
  AFTER INSERT ON produtos
  FOR EACH ROW
BEGIN
  INSERT INTO audit_log (tabela, acao, registro_id, data)
  VALUES ('produtos', 'INSERT', NEW.id, NOW());
END //
DELIMITER ;

-- Remover
DROP TRIGGER IF EXISTS trg_atualizar_timestamp;`,
        engine: "both",
      },
      {
        name: "CREATE FUNCTION / PROCEDURE",
        description: "Cria funcoes e procedures armazenadas no banco.",
        syntax: "CREATE FUNCTION nome(params) RETURNS tipo AS $$ ... $$;",
        pgExample: `-- Funcao que retorna valor
CREATE OR REPLACE FUNCTION calcular_desconto(
  preco NUMERIC,
  percentual NUMERIC
) RETURNS NUMERIC AS $$
BEGIN
  RETURN preco - (preco * percentual / 100);
END;
$$ LANGUAGE plpgsql;

-- Usar
SELECT calcular_desconto(100, 15); -- 85

-- Funcao que retorna tabela
CREATE OR REPLACE FUNCTION buscar_produtos(termo TEXT)
RETURNS TABLE(id INT, nome TEXT, preco NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nome, p.preco
  FROM produtos p
  WHERE p.nome ILIKE '%' || termo || '%';
END;
$$ LANGUAGE plpgsql;

-- Procedure (PG 11+)
CREATE OR REPLACE PROCEDURE transferir(
  de_conta INT, para_conta INT, valor NUMERIC
) AS $$
BEGIN
  UPDATE contas SET saldo = saldo - valor WHERE id = de_conta;
  UPDATE contas SET saldo = saldo + valor WHERE id = para_conta;
  COMMIT;
END;
$$ LANGUAGE plpgsql;

CALL transferir(1, 2, 500.00);`,
        mysqlExample: `-- Funcao
DELIMITER //
CREATE FUNCTION calcular_desconto(
  preco DECIMAL(10,2),
  percentual DECIMAL(5,2)
) RETURNS DECIMAL(10,2)
DETERMINISTIC
BEGIN
  RETURN preco - (preco * percentual / 100);
END //
DELIMITER ;

SELECT calcular_desconto(100, 15); -- 85

-- Procedure
DELIMITER //
CREATE PROCEDURE transferir(
  IN de_conta INT,
  IN para_conta INT,
  IN valor DECIMAL(10,2)
)
BEGIN
  START TRANSACTION;
  UPDATE contas SET saldo = saldo - valor WHERE id = de_conta;
  UPDATE contas SET saldo = saldo + valor WHERE id = para_conta;
  COMMIT;
END //
DELIMITER ;

CALL transferir(1, 2, 500.00);

-- Procedure com OUT param
DELIMITER //
CREATE PROCEDURE contar_produtos(OUT total INT)
BEGIN
  SELECT COUNT(*) INTO total FROM produtos;
END //
DELIMITER ;

CALL contar_produtos(@total);
SELECT @total;`,
        engine: "both",
      },
      {
        name: "CREATE EXTENSION",
        description: "Instala uma extensao no PostgreSQL (funcionalidades extras).",
        syntax: "CREATE EXTENSION [IF NOT EXISTS] nome;",
        pgExample: `-- Extensoes populares
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Criptografia
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Similaridade de texto
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- Remover acentos
CREATE EXTENSION IF NOT EXISTS "postgis";        -- Geoespacial
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Estatisticas de queries
CREATE EXTENSION IF NOT EXISTS "hstore";         -- Key-value
CREATE EXTENSION IF NOT EXISTS "citext";         -- Text case-insensitive

-- Usar uuid-ossp
SELECT uuid_generate_v4(); -- gera UUID aleatorio

-- Usar pg_trgm (busca fuzzy)
SELECT * FROM produtos
WHERE nome % 'notbook'  -- encontra "notebook"
ORDER BY similarity(nome, 'notbook') DESC;

-- Listar extensoes instaladas
SELECT * FROM pg_extension;`,
        engine: "pg",
      },
      {
        name: "COMMENT",
        description: "Adiciona comentarios/documentacao a objetos do banco.",
        syntax: "COMMENT ON tipo nome IS 'descricao';",
        pgExample: `COMMENT ON TABLE produtos IS 'Catalogo de produtos da loja';
COMMENT ON COLUMN produtos.sku IS 'Stock Keeping Unit - codigo unico';
COMMENT ON INDEX idx_produtos_nome IS 'Indice para busca por nome';
COMMENT ON FUNCTION calcular_desconto IS 'Calcula preco com desconto percentual';

-- Ver comentarios
SELECT obj_description('produtos'::regclass);`,
        mysqlExample: `-- Comentario na tabela
ALTER TABLE produtos COMMENT = 'Catalogo de produtos da loja';

-- Comentario na coluna
ALTER TABLE produtos
  MODIFY COLUMN sku VARCHAR(50) COMMENT 'Stock Keeping Unit';

-- Ver comentarios
SHOW FULL COLUMNS FROM produtos;
SHOW TABLE STATUS LIKE 'produtos';`,
        engine: "both",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DML - Data Manipulation Language
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "dml",
    label: "DML - Manipulacao de Dados",
    shortLabel: "DML",
    icon: Code2,
    commands: [
      {
        name: "SELECT",
        description: "Consulta dados. O comando mais usado em SQL. Suporta filtros, ordenacao, agrupamento e paginacao.",
        syntax: `SELECT [DISTINCT] colunas
FROM tabela
[WHERE condicao]
[GROUP BY colunas [HAVING condicao]]
[ORDER BY colunas [ASC|DESC]]
[LIMIT n OFFSET m];`,
        commonExample: `-- Basico
SELECT nome, preco FROM produtos WHERE preco > 50;

-- Com alias
SELECT p.nome AS produto, p.preco * 1.1 AS preco_com_imposto
FROM produtos p;

-- DISTINCT (valores unicos)
SELECT DISTINCT categoria_id FROM produtos;

-- Ordenacao
SELECT * FROM produtos ORDER BY preco DESC, nome ASC;

-- Paginacao
SELECT * FROM produtos ORDER BY id LIMIT 20 OFFSET 40;

-- Agregacao
SELECT categoria_id, COUNT(*) AS total,
       AVG(preco) AS media, MAX(preco) AS maior
FROM produtos
GROUP BY categoria_id
HAVING COUNT(*) > 5;

-- Subquery
SELECT * FROM produtos
WHERE preco > (SELECT AVG(preco) FROM produtos);`,
        engine: "both",
      },
      {
        name: "SELECT com JOINs",
        description: "Combina registros de tabelas relacionadas. INNER (ambos), LEFT (todos da esquerda), RIGHT, FULL, CROSS.",
        syntax: `SELECT ...
FROM a
[INNER] JOIN b ON a.id = b.a_id
LEFT JOIN c ON ...
RIGHT JOIN d ON ...
CROSS JOIN e;`,
        pgExample: `-- INNER JOIN (registros em ambas tabelas)
SELECT p.nome, c.nome AS categoria
FROM produtos p
INNER JOIN categorias c ON c.id = p.categoria_id;

-- LEFT JOIN (todos os produtos, mesmo sem categoria)
SELECT p.nome, COALESCE(c.nome, 'Sem categoria') AS categoria
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id;

-- FULL OUTER JOIN (todos de ambas)
SELECT p.nome, c.nome
FROM produtos p
FULL OUTER JOIN categorias c ON c.id = p.categoria_id;

-- CROSS JOIN (produto cartesiano)
SELECT c.nome AS cor, t.nome AS tamanho
FROM cores c CROSS JOIN tamanhos t;

-- Self JOIN
SELECT e.nome AS funcionario, g.nome AS gerente
FROM funcionarios e
LEFT JOIN funcionarios g ON g.id = e.gerente_id;

-- Multiplos JOINs
SELECT pe.id, cl.nome, pr.nome, pe.quantidade
FROM pedidos pe
JOIN clientes cl ON cl.id = pe.cliente_id
JOIN produtos pr ON pr.id = pe.produto_id
WHERE pe.data > '2025-01-01';

-- LATERAL JOIN (PG)
SELECT c.nome, ultimos.*
FROM clientes c
CROSS JOIN LATERAL (
  SELECT * FROM pedidos p
  WHERE p.cliente_id = c.id
  ORDER BY p.data DESC LIMIT 3
) ultimos;`,
        mysqlExample: `-- INNER JOIN
SELECT p.nome, c.nome AS categoria
FROM produtos p
INNER JOIN categorias c ON c.id = p.categoria_id;

-- LEFT JOIN
SELECT p.nome, COALESCE(c.nome, 'Sem categoria') AS categoria
FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id;

-- MySQL nao tem FULL OUTER JOIN nativo:
SELECT p.nome, c.nome FROM produtos p
LEFT JOIN categorias c ON c.id = p.categoria_id
UNION
SELECT p.nome, c.nome FROM produtos p
RIGHT JOIN categorias c ON c.id = p.categoria_id;

-- Self JOIN
SELECT e.nome AS funcionario, g.nome AS gerente
FROM funcionarios e
LEFT JOIN funcionarios g ON g.id = e.gerente_id;`,
        engine: "both",
      },
      {
        name: "UNION / INTERSECT / EXCEPT",
        description: "Combina resultados de multiplas consultas. UNION (todos), INTERSECT (comum), EXCEPT (diferenca).",
        syntax: `SELECT ... FROM a
UNION [ALL]     -- todos, sem/com duplicatas
SELECT ... FROM b;`,
        pgExample: `-- UNION (sem duplicatas)
SELECT nome, 'produto' AS tipo FROM produtos
UNION
SELECT nome, 'categoria' AS tipo FROM categorias;

-- UNION ALL (com duplicatas, mais rapido)
SELECT nome FROM clientes_sp
UNION ALL
SELECT nome FROM clientes_rj;

-- INTERSECT (apenas registros em ambas)
SELECT email FROM clientes
INTERSECT
SELECT email FROM newsletter;

-- EXCEPT (apenas no primeiro, nao no segundo)
SELECT email FROM clientes
EXCEPT
SELECT email FROM cancelados;`,
        mysqlExample: `-- UNION / UNION ALL
SELECT nome, 'produto' AS tipo FROM produtos
UNION
SELECT nome, 'categoria' AS tipo FROM categorias;

-- MySQL 8.0.31+ suporta INTERSECT e EXCEPT
SELECT email FROM clientes
INTERSECT
SELECT email FROM newsletter;

SELECT email FROM clientes
EXCEPT
SELECT email FROM cancelados;

-- Versoes antigas: usar JOINs
SELECT DISTINCT c.email
FROM clientes c
INNER JOIN newsletter n ON n.email = c.email;`,
        engine: "both",
      },
      {
        name: "INSERT",
        description: "Insere novos registros em uma tabela.",
        syntax: `INSERT INTO tabela (col1, col2)
VALUES (val1, val2);`,
        pgExample: `-- Inserir um registro
INSERT INTO produtos (nome, preco) VALUES ('Notebook', 3500.00);

-- Inserir varios
INSERT INTO produtos (nome, preco) VALUES
  ('Mouse', 89.90),
  ('Teclado', 199.90),
  ('Monitor', 1200.00);

-- Retornar dados inseridos (PG)
INSERT INTO produtos (nome, preco)
VALUES ('Webcam', 299.90)
RETURNING id, nome, criado_em;

-- Inserir de outra tabela
INSERT INTO produtos_destaque (nome, preco)
SELECT nome, preco FROM produtos WHERE preco > 500;

-- Inserir com DEFAULT
INSERT INTO produtos (nome) VALUES ('Teste');`,
        mysqlExample: `-- Inserir um registro
INSERT INTO produtos (nome, preco) VALUES ('Notebook', 3500.00);

-- Inserir varios
INSERT INTO produtos (nome, preco) VALUES
  ('Mouse', 89.90),
  ('Teclado', 199.90),
  ('Monitor', 1200.00);

-- Obter ultimo ID
SELECT LAST_INSERT_ID();

-- Inserir de outra tabela
INSERT INTO produtos_destaque (nome, preco)
SELECT nome, preco FROM produtos WHERE preco > 500;`,
        engine: "both",
      },
      {
        name: "UPSERT (Insert ou Update)",
        description: "Insere ou atualiza se ja existir (conflito de chave unica).",
        syntax: `-- PG: ON CONFLICT ... DO UPDATE
-- MySQL: ON DUPLICATE KEY UPDATE`,
        pgExample: `INSERT INTO produtos (sku, nome, preco)
VALUES ('SKU-001', 'Mouse Gamer', 189.90)
ON CONFLICT (sku) DO UPDATE
SET nome = EXCLUDED.nome,
    preco = EXCLUDED.preco,
    atualizado_em = NOW();

-- Ignorar conflito
INSERT INTO logs (evento) VALUES ('login')
ON CONFLICT DO NOTHING;

-- Upsert com WHERE
INSERT INTO estoque (produto_id, quantidade)
VALUES (1, 10)
ON CONFLICT (produto_id) DO UPDATE
SET quantidade = estoque.quantidade + EXCLUDED.quantidade
WHERE estoque.ativo = true;`,
        mysqlExample: `INSERT INTO produtos (sku, nome, preco)
VALUES ('SKU-001', 'Mouse Gamer', 189.90)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  preco = VALUES(preco),
  atualizado_em = NOW();

-- INSERT IGNORE (ignora duplicados sem erro)
INSERT IGNORE INTO logs (evento) VALUES ('login');

-- REPLACE (deleta e reinsere)
REPLACE INTO produtos (sku, nome, preco)
VALUES ('SKU-001', 'Mouse Gamer', 189.90);`,
        engine: "both",
      },
      {
        name: "UPDATE",
        description: "Atualiza registros existentes em uma tabela.",
        syntax: `UPDATE tabela SET col = val WHERE condicao;`,
        pgExample: `-- Simples
UPDATE produtos SET preco = preco * 1.10 WHERE categoria_id = 3;

-- Com RETURNING
UPDATE produtos SET preco = 199.90
WHERE id = 42 RETURNING id, nome, preco;

-- Update com FROM (outra tabela)
UPDATE produtos p
SET preco = p.preco * 0.90
FROM categorias c
WHERE c.id = p.categoria_id AND c.nome = 'Eletronicos';

-- Update com subquery
UPDATE produtos
SET preco = (SELECT AVG(preco) FROM produtos) * 0.9
WHERE estoque = 0;`,
        mysqlExample: `-- Simples
UPDATE produtos SET preco = preco * 1.10 WHERE categoria_id = 3;

-- Com LIMIT
UPDATE produtos SET destaque = 1
ORDER BY vendas DESC LIMIT 10;

-- Update com JOIN
UPDATE produtos p
INNER JOIN categorias c ON c.id = p.categoria_id
SET p.preco = p.preco * 0.90
WHERE c.nome = 'Eletronicos';`,
        engine: "both",
      },
      {
        name: "DELETE",
        description: "Remove registros de uma tabela. Use WHERE para nao apagar tudo!",
        syntax: "DELETE FROM tabela WHERE condicao;",
        pgExample: `-- Simples
DELETE FROM produtos WHERE id = 42;

-- Com RETURNING
DELETE FROM produtos WHERE estoque = 0
RETURNING id, nome;

-- Com USING (outra tabela)
DELETE FROM produtos p
USING categorias c
WHERE c.id = p.categoria_id AND c.ativo = false;

-- Limpar registros antigos
DELETE FROM logs WHERE data < NOW() - INTERVAL '90 days';`,
        mysqlExample: `-- Simples
DELETE FROM produtos WHERE id = 42;

-- Com LIMIT
DELETE FROM logs
WHERE data < DATE_SUB(NOW(), INTERVAL 90 DAY)
LIMIT 1000;

-- Com JOIN
DELETE p FROM produtos p
INNER JOIN categorias c ON c.id = p.categoria_id
WHERE c.ativo = 0;`,
        engine: "both",
      },
      {
        name: "CASE / Expressoes Condicionais",
        description: "Logica condicional dentro de consultas SQL (equivalente a if/else).",
        syntax: `CASE
  WHEN condicao THEN resultado
  ELSE padrao
END`,
        commonExample: `-- CASE simples
SELECT nome, preco,
  CASE
    WHEN preco > 1000 THEN 'Premium'
    WHEN preco > 100  THEN 'Medio'
    ELSE 'Economico'
  END AS faixa
FROM produtos;

-- CASE em UPDATE
UPDATE produtos SET categoria =
  CASE
    WHEN preco > 1000 THEN 'premium'
    WHEN preco > 100 THEN 'standard'
    ELSE 'basic'
  END;

-- COALESCE (primeiro nao-nulo)
SELECT COALESCE(apelido, nome, 'Anonimo') AS display_name
FROM users;

-- NULLIF (retorna NULL se iguais)
SELECT total / NULLIF(quantidade, 0) AS preco_unitario
FROM pedidos;

-- GREATEST / LEAST
SELECT GREATEST(preco, preco_minimo) AS preco_final
FROM produtos;`,
        engine: "both",
      },
      {
        name: "Subqueries",
        description: "Consultas aninhadas dentro de outras consultas. IN, EXISTS, ANY, ALL.",
        syntax: "SELECT ... WHERE col IN (SELECT ...);",
        commonExample: `-- IN (lista de valores)
SELECT * FROM produtos
WHERE categoria_id IN (
  SELECT id FROM categorias WHERE ativo = true
);

-- EXISTS (verifica existencia)
SELECT * FROM clientes c
WHERE EXISTS (
  SELECT 1 FROM pedidos p WHERE p.cliente_id = c.id
);

-- NOT EXISTS
SELECT * FROM produtos p
WHERE NOT EXISTS (
  SELECT 1 FROM itens_pedido ip WHERE ip.produto_id = p.id
);

-- Subquery escalar
SELECT nome, preco,
  preco - (SELECT AVG(preco) FROM produtos) AS diff_media
FROM produtos;

-- ANY / ALL
SELECT * FROM produtos
WHERE preco > ALL (
  SELECT preco FROM produtos WHERE categoria_id = 1
);`,
        engine: "both",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DCL - Data Control Language
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "dcl",
    label: "DCL - Controle de Acesso",
    shortLabel: "DCL",
    icon: Shield,
    commands: [
      {
        name: "CREATE USER / ROLE",
        description: "Cria usuarios e roles para gerenciar acesso ao banco.",
        syntax: "CREATE USER nome WITH PASSWORD 'senha';",
        pgExample: `-- Usuario com login
CREATE USER app_user WITH PASSWORD 'Senha123!';

-- Role sem login (para agrupar permissoes)
CREATE ROLE readonly;

-- Role com login e privilegios
CREATE ROLE app_admin WITH LOGIN PASSWORD 'Admin123!'
  CREATEDB CREATEROLE;

-- Role com validade
CREATE ROLE temp_user WITH LOGIN PASSWORD 'tmp'
  VALID UNTIL '2026-12-31';

-- Superuser (cuidado!)
CREATE ROLE dba WITH LOGIN PASSWORD 'Dba123!'
  SUPERUSER;`,
        mysqlExample: `-- Usuario
CREATE USER 'app_user'@'%' IDENTIFIED BY 'Senha123!';

-- Usuario para host especifico
CREATE USER 'app_user'@'192.168.1.%' IDENTIFIED BY 'Senha123!';

-- Role (MySQL 8+)
CREATE ROLE 'readonly';

-- Usuario com limite de recursos
CREATE USER 'api'@'%' IDENTIFIED BY 'Api123!'
  WITH MAX_QUERIES_PER_HOUR 1000
       MAX_CONNECTIONS_PER_HOUR 100;`,
        engine: "both",
      },
      {
        name: "GRANT",
        description: "Concede privilegios a usuarios ou roles.",
        syntax: "GRANT privilegio ON objeto TO usuario;",
        pgExample: `-- Todos os privilegios no banco
GRANT ALL PRIVILEGES ON DATABASE loja TO app_admin;

-- Permissoes em tabela
GRANT SELECT, INSERT, UPDATE ON produtos TO app_user;

-- Todas as tabelas de um schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- Permissoes futuras (tabelas criadas depois)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO readonly;

-- Conceder role
GRANT readonly TO app_user;

-- Permissao de uso em schema
GRANT USAGE ON SCHEMA vendas TO app_user;

-- Permissao em sequencia
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;`,
        mysqlExample: `-- Todos os privilegios no banco
GRANT ALL PRIVILEGES ON loja.* TO 'app_admin'@'%';

-- Permissoes em tabela
GRANT SELECT, INSERT, UPDATE ON loja.produtos TO 'app_user'@'%';

-- Apenas leitura
GRANT SELECT ON loja.* TO 'readonly'@'%';

-- Conceder role (MySQL 8+)
GRANT 'readonly' TO 'app_user'@'%';

-- Grant com opcao de repassar
GRANT SELECT ON loja.* TO 'admin'@'%' WITH GRANT OPTION;

-- Aplicar
FLUSH PRIVILEGES;`,
        engine: "both",
      },
      {
        name: "REVOKE",
        description: "Remove privilegios de usuarios ou roles.",
        syntax: "REVOKE privilegio ON objeto FROM usuario;",
        pgExample: `REVOKE ALL PRIVILEGES ON DATABASE loja FROM app_user;
REVOKE INSERT, UPDATE ON produtos FROM app_user;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;
REVOKE readonly FROM app_user;`,
        mysqlExample: `REVOKE ALL PRIVILEGES ON loja.* FROM 'app_user'@'%';
REVOKE INSERT ON loja.produtos FROM 'app_user'@'%';
FLUSH PRIVILEGES;`,
        engine: "both",
      },
      {
        name: "ALTER USER",
        description: "Modifica propriedades de um usuario existente.",
        syntax: "ALTER USER nome ...;",
        pgExample: `-- Alterar senha
ALTER USER app_user WITH PASSWORD 'NovaSenha!';

-- Adicionar privilegio
ALTER ROLE app_user WITH CREATEDB;

-- Renomear
ALTER USER app_user RENAME TO api_user;

-- Definir parametro
ALTER ROLE app_user SET search_path TO vendas, public;

-- Validade
ALTER USER app_user VALID UNTIL '2027-01-01';`,
        mysqlExample: `-- Alterar senha
ALTER USER 'app_user'@'%' IDENTIFIED BY 'NovaSenha!';

-- Bloquear/desbloquear
ALTER USER 'app_user'@'%' ACCOUNT LOCK;
ALTER USER 'app_user'@'%' ACCOUNT UNLOCK;

-- Expirar senha
ALTER USER 'app_user'@'%' PASSWORD EXPIRE;

-- Renomear
RENAME USER 'app_user'@'%' TO 'api_user'@'%';`,
        engine: "both",
      },
      {
        name: "DROP USER / ROLE",
        description: "Remove usuario ou role do banco.",
        syntax: "DROP USER [IF EXISTS] nome;",
        pgExample: `-- Antes de dropar, revogar permissoes
REASSIGN OWNED BY app_user TO postgres;
DROP OWNED BY app_user;
DROP USER IF EXISTS app_user;
DROP ROLE IF EXISTS readonly;`,
        mysqlExample: `DROP USER IF EXISTS 'app_user'@'%';
DROP ROLE IF EXISTS 'readonly';`,
        engine: "both",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TCL - Transaction Control Language
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "tcl",
    label: "TCL - Transacoes",
    shortLabel: "TCL",
    icon: GitBranch,
    commands: [
      {
        name: "BEGIN / START TRANSACTION",
        description: "Inicia uma transacao. Operacoes sao atomicas ate COMMIT ou ROLLBACK.",
        syntax: "BEGIN; -- ou START TRANSACTION;",
        pgExample: `BEGIN;
UPDATE contas SET saldo = saldo - 500 WHERE id = 1;
UPDATE contas SET saldo = saldo + 500 WHERE id = 2;
COMMIT;

-- Com nivel de isolamento
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- ... operacoes ...
COMMIT;

-- Read only (otimizacao)
BEGIN READ ONLY;
SELECT * FROM relatorios;
COMMIT;`,
        mysqlExample: `START TRANSACTION;
UPDATE contas SET saldo = saldo - 500 WHERE id = 1;
UPDATE contas SET saldo = saldo + 500 WHERE id = 2;
COMMIT;

-- Desabilitar autocommit
SET autocommit = 0;
-- ... operacoes ...
COMMIT;
SET autocommit = 1;

-- Com isolamento
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
START TRANSACTION;`,
        engine: "both",
      },
      {
        name: "COMMIT",
        description: "Confirma todas as operacoes da transacao, tornando-as permanentes.",
        syntax: "COMMIT;",
        commonExample: `BEGIN;
INSERT INTO pedidos (cliente_id, total) VALUES (1, 299.90);
INSERT INTO itens_pedido (pedido_id, produto_id) VALUES (1, 5);
COMMIT; -- Tudo salvo permanentemente`,
        engine: "both",
      },
      {
        name: "ROLLBACK",
        description: "Desfaz todas as operacoes da transacao atual. Nada e salvo.",
        syntax: "ROLLBACK;",
        commonExample: `BEGIN;
DELETE FROM produtos WHERE categoria_id = 5;
-- Ops! Nao era isso
ROLLBACK; -- Nada foi deletado`,
        engine: "both",
      },
      {
        name: "SAVEPOINT",
        description: "Cria ponto de restauracao dentro de uma transacao para rollback parcial.",
        syntax: `SAVEPOINT nome;
ROLLBACK TO SAVEPOINT nome;
RELEASE SAVEPOINT nome;`,
        commonExample: `BEGIN;

INSERT INTO pedidos (cliente_id, total) VALUES (1, 100);
SAVEPOINT sp_pedido;

INSERT INTO itens_pedido (pedido_id, produto_id)
VALUES (1, 999); -- erro: produto nao existe

ROLLBACK TO SAVEPOINT sp_pedido;
-- Pedido ainda existe, item com erro desfeito

INSERT INTO itens_pedido (pedido_id, produto_id)
VALUES (1, 5); -- agora correto

COMMIT;`,
        engine: "both",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Functions & Operators
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "functions",
    label: "Funcoes e Operadores",
    shortLabel: "Funcoes",
    icon: FunctionSquare,
    commands: [
      {
        name: "Funcoes de String",
        description: "Manipulacao de texto: concatenar, buscar, substituir, formatar.",
        syntax: "CONCAT, SUBSTRING, REPLACE, TRIM, UPPER, LOWER, LENGTH ...",
        pgExample: `-- Concatenar
SELECT 'Ola' || ' ' || 'Mundo';  -- operador ||
SELECT CONCAT('Ola', ' ', 'Mundo');

-- Maiuscula/minuscula
SELECT UPPER('hello'), LOWER('HELLO'), INITCAP('joao silva');

-- Tamanho
SELECT LENGTH('texto'), CHAR_LENGTH('texto');

-- Substring
SELECT SUBSTRING('PostgreSQL' FROM 1 FOR 8);  -- PostgreS
SELECT LEFT('PostgreSQL', 4);   -- Post
SELECT RIGHT('PostgreSQL', 3);  -- SQL

-- Buscar e substituir
SELECT POSITION('SQL' IN 'PostgreSQL');  -- 8
SELECT REPLACE('foo bar', 'bar', 'baz');
SELECT TRANSLATE('abc', 'abc', 'xyz');  -- xyz

-- Trim
SELECT TRIM('  texto  ');
SELECT LTRIM('  texto'), RTRIM('texto  ');

-- Padding
SELECT LPAD('42', 5, '0');  -- 00042
SELECT RPAD('oi', 10, '.');  -- oi........

-- Split e Array
SELECT STRING_TO_ARRAY('a,b,c', ',');  -- {a,b,c}
SELECT ARRAY_TO_STRING(ARRAY['a','b'], '-');  -- a-b

-- Regex
SELECT 'abc123' ~ '^[a-z]+[0-9]+$';  -- true
SELECT REGEXP_REPLACE('foo123bar', '[0-9]+', '#');  -- foo#bar

-- Format
SELECT FORMAT('Ola %s, voce tem %s anos', 'Joao', 25);`,
        mysqlExample: `-- Concatenar
SELECT CONCAT('Ola', ' ', 'Mundo');
SELECT CONCAT_WS(' ', 'Ola', 'Mundo');  -- com separador

-- Maiuscula/minuscula
SELECT UPPER('hello'), LOWER('HELLO');

-- Tamanho
SELECT LENGTH('texto'), CHAR_LENGTH('texto');

-- Substring
SELECT SUBSTRING('MySQL' FROM 1 FOR 3);  -- MyS
SELECT LEFT('MySQL', 2);   -- My
SELECT RIGHT('MySQL', 3);  -- SQL

-- Buscar e substituir
SELECT LOCATE('SQL', 'MySQL');  -- 3
SELECT REPLACE('foo bar', 'bar', 'baz');
SELECT INSERT('MySQL', 3, 3, 'Server');  -- MyServer

-- Trim
SELECT TRIM('  texto  ');
SELECT LTRIM('  texto'), RTRIM('texto  ');

-- Padding
SELECT LPAD('42', 5, '0');  -- 00042

-- Repetir / Reverter
SELECT REPEAT('ab', 3);  -- ababab
SELECT REVERSE('abc');  -- cba

-- Regex (MySQL 8+)
SELECT 'abc123' REGEXP '^[a-z]+[0-9]+$';  -- 1
SELECT REGEXP_REPLACE('foo123bar', '[0-9]+', '#');`,
        engine: "both",
      },
      {
        name: "Funcoes de Data/Hora",
        description: "Manipulacao de datas, horas, intervalos e formatacao temporal.",
        syntax: "NOW, DATE_TRUNC, EXTRACT, AGE, INTERVAL ...",
        pgExample: `-- Data/hora atual
SELECT NOW();                    -- timestamp com timezone
SELECT CURRENT_DATE;             -- apenas data
SELECT CURRENT_TIME;             -- apenas hora
SELECT CURRENT_TIMESTAMP;        -- = NOW()

-- Extrair partes
SELECT EXTRACT(YEAR FROM NOW());
SELECT EXTRACT(MONTH FROM NOW());
SELECT EXTRACT(DOW FROM NOW());  -- dia da semana (0=dom)
SELECT DATE_PART('hour', NOW());

-- Truncar
SELECT DATE_TRUNC('month', NOW());  -- inicio do mes
SELECT DATE_TRUNC('year', NOW());   -- inicio do ano

-- Aritmetica com datas
SELECT NOW() + INTERVAL '30 days';
SELECT NOW() - INTERVAL '2 hours';
SELECT AGE(NOW(), '1990-05-15');  -- 35 years 9 mons ...

-- Formatar
SELECT TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI:SS');
SELECT TO_CHAR(NOW(), 'Day, DD "de" Month "de" YYYY');

-- Converter texto para data
SELECT TO_DATE('15/03/2025', 'DD/MM/YYYY');
SELECT TO_TIMESTAMP('2025-03-15 14:30', 'YYYY-MM-DD HH24:MI');

-- Diferenca em dias
SELECT DATE '2025-12-31' - DATE '2025-01-01';  -- 364

-- Generate series de datas
SELECT generate_series(
  '2025-01-01'::date,
  '2025-12-31'::date,
  '1 month'::interval
);`,
        mysqlExample: `-- Data/hora atual
SELECT NOW();           -- datetime
SELECT CURDATE();       -- apenas data
SELECT CURTIME();       -- apenas hora

-- Extrair partes
SELECT YEAR(NOW()), MONTH(NOW()), DAY(NOW());
SELECT HOUR(NOW()), MINUTE(NOW()), SECOND(NOW());
SELECT DAYOFWEEK(NOW());  -- 1=dom
SELECT DAYNAME(NOW());    -- Sunday

-- Aritmetica
SELECT DATE_ADD(NOW(), INTERVAL 30 DAY);
SELECT DATE_SUB(NOW(), INTERVAL 2 HOUR);
SELECT DATEDIFF('2025-12-31', '2025-01-01');  -- 364
SELECT TIMESTAMPDIFF(MONTH, '2025-01-01', '2025-06-15');  -- 5

-- Formatar
SELECT DATE_FORMAT(NOW(), '%d/%m/%Y %H:%i:%s');
SELECT DATE_FORMAT(NOW(), '%W, %d de %M de %Y');

-- Converter
SELECT STR_TO_DATE('15/03/2025', '%d/%m/%Y');

-- Inicio/fim de periodos
SELECT LAST_DAY(NOW());           -- ultimo dia do mes
SELECT DATE_FORMAT(NOW(), '%Y-%m-01');  -- inicio do mes

-- Unix timestamp
SELECT UNIX_TIMESTAMP(NOW());
SELECT FROM_UNIXTIME(1735689600);`,
        engine: "both",
      },
      {
        name: "Funcoes Matematicas",
        description: "Operacoes numericas: arredondamento, absoluto, potencia, aleatorio.",
        syntax: "ROUND, CEIL, FLOOR, ABS, POWER, RANDOM ...",
        commonExample: `-- Arredondamento
SELECT ROUND(3.14159, 2);   -- 3.14
SELECT CEIL(3.2);            -- 4
SELECT FLOOR(3.8);           -- 3

-- Absoluto
SELECT ABS(-42);  -- 42

-- Potencia / Raiz
SELECT POWER(2, 10);   -- 1024
SELECT SQRT(144);      -- 12

-- Modulo
SELECT MOD(17, 5);  -- 2
SELECT 17 % 5;      -- 2

-- Logaritmo
SELECT LOG(100);     -- 2 (base 10)
SELECT LN(2.718);   -- ~1

-- Trigonometria
SELECT PI();
SELECT SIN(PI()/2), COS(0), TAN(PI()/4);

-- Aleatorio
-- PG: SELECT RANDOM();         -- 0.0 a 1.0
-- MySQL: SELECT RAND();        -- 0.0 a 1.0
-- Numero aleatorio entre 1 e 100:
-- PG: SELECT FLOOR(RANDOM() * 100 + 1);
-- MySQL: SELECT FLOOR(RAND() * 100 + 1);

-- Sign
SELECT SIGN(-5);   -- -1
SELECT SIGN(0);    -- 0
SELECT SIGN(5);    -- 1`,
        engine: "both",
      },
      {
        name: "Funcoes de Agregacao",
        description: "Calculos sobre conjuntos de linhas: contagem, soma, media, etc.",
        syntax: "COUNT, SUM, AVG, MIN, MAX, STRING_AGG ...",
        pgExample: `-- Basicas
SELECT
  COUNT(*) AS total,
  COUNT(DISTINCT categoria_id) AS categorias,
  SUM(preco) AS soma,
  AVG(preco) AS media,
  MIN(preco) AS menor,
  MAX(preco) AS maior
FROM produtos;

-- STRING_AGG (concatenar valores)
SELECT categoria_id,
  STRING_AGG(nome, ', ' ORDER BY nome) AS produtos
FROM produtos
GROUP BY categoria_id;

-- ARRAY_AGG
SELECT categoria_id,
  ARRAY_AGG(nome ORDER BY preco DESC) AS produtos
FROM produtos
GROUP BY categoria_id;

-- BOOL_AND / BOOL_OR
SELECT categoria_id,
  BOOL_AND(ativo) AS todos_ativos,
  BOOL_OR(ativo) AS algum_ativo
FROM produtos
GROUP BY categoria_id;

-- Percentil
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY preco) AS mediana,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY preco) AS p95
FROM produtos;

-- FILTER (agregacao condicional)
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE preco > 100) AS caros,
  AVG(preco) FILTER (WHERE ativo) AS media_ativos
FROM produtos;`,
        mysqlExample: `-- Basicas
SELECT
  COUNT(*) AS total,
  COUNT(DISTINCT categoria_id) AS categorias,
  SUM(preco) AS soma,
  AVG(preco) AS media,
  MIN(preco) AS menor,
  MAX(preco) AS maior
FROM produtos;

-- GROUP_CONCAT (concatenar valores)
SELECT categoria_id,
  GROUP_CONCAT(nome ORDER BY nome SEPARATOR ', ') AS produtos
FROM produtos
GROUP BY categoria_id;

-- JSON_ARRAYAGG / JSON_OBJECTAGG
SELECT categoria_id,
  JSON_ARRAYAGG(nome) AS produtos
FROM produtos
GROUP BY categoria_id;

-- Agregacao condicional (sem FILTER, usar CASE)
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN preco > 100 THEN 1 ELSE 0 END) AS caros,
  AVG(CASE WHEN ativo = 1 THEN preco END) AS media_ativos
FROM produtos;`,
        engine: "both",
      },
      {
        name: "Funcoes JSON",
        description: "Criar, consultar e manipular dados JSON/JSONB armazenados no banco.",
        syntax: `-- PG: JSONB com operadores ->  ->>  @>  ?
-- MySQL: JSON_EXTRACT, JSON_SET, JSON_OBJECT ...`,
        pgExample: `-- Consultar campo
SELECT dados->>'tema' AS tema FROM configs;      -- texto
SELECT dados->'endereco'->>'rua' FROM users;     -- nested

-- Filtrar por valor JSON
SELECT * FROM configs WHERE dados @> '{"idioma": "pt-BR"}';

-- Verificar se chave existe
SELECT * FROM configs WHERE dados ? 'tema';

-- Atualizar campo
UPDATE configs SET dados = jsonb_set(dados, '{tema}', '"light"');

-- Remover chave
UPDATE configs SET dados = dados - 'tema';

-- Construir JSON
SELECT jsonb_build_object('id', id, 'nome', nome) FROM produtos;

-- Agregar
SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome))
FROM produtos;

-- Expandir JSON para linhas
SELECT * FROM jsonb_each('{"a":1,"b":2}');
SELECT * FROM jsonb_array_elements('[1,2,3]');

-- Path query (PG 12+)
SELECT jsonb_path_query(dados, '$.items[*] ? (@.preco > 100)')
FROM pedidos;`,
        mysqlExample: `-- Consultar campo
SELECT JSON_EXTRACT(dados, '$.tema') FROM configs;
SELECT dados->>'$.tema' FROM configs;  -- MySQL 8+

-- Filtrar
SELECT * FROM configs
WHERE JSON_EXTRACT(dados, '$.idioma') = 'pt-BR';

-- Atualizar
UPDATE configs SET dados = JSON_SET(dados, '$.tema', 'light');

-- Remover chave
UPDATE configs SET dados = JSON_REMOVE(dados, '$.tema');

-- Construir JSON
SELECT JSON_OBJECT('id', id, 'nome', nome) FROM produtos;

-- Agregar
SELECT JSON_ARRAYAGG(JSON_OBJECT('id', id, 'nome', nome))
FROM produtos;

-- Verificar tipo
SELECT JSON_TYPE(dados->'$.tema') FROM configs;

-- Buscar em array JSON
SELECT * FROM configs
WHERE JSON_CONTAINS(dados->'$.tags', '"importante"');`,
        engine: "both",
      },
      {
        name: "Type Casting / Conversao",
        description: "Converter valores entre diferentes tipos de dados.",
        syntax: "CAST(valor AS tipo) -- ou valor::tipo (PG)",
        pgExample: `-- Sintaxe PG (::)
SELECT '42'::INT;
SELECT '2025-03-15'::DATE;
SELECT 3.14::TEXT;
SELECT '{"a":1}'::JSONB;
SELECT ARRAY[1,2,3]::TEXT[];

-- CAST padrao
SELECT CAST('42' AS INTEGER);
SELECT CAST(NOW() AS DATE);
SELECT CAST(preco AS TEXT) FROM produtos;

-- Converter para booleano
SELECT 'true'::BOOLEAN;
SELECT 1::BOOLEAN;  -- true

-- Numeric precision
SELECT CAST(3.14159 AS NUMERIC(5,2));  -- 3.14`,
        mysqlExample: `-- CAST
SELECT CAST('42' AS SIGNED);
SELECT CAST('2025-03-15' AS DATE);
SELECT CAST(3.14 AS CHAR);
SELECT CAST(preco AS DECIMAL(10,2)) FROM produtos;

-- CONVERT
SELECT CONVERT('42', SIGNED);
SELECT CONVERT('2025-03-15', DATE);

-- Implicito (MySQL e mais flexivel)
SELECT '42' + 0;     -- 42 (numero)
SELECT 42 + '';       -- '42' (string)
SELECT '2025-03-15' + INTERVAL 0 DAY;  -- date`,
        engine: "both",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Advanced
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "advanced",
    label: "Avancado",
    shortLabel: "Avancado",
    icon: Layers,
    commands: [
      {
        name: "CTE (Common Table Expressions)",
        description: "Consultas nomeadas reutilizaveis. WITH ... AS. Suporta recursao para arvores e hierarquias.",
        syntax: `WITH nome AS (SELECT ...)
SELECT * FROM nome;`,
        pgExample: `-- CTE simples
WITH vendas_mes AS (
  SELECT produto_id, SUM(total) AS total_vendas
  FROM pedidos
  WHERE data >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY produto_id
)
SELECT p.nome, vm.total_vendas
FROM produtos p
JOIN vendas_mes vm ON vm.produto_id = p.id;

-- Multiplas CTEs
WITH
  ativos AS (SELECT * FROM produtos WHERE ativo),
  vendidos AS (
    SELECT produto_id, SUM(qtd) AS total
    FROM itens_pedido GROUP BY produto_id
  )
SELECT a.nome, COALESCE(v.total, 0) AS vendas
FROM ativos a
LEFT JOIN vendidos v ON v.produto_id = a.id;

-- CTE recursiva (arvore de categorias)
WITH RECURSIVE arvore AS (
  SELECT id, nome, pai_id, 1 AS nivel, nome::TEXT AS caminho
  FROM categorias WHERE pai_id IS NULL
  UNION ALL
  SELECT c.id, c.nome, c.pai_id, a.nivel + 1,
         a.caminho || ' > ' || c.nome
  FROM categorias c
  JOIN arvore a ON a.id = c.pai_id
)
SELECT * FROM arvore ORDER BY caminho;

-- CTE recursiva (gerar sequencia)
WITH RECURSIVE seq AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 100
)
SELECT * FROM seq;`,
        mysqlExample: `-- CTE simples (MySQL 8.0+)
WITH vendas_mes AS (
  SELECT produto_id, SUM(total) AS total_vendas
  FROM pedidos
  WHERE data >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
  GROUP BY produto_id
)
SELECT p.nome, vm.total_vendas
FROM produtos p
JOIN vendas_mes vm ON vm.produto_id = p.id;

-- CTE recursiva (MySQL 8.0+)
WITH RECURSIVE arvore AS (
  SELECT id, nome, pai_id, 1 AS nivel,
         CAST(nome AS CHAR(500)) AS caminho
  FROM categorias WHERE pai_id IS NULL
  UNION ALL
  SELECT c.id, c.nome, c.pai_id, a.nivel + 1,
         CONCAT(a.caminho, ' > ', c.nome)
  FROM categorias c
  JOIN arvore a ON a.id = c.pai_id
)
SELECT * FROM arvore ORDER BY caminho;`,
        engine: "both",
      },
      {
        name: "Window Functions",
        description: "Calculos sobre janelas de linhas relacionadas sem agrupar. ROW_NUMBER, RANK, LAG, LEAD, SUM OVER.",
        syntax: `SELECT col,
  funcao() OVER (
    [PARTITION BY col]
    [ORDER BY col]
    [ROWS BETWEEN ...]
  )
FROM tabela;`,
        commonExample: `-- Numero da linha
SELECT nome, preco,
  ROW_NUMBER() OVER (ORDER BY preco DESC) AS posicao
FROM produtos;

-- Ranking por categoria
SELECT nome, categoria_id, preco,
  RANK() OVER (PARTITION BY categoria_id ORDER BY preco DESC) AS rank,
  DENSE_RANK() OVER (PARTITION BY categoria_id ORDER BY preco DESC) AS drank
FROM produtos;

-- Top N por grupo (top 3 por categoria)
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY categoria_id ORDER BY preco DESC
  ) AS rn
  FROM produtos
) t WHERE rn <= 3;

-- Acumulado
SELECT data, valor,
  SUM(valor) OVER (ORDER BY data) AS acumulado
FROM vendas;

-- Media movel (7 dias)
SELECT data, valor,
  AVG(valor) OVER (
    ORDER BY data ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS media_7d
FROM vendas;

-- Lead / Lag (proximo / anterior)
SELECT data, valor,
  LAG(valor) OVER (ORDER BY data) AS anterior,
  LEAD(valor) OVER (ORDER BY data) AS proximo,
  valor - LAG(valor) OVER (ORDER BY data) AS variacao
FROM vendas;

-- FIRST_VALUE / LAST_VALUE
SELECT nome, preco,
  FIRST_VALUE(nome) OVER (ORDER BY preco DESC) AS mais_caro,
  LAST_VALUE(nome) OVER (
    ORDER BY preco DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS mais_barato
FROM produtos;

-- NTILE (dividir em N grupos)
SELECT nome, preco,
  NTILE(4) OVER (ORDER BY preco) AS quartil
FROM produtos;

-- Percentual do total
SELECT nome, preco,
  ROUND(preco * 100.0 / SUM(preco) OVER (), 2) AS pct_total
FROM produtos;`,
        engine: "both",
      },
      {
        name: "Full-Text Search",
        description: "Busca textual avancada com ranking de relevancia.",
        syntax: `-- PG: tsvector + tsquery
-- MySQL: MATCH ... AGAINST`,
        pgExample: `-- Busca basica
SELECT * FROM produtos
WHERE to_tsvector('portuguese', nome || ' ' || descricao)
   @@ to_tsquery('portuguese', 'notebook & gamer');

-- Com ranking
SELECT nome,
  ts_rank(
    to_tsvector('portuguese', nome || ' ' || descricao),
    to_tsquery('portuguese', 'notebook')
  ) AS relevancia
FROM produtos
WHERE to_tsvector('portuguese', nome || ' ' || descricao)
   @@ to_tsquery('portuguese', 'notebook')
ORDER BY relevancia DESC;

-- Coluna tsvector (performance)
ALTER TABLE produtos ADD COLUMN search_vector tsvector;
UPDATE produtos SET search_vector =
  to_tsvector('portuguese', nome || ' ' || COALESCE(descricao,''));
CREATE INDEX idx_fts ON produtos USING GIN (search_vector);

-- Busca com prefixo
SELECT * FROM produtos
WHERE search_vector @@ to_tsquery('portuguese', 'note:*');

-- Highlight (realcar resultado)
SELECT ts_headline('portuguese', descricao,
  to_tsquery('portuguese', 'notebook'),
  'StartSel=<b>, StopSel=</b>'
) FROM produtos;`,
        mysqlExample: `-- Criar indice FULLTEXT
ALTER TABLE produtos ADD FULLTEXT INDEX idx_ft (nome, descricao);

-- Busca natural language
SELECT *, MATCH(nome, descricao) AGAINST('notebook gamer') AS score
FROM produtos
WHERE MATCH(nome, descricao) AGAINST('notebook gamer')
ORDER BY score DESC;

-- Boolean mode (operadores + - *)
SELECT * FROM produtos
WHERE MATCH(nome, descricao)
AGAINST('+notebook -usado +gamer*' IN BOOLEAN MODE);

-- Query expansion (busca ampliada)
SELECT * FROM produtos
WHERE MATCH(nome) AGAINST('notebook'
WITH QUERY EXPANSION);`,
        engine: "both",
      },
      {
        name: "Particionamento de Tabelas",
        description: "Divide tabelas grandes em particoes menores para melhor performance.",
        syntax: "CREATE TABLE ... PARTITION BY RANGE|LIST|HASH (coluna);",
        pgExample: `-- Partition por RANGE (data)
CREATE TABLE pedidos (
  id SERIAL,
  data DATE NOT NULL,
  total NUMERIC(10,2)
) PARTITION BY RANGE (data);

-- Criar particoes
CREATE TABLE pedidos_2025_q1 PARTITION OF pedidos
  FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');
CREATE TABLE pedidos_2025_q2 PARTITION OF pedidos
  FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

-- Partition por LIST
CREATE TABLE vendas (
  id SERIAL,
  regiao TEXT,
  valor NUMERIC
) PARTITION BY LIST (regiao);

CREATE TABLE vendas_sul PARTITION OF vendas
  FOR VALUES IN ('RS', 'SC', 'PR');
CREATE TABLE vendas_sudeste PARTITION OF vendas
  FOR VALUES IN ('SP', 'RJ', 'MG', 'ES');

-- Partition por HASH
CREATE TABLE logs (
  id SERIAL,
  user_id INT
) PARTITION BY HASH (user_id);

CREATE TABLE logs_0 PARTITION OF logs
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE logs_1 PARTITION OF logs
  FOR VALUES WITH (MODULUS 4, REMAINDER 1);`,
        mysqlExample: `-- Partition por RANGE
CREATE TABLE pedidos (
  id INT AUTO_INCREMENT,
  data DATE NOT NULL,
  total DECIMAL(10,2),
  PRIMARY KEY (id, data)
) PARTITION BY RANGE (YEAR(data)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION pmax  VALUES LESS THAN MAXVALUE
);

-- Partition por LIST
CREATE TABLE vendas (
  id INT AUTO_INCREMENT,
  regiao VARCHAR(2),
  valor DECIMAL(10,2),
  PRIMARY KEY (id, regiao)
) PARTITION BY LIST COLUMNS (regiao) (
  PARTITION p_sul VALUES IN ('RS','SC','PR'),
  PARTITION p_sudeste VALUES IN ('SP','RJ','MG','ES')
);

-- Adicionar particao
ALTER TABLE pedidos ADD PARTITION (
  PARTITION p2027 VALUES LESS THAN (2028)
);

-- Remover particao
ALTER TABLE pedidos DROP PARTITION p2024;`,
        engine: "both",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Administration / Utility
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "admin",
    label: "Administracao",
    shortLabel: "Admin",
    icon: Wrench,
    commands: [
      {
        name: "EXPLAIN / EXPLAIN ANALYZE",
        description: "Mostra o plano de execucao de uma query. ANALYZE executa de fato e mostra tempos reais.",
        syntax: "EXPLAIN [ANALYZE] SELECT ...;",
        pgExample: `-- Plano estimado
EXPLAIN SELECT * FROM produtos WHERE preco > 100;

-- Com execucao real (mais detalhado)
EXPLAIN ANALYZE SELECT * FROM produtos WHERE preco > 100;

-- Formato completo
EXPLAIN (ANALYZE, BUFFERS, COSTS, TIMING, FORMAT TEXT)
SELECT p.nome, c.nome
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id;

-- Formato JSON (para ferramentas)
EXPLAIN (ANALYZE, FORMAT JSON)
SELECT * FROM produtos WHERE preco > 100;`,
        mysqlExample: `-- Plano de execucao
EXPLAIN SELECT * FROM produtos WHERE preco > 100;

-- Formato JSON (mais detalhado)
EXPLAIN FORMAT=JSON SELECT * FROM produtos WHERE preco > 100;

-- ANALYZE (MySQL 8.0.18+)
EXPLAIN ANALYZE SELECT * FROM produtos WHERE preco > 100;

-- Ver possiveis indices
EXPLAIN SELECT * FROM produtos WHERE nome = 'Mouse';`,
        engine: "both",
      },
      {
        name: "VACUUM / OPTIMIZE",
        description: "Recupera espaco em disco e atualiza estatisticas. Essencial para manter performance.",
        syntax: "VACUUM [FULL] [ANALYZE] tabela;",
        pgExample: `-- Vacuum basico (nao bloqueia)
VACUUM produtos;

-- Com analise de estatisticas
VACUUM ANALYZE produtos;

-- Full (bloqueia, recupera mais espaco)
VACUUM FULL produtos;

-- Todo o banco
VACUUM;
VACUUM ANALYZE;

-- Verificar necessidade de vacuum
SELECT relname, n_dead_tup, last_vacuum, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;`,
        mysqlExample: `-- Otimizar (recria tabela InnoDB)
OPTIMIZE TABLE produtos;
OPTIMIZE TABLE produtos, pedidos, clientes;

-- Analisar (atualiza estatisticas)
ANALYZE TABLE produtos;

-- Verificar integridade
CHECK TABLE produtos;

-- Reparar (MyISAM)
REPAIR TABLE produtos;`,
        engine: "both",
      },
      {
        name: "Informacoes do Sistema",
        description: "Consultar configuracoes, status, tabelas, tamanhos e processos ativos.",
        syntax: "SHOW ... / SELECT FROM pg_settings",
        pgExample: `-- Configuracoes
SHOW work_mem;
SHOW max_connections;
SHOW shared_buffers;

-- Todas as configuracoes
SELECT name, setting, unit FROM pg_settings ORDER BY name;

-- Listar tabelas
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Tamanho das tabelas
SELECT relname AS tabela,
  pg_size_pretty(pg_total_relation_size(oid)) AS tamanho
FROM pg_class
WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY pg_total_relation_size(oid) DESC;

-- Tamanho do banco
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Conexoes ativas
SELECT pid, usename, datname, state, query, query_start
FROM pg_stat_activity WHERE datname IS NOT NULL;

-- Queries lentas
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- Bloqueios
SELECT * FROM pg_locks WHERE NOT granted;

-- Versao
SELECT version();`,
        mysqlExample: `-- Configuracoes
SHOW VARIABLES LIKE 'max_connections';
SHOW VARIABLES LIKE '%buffer%';
SHOW GLOBAL STATUS;

-- Listar tabelas
SHOW TABLES;
SHOW FULL TABLES;
SHOW TABLE STATUS;

-- Estrutura
DESCRIBE produtos;
SHOW CREATE TABLE produtos;
SHOW COLUMNS FROM produtos;
SHOW INDEX FROM produtos;

-- Tamanho dos bancos
SELECT table_schema AS banco,
  ROUND(SUM(data_length + index_length)/1024/1024, 2) AS 'MB'
FROM information_schema.tables GROUP BY table_schema;

-- Processos
SHOW PROCESSLIST;
SHOW FULL PROCESSLIST;

-- Versao
SELECT VERSION();

-- Engine
SHOW ENGINES;

-- Character sets
SHOW CHARACTER SET;
SHOW COLLATION;`,
        engine: "both",
      },
      {
        name: "COPY / LOAD DATA (Import/Export CSV)",
        description: "Importar e exportar dados em massa de/para arquivos CSV.",
        syntax: `-- PG: COPY tabela FROM/TO 'arquivo'
-- MySQL: LOAD DATA INFILE ...`,
        pgExample: `-- Exportar para CSV
COPY produtos TO '/tmp/produtos.csv'
  WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- Exportar consulta
COPY (SELECT * FROM produtos WHERE preco > 100)
TO '/tmp/caros.csv' WITH (FORMAT CSV, HEADER);

-- Importar de CSV
COPY produtos (nome, preco, categoria_id)
FROM '/tmp/import.csv'
WITH (FORMAT CSV, HEADER, DELIMITER ',');

-- Com psql (de/para maquina local)
\\copy produtos TO 'produtos.csv' CSV HEADER
\\copy produtos FROM 'import.csv' CSV HEADER`,
        mysqlExample: `-- Importar de CSV
LOAD DATA INFILE '/tmp/import.csv'
INTO TABLE produtos
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\\n'
IGNORE 1 ROWS (nome, preco, categoria_id);

-- De arquivo local
LOAD DATA LOCAL INFILE '/home/user/dados.csv'
INTO TABLE produtos
FIELDS TERMINATED BY ','
IGNORE 1 ROWS;

-- Exportar para CSV
SELECT * FROM produtos
INTO OUTFILE '/tmp/produtos.csv'
FIELDS TERMINATED BY ',' ENCLOSED BY '"'
LINES TERMINATED BY '\\n';`,
        engine: "both",
      },
      {
        name: "pg_dump / mysqldump (Backup CLI)",
        description: "Ferramentas de linha de comando para backup e restauracao completa.",
        syntax: `pg_dump / pg_restore / mysqldump / mysql`,
        pgExample: `# Backup SQL
pg_dump -U admin -d loja > backup.sql

# Backup comprimido (custom format)
pg_dump -U admin -Fc -d loja -f backup.dump

# Apenas estrutura
pg_dump -U admin -s -d loja > schema.sql

# Apenas dados
pg_dump -U admin -a -d loja > dados.sql

# Tabela especifica
pg_dump -U admin -t produtos -d loja > produtos.sql

# Restaurar SQL
psql -U admin -d loja < backup.sql

# Restaurar custom format
pg_restore -U admin -d loja backup.dump

# Todos os bancos
pg_dumpall -U admin > todos.sql`,
        mysqlExample: `# Backup completo
mysqldump -u admin -p loja > backup.sql

# Comprimido
mysqldump -u admin -p loja | gzip > backup.sql.gz

# Apenas estrutura
mysqldump -u admin -p --no-data loja > schema.sql

# Apenas dados
mysqldump -u admin -p --no-create-info loja > dados.sql

# Tabela especifica
mysqldump -u admin -p loja produtos > produtos.sql

# Restaurar
mysql -u admin -p loja < backup.sql

# De gzip
gunzip < backup.sql.gz | mysql -u admin -p loja

# Todos os bancos
mysqldump -u admin -p --all-databases > todos.sql`,
        engine: "both",
      },
    ],
  },
];
