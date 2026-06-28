export interface AppConfig {
  nodeEnv: string
  port: number
  corsOrigin: string
  sessionCookieName: string
  sessionTtlDays: number
  passwordResetTtlMinutes: number
  supabaseUrl: string
  supabaseServiceRoleKey: string
  supabaseStorageBucket: string
  signedDownloadTtlSeconds: number
  originalAssetTtlDays: number
  maxImageByteSize: number
  transformationCreditCost: number
  mockGeneratedImageMimeType: string
  mockGeneratedImageByteSize: number
  stripeWebhookSecret: string
  stripeCheckoutBaseUrl: string
  defaultCreditPackCredits: number
  defaultCreditPackAmountCents: number
  maintenanceSecret: string
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000)

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535')
  }

  return port
}

function parsePositiveInteger(value: string | undefined, defaultValue: number, name: string): number {
  const parsedValue = Number(value ?? defaultValue)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }

  return parsedValue
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Readonly<AppConfig> {
  return Object.freeze({
    nodeEnv: env.NODE_ENV || 'development',
    port: parsePort(env.PORT),
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    sessionCookieName: env.SESSION_COOKIE_NAME || 'presto_session',
    sessionTtlDays: parsePositiveInteger(env.SESSION_TTL_DAYS, 7, 'SESSION_TTL_DAYS'),
    passwordResetTtlMinutes: parsePositiveInteger(
      env.PASSWORD_RESET_TTL_MINUTES,
      60,
      'PASSWORD_RESET_TTL_MINUTES',
    ),
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseStorageBucket: env.SUPABASE_STORAGE_BUCKET || 'presto-assets',
    signedDownloadTtlSeconds: parsePositiveInteger(
      env.SIGNED_DOWNLOAD_TTL_SECONDS,
      900,
      'SIGNED_DOWNLOAD_TTL_SECONDS',
    ),
    originalAssetTtlDays: parsePositiveInteger(env.ORIGINAL_ASSET_TTL_DAYS, 30, 'ORIGINAL_ASSET_TTL_DAYS'),
    maxImageByteSize: parsePositiveInteger(env.MAX_IMAGE_BYTE_SIZE, 10 * 1024 * 1024, 'MAX_IMAGE_BYTE_SIZE'),
    transformationCreditCost: parsePositiveInteger(
      env.TRANSFORMATION_CREDIT_COST,
      1,
      'TRANSFORMATION_CREDIT_COST',
    ),
    mockGeneratedImageMimeType: env.MOCK_GENERATED_IMAGE_MIME_TYPE || 'image/png',
    mockGeneratedImageByteSize: parsePositiveInteger(
      env.MOCK_GENERATED_IMAGE_BYTE_SIZE,
      512 * 1024,
      'MOCK_GENERATED_IMAGE_BYTE_SIZE',
    ),
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    stripeCheckoutBaseUrl: env.STRIPE_CHECKOUT_BASE_URL || 'https://checkout.stripe.com/c/pay',
    defaultCreditPackCredits: parsePositiveInteger(
      env.DEFAULT_CREDIT_PACK_CREDITS,
      10,
      'DEFAULT_CREDIT_PACK_CREDITS',
    ),
    defaultCreditPackAmountCents: parsePositiveInteger(
      env.DEFAULT_CREDIT_PACK_AMOUNT_CENTS,
      990,
      'DEFAULT_CREDIT_PACK_AMOUNT_CENTS',
    ),
    maintenanceSecret: env.MAINTENANCE_SECRET || '',
    rateLimitWindowMs: parsePositiveInteger(env.RATE_LIMIT_WINDOW_MS, 60_000, 'RATE_LIMIT_WINDOW_MS'),
    rateLimitMaxRequests: parsePositiveInteger(env.RATE_LIMIT_MAX_REQUESTS, 600, 'RATE_LIMIT_MAX_REQUESTS'),
  })
}
