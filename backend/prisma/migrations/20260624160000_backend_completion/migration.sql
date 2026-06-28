CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'REFUND', 'ADJUSTMENT');

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELED');

CREATE TYPE "ProjectEventType" AS ENUM ('PROJECT_UPDATED', 'SUGGESTIONS_READY', 'TRANSFORMATION_UPDATED', 'ASSET_CREATED', 'CREDITS_UPDATED');

ALTER TABLE "transformations"
  ADD COLUMN "provider_name" VARCHAR(80),
  ADD COLUMN "provider_request_id" VARCHAR(160),
  ADD COLUMN "cost_cents" INTEGER,
  ADD COLUMN "duration_ms" INTEGER,
  ADD COLUMN "ai_disclosure" VARCHAR(200);

CREATE TABLE "credit_wallets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount_cents" INTEGER NOT NULL,
  "credits" INTEGER NOT NULL,
  "checkout_url" TEXT,
  "stripe_checkout_session_id" VARCHAR(255),
  "stripe_event_id" VARCHAR(255),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,
  "transformation_id" UUID,
  "payment_id" UUID,
  "type" "CreditTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "reason" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "type" "ProjectEventType" NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_wallets_user_id_key" ON "credit_wallets"("user_id");
CREATE UNIQUE INDEX "credit_transactions_transformation_id_key" ON "credit_transactions"("transformation_id");
CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_key" ON "payments"("stripe_checkout_session_id");
CREATE UNIQUE INDEX "payments_stripe_event_id_key" ON "payments"("stripe_event_id");
CREATE INDEX "credit_transactions_user_id_created_at_idx" ON "credit_transactions"("user_id", "created_at");
CREATE INDEX "credit_transactions_wallet_id_idx" ON "credit_transactions"("wallet_id");
CREATE INDEX "credit_transactions_payment_id_idx" ON "credit_transactions"("payment_id");
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");
CREATE INDEX "project_events_project_id_created_at_idx" ON "project_events"("project_id", "created_at");

ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "credit_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "transformations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
