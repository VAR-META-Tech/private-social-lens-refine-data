/**
 * Prisma Database Seeding Script
 * Populates the database with sample data for development and testing
 */

import { PrismaClient, JobStatus, JobType } from "./generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  try {
    // Clear existing data in development
    if (process.env.NODE_ENV === "development") {
      console.log("🧹 Clearing existing data...");
      await prisma.refinementJob.deleteMany();
    }

    // Seed RefinementJobs
    console.log("🔨 Seeding refinement jobs...");
    const jobs = await prisma.refinementJob.createMany({
      data: [
        {
          jobName: "scheduler-daily-batch-refinement",
          jobType: JobType.SCHEDULED_BATCH,
          cronSchedule: "0 2 * * *", // Daily at 2 AM
          startFileId: 1000,
          endFileId: 900,
          batchSize: 10,
          status: JobStatus.PENDING,
          priority: 8,
          metadata: {
            description: "Daily automated batch refinement scheduler",
            isSchedulerJob: true
          },
          createdBy: "system",
        },
        {
          jobName: "worker-manual-range-100-90",
          jobType: JobType.RANGE_BASED,
          startFileId: 100,
          endFileId: 90,
          batchSize: 5,
          status: JobStatus.PENDING,
          priority: 5,
          metadata: {
            description: "Manual range processing worker job",
            isWorkerJob: true
          },
          createdBy: "admin",
        },
        {
          jobName: "scheduler-weekly-cleanup",
          jobType: JobType.CLEANUP,
          cronSchedule: "0 0 * * 1", // Every Monday at midnight
          status: JobStatus.PENDING,
          priority: 3,
          metadata: {
            cleanup_older_than_days: 30,
            tables: ["file_processing_logs", "batch_statistics"],
            description: "Weekly cleanup scheduler",
            isSchedulerJob: true
          },
          createdBy: "system",
        },
        {
          jobName: "scheduler-health-check",
          jobType: JobType.HEALTH_CHECK,
          cronSchedule: "*/30 * * * *", // Every 30 minutes
          status: JobStatus.PENDING,
          priority: 10,
          metadata: {
            check_database: true,
            check_api: true,
            check_blockchain: true,
            description: "System health monitoring scheduler",
            isSchedulerJob: true
          },
          createdBy: "system",
        },
        {
          jobName: "scheduler-frequent-batch-refinement",
          jobType: JobType.SCHEDULED_BATCH,
          cronSchedule: "*/1 * * * *", // Every 1 minute
          startFileId: 500,
          endFileId: 400,
          batchSize: 5,
          status: JobStatus.PENDING,
          priority: 7,
          metadata: {
            description: "High frequency batch processing scheduler for testing",
            max_concurrent_batches: 2,
            isSchedulerJob: true
          },
          createdBy: "system",
        },
      ],
    });

    console.log("✅ Database seeding completed successfully!");

    // Print summary
    const summary = await getSeedingSummary();
    console.log("\n📊 Seeding Summary:");
    console.log(`  Refinement Jobs: ${summary.refinementJobs}`);
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    throw error;
  }
}

async function getSeedingSummary() {
  const [systemConfigs, refinementJobs] = await Promise.all([
    prisma.systemConfig.count(),
    prisma.refinementJob.count(),
  ]);

  return {
    systemConfigs,
    refinementJobs,
  };
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
