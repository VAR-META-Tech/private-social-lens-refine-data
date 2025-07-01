-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('SCHEDULED_BATCH', 'RANGE_BASED', 'CLEANUP', 'HEALTH_CHECK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED', 'ALREADY_REFINED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ConfigDataType" AS ENUM ('STRING', 'INTEGER', 'BOOLEAN', 'JSON');

-- CreateTable
CREATE TABLE "refinement_jobs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "cron_schedule" TEXT,
    "start_file_id" INTEGER,
    "end_file_id" INTEGER,
    "start_index" INTEGER,
    "end_index" INTEGER,
    "batch_size" INTEGER NOT NULL DEFAULT 10,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "retry_delay_seconds" INTEGER NOT NULL DEFAULT 300,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_by" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "refinement_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_processing_logs" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "file_id" INTEGER NOT NULL,
    "status" "ProcessingStatus" NOT NULL,
    "message" TEXT,
    "error_details" JSONB,
    "processing_time_ms" INTEGER,
    "ipfs_hash" TEXT,
    "encrypted_eek" TEXT,
    "decrypted_eek_length" INTEGER,
    "refinement_api_response" JSONB,
    "gas_used" BIGINT,
    "transaction_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "file_processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_statistics" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "batch_start_file_id" INTEGER,
    "batch_end_file_id" INTEGER,
    "batch_start_index" INTEGER,
    "batch_end_index" INTEGER,
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "already_refined_count" INTEGER NOT NULL DEFAULT 0,
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "total_processing_time_ms" BIGINT NOT NULL DEFAULT 0,
    "average_processing_time_ms" INTEGER NOT NULL DEFAULT 0,
    "total_gas_used" BIGINT NOT NULL DEFAULT 0,
    "batch_start_time" TIMESTAMP(3),
    "batch_end_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_queue" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "file_id" INTEGER NOT NULL,
    "queue_position" INTEGER,
    "status" "QueueStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "error_message" TEXT,
    "processing_node" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "data_type" "ConfigDataType" NOT NULL DEFAULT 'STRING',
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "refinement_jobs_status_idx" ON "refinement_jobs"("status");

-- CreateIndex
CREATE INDEX "refinement_jobs_job_type_idx" ON "refinement_jobs"("job_type");

-- CreateIndex
CREATE INDEX "refinement_jobs_created_at_idx" ON "refinement_jobs"("created_at");

-- CreateIndex
CREATE INDEX "refinement_jobs_scheduled_at_idx" ON "refinement_jobs"("scheduled_at");

-- CreateIndex
CREATE INDEX "refinement_jobs_next_retry_at_idx" ON "refinement_jobs"("next_retry_at");

-- CreateIndex
CREATE INDEX "refinement_jobs_status_priority_idx" ON "refinement_jobs"("status", "priority");

-- CreateIndex
CREATE INDEX "file_processing_logs_job_id_idx" ON "file_processing_logs"("job_id");

-- CreateIndex
CREATE INDEX "file_processing_logs_file_id_idx" ON "file_processing_logs"("file_id");

-- CreateIndex
CREATE INDEX "file_processing_logs_status_idx" ON "file_processing_logs"("status");

-- CreateIndex
CREATE INDEX "file_processing_logs_created_at_idx" ON "file_processing_logs"("created_at");

-- CreateIndex
CREATE INDEX "file_processing_logs_job_id_status_idx" ON "file_processing_logs"("job_id", "status");

-- CreateIndex
CREATE INDEX "file_processing_logs_file_id_status_idx" ON "file_processing_logs"("file_id", "status");

-- CreateIndex
CREATE INDEX "batch_statistics_job_id_idx" ON "batch_statistics"("job_id");

-- CreateIndex
CREATE INDEX "batch_statistics_created_at_idx" ON "batch_statistics"("created_at");

-- CreateIndex
CREATE INDEX "processing_queue_status_idx" ON "processing_queue"("status");

-- CreateIndex
CREATE INDEX "processing_queue_job_id_idx" ON "processing_queue"("job_id");

-- CreateIndex
CREATE INDEX "processing_queue_priority_scheduled_at_idx" ON "processing_queue"("priority", "scheduled_at");

-- CreateIndex
CREATE INDEX "processing_queue_scheduled_at_idx" ON "processing_queue"("scheduled_at");

-- CreateIndex
CREATE INDEX "processing_queue_next_attempt_at_idx" ON "processing_queue"("next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "processing_queue_job_id_file_id_key" ON "processing_queue"("job_id", "file_id");

-- CreateIndex
CREATE INDEX "system_config_updated_at_idx" ON "system_config"("updated_at");

-- AddForeignKey
ALTER TABLE "file_processing_logs" ADD CONSTRAINT "file_processing_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "refinement_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_statistics" ADD CONSTRAINT "batch_statistics_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "refinement_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_queue" ADD CONSTRAINT "processing_queue_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "refinement_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
