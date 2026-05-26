-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectVertical" AS ENUM ('IMMOBILIER', 'OBJET');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'PENDING_ANALYSIS', 'ANALYZING', 'SUGGESTIONS_READY', 'PROCESSING', 'DONE', 'ERROR', 'DELETED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('ORIGINAL', 'GENERATED');

-- CreateEnum
CREATE TYPE "TransformationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "vertical" "ProjectVertical" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "transformation_id" UUID,
    "kind" "AssetKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "byte_size" INTEGER,
    "expires_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "generated_prompt" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transformations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "suggestion_id" UUID,
    "user_prompt" TEXT,
    "internal_prompt" TEXT,
    "llm_analysis" JSONB,
    "model_used" VARCHAR(120),
    "status" "TransformationStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transformations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "projects_user_id_created_at_idx" ON "projects"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "assets_transformation_id_key" ON "assets"("transformation_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_storage_key_key" ON "assets"("storage_key");

-- CreateIndex
CREATE INDEX "assets_project_id_kind_idx" ON "assets"("project_id", "kind");

-- CreateIndex
CREATE INDEX "assets_expires_at_idx" ON "assets"("expires_at");

-- CreateIndex
CREATE INDEX "suggestions_project_id_idx" ON "suggestions"("project_id");

-- CreateIndex
CREATE INDEX "transformations_project_id_created_at_idx" ON "transformations"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "transformations_suggestion_id_idx" ON "transformations"("suggestion_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_transformation_id_fkey" FOREIGN KEY ("transformation_id") REFERENCES "transformations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformations" ADD CONSTRAINT "transformations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformations" ADD CONSTRAINT "transformations_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
