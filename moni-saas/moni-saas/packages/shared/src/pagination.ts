// packages/shared/src/pagination.ts
// Shared pagination utilities for consistent query building and response formatting

import type { PaginationMeta } from './types';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Compute offset and build PaginationMeta from total count.
 */
export function paginate(params: PaginationParams, total: number): { offset: number; meta: PaginationMeta } {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 100);
  return {
    offset: (page - 1) * limit,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Build dynamic WHERE clause from filter conditions.
 * Returns { clause, params, nextIdx } for safe parameterized queries.
 */
export interface FilterCondition {
  /** SQL condition with $N placeholder, e.g. "source = ANY($N::varchar[])" */
  sql: string;
  /** The value to bind */
  value: unknown;
}

export function buildWhereClause(
  conditions: FilterCondition[],
  startIdx = 1
): { clause: string; params: unknown[]; nextIdx: number } {
  if (conditions.length === 0) {
    return { clause: '1=1', params: [], nextIdx: startIdx };
  }

  const parts: string[] = [];
  const params: unknown[] = [];
  let idx = startIdx;

  for (const cond of conditions) {
    parts.push(cond.sql.replace(/\$N/g, `$${idx}`));
    params.push(cond.value);
    idx++;
  }

  return {
    clause: parts.join(' AND '),
    params,
    nextIdx: idx,
  };
}
