/**
 * Prisma Database Seeding Script
 * Populates the database with sample data for development and testing
 */

import { PrismaClient, JobStatus, JobType } from "./generated/prisma";
import * as bcrypt from 'bcrypt'
import { logger } from './services/logging.service';

const prisma = new PrismaClient();

async function main() {
  logger.info('🌱 Starting database seeding...');

  try {
    // Clear existing data in development
    if (process.env.NODE_ENV === "development") {
      logger.info('🧹 Clearing existing data...');
      await prisma.refinementJob.deleteMany();
    }

    // Create initial admin user
    const adminEmail = 'admin@example.com'
    const adminPassword = 'admin123' // This should be changed after first login

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: 'System Admin',
          role: 'ADMIN',
          isActive: true
        }
      })
      logger.info('Created initial admin user')
    }

    // Print summary
    const summary = await getSeedingSummary();
    logger.info("\n📊 Seeding Summary:");
    logger.info(`  Refinement Jobs: ${summary.refinementJobs}`);
  } catch (error) {
    logger.error("❌ Database seeding failed:", error as Error);
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
    logger.error("❌ Seeding failed:", e as Error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
