// packages/backend/src/modules/tenant/tenant-schema.service.ts
// Dynamically creates/drops per-tenant PostgreSQL schemas

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../../config';

const pool = new Pool({ connectionString: config.database.url });

const MIGRATION_PATH = join(__dirname, '../../database/migrations/001_tenant_schema.sql');

export class TenantSchemaService {
  /**
   * Sanitize tenant slug for use as schema name.
   * Only alphanumeric + underscores allowed.
   */
  static schemaName(slug: string): string {
    const sanitized = slug.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    return `tenant_${sanitized}`;
  }

  /**
   * Create a new tenant schema with all required tables.
   */
  static async createSchema(slug: string): Promise<void> {
    const schema = this.schemaName(slug);

    // Read migration template and replace placeholder
    let sql = readFileSync(MIGRATION_PATH, 'utf-8');
    sql = sql.replace(/__TENANT_SCHEMA__/g, schema);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`[TenantSchema] Created schema: ${schema}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[TenantSchema] Failed to create schema ${schema}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Drop a tenant schema (use with extreme caution — irreversible).
   */
  static async dropSchema(slug: string): Promise<void> {
    const schema = this.schemaName(slug);
    const client = await pool.connect();
    try {
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      console.log(`[TenantSchema] Dropped schema: ${schema}`);
    } finally {
      client.release();
    }
  }

  /**
   * Check if a tenant schema exists.
   */
  static async schemaExists(slug: string): Promise<boolean> {
    const schema = this.schemaName(slug);
    const result = await pool.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [schema]
    );
    return result.rowCount! > 0;
  }

  /**
   * Execute a query within a tenant's schema context.
   * Sets search_path to the tenant schema for the duration of the query.
   */
  static async queryTenant<T = any>(
    slug: string,
    sql: string,
    params: any[] = []
  ): Promise<T[]> {
    const schema = this.schemaName(slug);
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${schema}, public`);
      const result = await client.query(sql, params);
      return result.rows as T[];
    } finally {
      await client.query('SET search_path TO public');
      client.release();
    }
  }

  /**
   * Get a client with tenant schema context set.
   * Caller MUST release the client when done.
   */
  static async getTenantClient(slug: string) {
    const schema = this.schemaName(slug);
    const client = await pool.connect();
    await client.query(`SET search_path TO ${schema}, public`);
    return {
      client,
      release: async () => {
        await client.query('SET search_path TO public');
        client.release();
      },
    };
  }
}
