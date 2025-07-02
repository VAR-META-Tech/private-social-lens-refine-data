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
          batchSize: 10,
          status: JobStatus.PENDING,
          priority: 8,
          metadata: {
            description: "Daily automated batch refinement scheduler",
            isSchedulerJob: true,
            batchIncrement: 100,
            initialStartFileId: 1000
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
        // NOTE: Health check and weekly cleanup schedulers are automatically created 
        // by JobSchedulerService.scheduleSystemJobs() when the service starts.
        // Removed duplicate schedulers to avoid conflicts.
        {
          jobName: "scheduler-frequent-batch-refinement",
          jobType: JobType.SCHEDULED_BATCH,
          cronSchedule: "*/1 * * * *", // Every 1 minute
          batchSize: 5,
          status: JobStatus.PENDING,
          priority: 7,
          metadata: {
            description: "High frequency batch processing scheduler for testing",
            max_concurrent_batches: 2,
            isSchedulerJob: true,
            batchIncrement: 50,
            initialStartFileId: 500
          },
          createdBy: "system",
        },
      ],
    });

    console.log("✅ Database seeding completed successfully!");
    console.log("ℹ️  System schedulers (health-check, weekly-cleanup) will be created automatically when service starts");

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
