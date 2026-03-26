// packages/backend/src/config/index.ts
import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://127.0.0.1:3000').split(','),

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET!,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
    enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
  },

  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@moni.kimconsulting.id',
    fromName: process.env.SENDGRID_FROM_NAME || 'MONI GRC Platform',
  },

  hermes: {
    apiUrl: process.env.HERMES_API_URL || 'http://127.0.0.1:8765',
    apiKey: process.env.HERMES_API_KEY || '',
    defaultModel: process.env.HERMES_DEFAULT_MODEL || 'anthropic/claude-sonnet-4-20250514',
    openRouterKey: process.env.OPENROUTER_API_KEY || '',
  },

  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
} as const;

// Validate required env vars in production
if (config.env === 'production') {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}
