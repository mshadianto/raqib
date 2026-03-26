-- infrastructure/docker/init.sql
-- Initial database setup for MONI SaaS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable Row Level Security helpers
-- (RLS policies are added per-tenant table in migrations)
