import type { Adapter, AdapterUser, VerificationToken } from "next-auth/adapters";
import { Pool } from "pg";
import { getDatabaseConfigs } from "./db";

let pool: Pool | null = null;
let tableCreated = false;

function getAuthPool(): Pool {
  if (pool) return pool;

  const configs = getDatabaseConfigs();
  if (configs.length === 0) {
    throw new Error("No database configured for auth adapter");
  }

  const c = configs[0];
  pool = new Pool({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
    database: c.database,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return pool;
}

async function ensureTables(): Promise<void> {
  if (tableCreated) return;

  const p = getAuthPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS nextauth_users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      "emailVerified" TIMESTAMPTZ,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS nextauth_accounts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT NOT NULL REFERENCES nextauth_users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      UNIQUE(provider, "providerAccountId")
    );

    CREATE TABLE IF NOT EXISTS nextauth_verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_nextauth_users_email ON nextauth_users(email);
    CREATE INDEX IF NOT EXISTS idx_nextauth_vt_identifier_token ON nextauth_verification_tokens(identifier, token);
  `);

  tableCreated = true;
}

export function PgAdapter(): Adapter {
  return {
    async createUser(user) {
      await ensureTables();
      const p = getAuthPool();
      const result = await p.query(
        `INSERT INTO nextauth_users (name, email, "emailVerified", image)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, "emailVerified", image`,
        [user.name ?? null, user.email, user.emailVerified ?? null, user.image ?? null]
      );
      return result.rows[0] as AdapterUser;
    },

    async getUser(id) {
      await ensureTables();
      const p = getAuthPool();
      const result = await p.query(
        `SELECT id, name, email, "emailVerified", image FROM nextauth_users WHERE id = $1`,
        [id]
      );
      return (result.rows[0] as AdapterUser) ?? null;
    },

    async getUserByEmail(email) {
      await ensureTables();
      const p = getAuthPool();
      const result = await p.query(
        `SELECT id, name, email, "emailVerified", image FROM nextauth_users WHERE email = $1`,
        [email]
      );
      return (result.rows[0] as AdapterUser) ?? null;
    },

    async getUserByAccount({ providerAccountId, provider }) {
      await ensureTables();
      const p = getAuthPool();
      const result = await p.query(
        `SELECT u.id, u.name, u.email, u."emailVerified", u.image
         FROM nextauth_users u
         JOIN nextauth_accounts a ON a."userId" = u.id
         WHERE a.provider = $1 AND a."providerAccountId" = $2`,
        [provider, providerAccountId]
      );
      return (result.rows[0] as AdapterUser) ?? null;
    },

    async updateUser(user) {
      await ensureTables();
      const p = getAuthPool();
      const result = await p.query(
        `UPDATE nextauth_users
         SET name = COALESCE($2, name),
             email = COALESCE($3, email),
             "emailVerified" = COALESCE($4, "emailVerified"),
             image = COALESCE($5, image)
         WHERE id = $1
         RETURNING id, name, email, "emailVerified", image`,
        [user.id, user.name ?? null, user.email ?? null, user.emailVerified ?? null, user.image ?? null]
      );
      return result.rows[0] as AdapterUser;
    },

    async linkAccount(account) {
      await ensureTables();
      const p = getAuthPool();
      await p.query(
        `INSERT INTO nextauth_accounts ("userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          account.userId, account.type, account.provider, account.providerAccountId,
          account.refresh_token ?? null, account.access_token ?? null,
          account.expires_at ?? null, account.token_type ?? null,
          account.scope ?? null, account.id_token ?? null, account.session_state ?? null,
        ]
      );
    },

    async createVerificationToken(verificationToken) {
      await ensureTables();
      const p = getAuthPool();
      const result = await p.query(
        `INSERT INTO nextauth_verification_tokens (identifier, token, expires)
         VALUES ($1, $2, $3)
         RETURNING identifier, token, expires`,
        [verificationToken.identifier, verificationToken.token, verificationToken.expires]
      );
      return result.rows[0] as VerificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      await ensureTables();
      const p = getAuthPool();
      const result = await p.query(
        `DELETE FROM nextauth_verification_tokens
         WHERE identifier = $1 AND token = $2
         RETURNING identifier, token, expires`,
        [identifier, token]
      );
      return (result.rows[0] as VerificationToken) ?? null;
    },
  };
}
