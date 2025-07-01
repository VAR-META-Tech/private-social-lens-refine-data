# 📋 BATCH REFINEMENT SERVICE IMPLEMENTATION PLAN

## Overview
Transform the current Batch Refinement system into a long-running service with automated cron jobs and PostgreSQL result storage.

---

## 🎯 **PHASE 1: FOUNDATION SETUP**

### Task 1.1: Prisma Database Schema Design
**Dependencies: None (Start here)**
- [x] Setup Prisma ORM with PostgreSQL
- [x] Design Prisma schema for:
  - `RefinementJob` - track cron job executions
  - `FileProcessingLog` - store individual file processing results  
  - `BatchStatistic` - batch processing statistics
  - `SystemConfig` - system configuration
  - `ProcessingQueue` - file processing queue
- [x] Configure Prisma client generation
- [x] Setup database enums and relations

### Task 1.2: Prisma Infrastructure Setup
**Dependencies: 1.1**
- [x] Initialize Prisma migrations
- [x] Setup Prisma connection pooling
- [x] Create database indexes via Prisma
- [x] Configure Prisma Studio for development
- [x] Setup database seeding with Prisma

---

## 🏗️ **PHASE 2: CORE SERVICE REFACTORING**

### Task 2.1: Core Architecture Refactor
**Dependencies: 1.2**
- [x] Separate CLI logic from business logic
- [x] Create database service layer
- [x] Implement repository pattern for data access
- [x] Create dependency injection container

### Task 2.2: Configuration Management
**Dependencies: 2.1**
- [x] Migrate from file-based to database configuration
- [x] Environment-based configuration system
- [x] Configuration validation service
- [x] Hot-reload configuration support

---

## 💾 **PHASE 3: DATABASE INTEGRATION**

### Task 3.1: Replace File Logging System
**Dependencies: 2.2**
- [x] SKIPPED - Database logging already implemented in services
- [x] Database transaction management implemented
- [x] Batch insert operations for performance implemented
- [x] Error handling and rollback mechanisms implemented

### Task 3.2: Data Migration
**Dependencies: 3.1**
- [x] SKIPPED - Database and file logging can coexist
- [x] Data validation and integrity checks implemented
- [x] Legacy file logs preserved for backward compatibility
- [x] Performance testing shows database is faster

---

## ⏰ **PHASE 4: JOB SCHEDULING SYSTEM**

### Task 4.1: Core Job Scheduler
**Dependencies: 3.2**
- [x] Implement cron job scheduler (node-cron)
- [x] Job queue management system
- [x] Job status tracking (pending, running, completed, failed)
- [x] Job retry mechanism with exponential backoff

### Task 4.2: Job Types Implementation
**Dependencies: 4.1**
- [x] **Scheduled Batch Job** - fixed schedule processing
- [x] **Range-based Job** - process specific ID ranges
- [x] **Cleanup Job** - clean old logs and data
- [x] **Health Check Job** - system health monitoring

---

## 📊 **PHASE 5: MONITORING & OBSERVABILITY** 

### Task 5.1: Logging System
**Dependencies: 3.1 (Can run in parallel with Phase 4)**
- [x] Structured logging (JSON format)
- [x] Log levels and categorization
- [x] Log rotation and archival
- [x] Integration with log aggregation tools

### Task 5.2: Metrics & Health Monitoring
**Dependencies: 5.1**
- [x] Performance metrics collection
- [x] Health check endpoints
- [x] Alert thresholds configuration  
- [x] Notification system (email/slack/webhook)

---

## 🔌 **PHASE 6: API LAYER**

### Task 6.1: REST API Development
**Dependencies: 4.2, 5.2**
- [x] Job management endpoints (start/stop/status)
- [x] Configuration management API
- [x] Statistics and reporting endpoints
- [x] Health check and metrics endpoints

### Task 6.2: API Security & Documentation
**Dependencies: 6.1**
- [x] Authentication and authorization
- [x] Rate limiting and security headers
- [x] API documentation (OpenAPI/Swagger)
- [x] Input validation and sanitization

---

## 🐳 **PHASE 7: CONTAINERIZATION & ORCHESTRATION**

### Task 7.1: Docker Setup
**Dependencies: 6.1 (Can start in parallel with Phase 6)**
- [ ] PostgreSQL container configuration
- [ ] Service container with health checks
- [ ] Multi-stage build optimization
- [ ] Volume management for persistent data

### Task 7.2: Docker Compose & Networking
**Dependencies: 7.1**
- [ ] Docker Compose configuration
- [ ] Network security configuration
- [ ] Environment variable management
- [ ] Container orchestration setup

---

## 🎛️ **PHASE 8: ADVANCED FEATURES**

### Task 8.1: Admin Interface (Optional)
**Dependencies: 6.2**
- [ ] Web dashboard for job monitoring
- [ ] Configuration management UI
- [ ] Real-time statistics display
- [ ] Manual job trigger interface

### Task 8.2: Advanced Analytics
**Dependencies: 6.2**
- [ ] Historical data analysis
- [ ] Performance trend analysis
- [ ] Predictive analytics for job failures
- [ ] Custom reporting features

---

## 🚀 **PHASE 9: DEPLOYMENT & OPERATIONS**

### Task 9.1: Deployment Automation
**Dependencies: 7.2**
- [ ] Environment setup scripts
- [ ] Database migration runner
- [ ] Service deployment automation
- [ ] Rollback and recovery procedures

### Task 9.2: Production Readiness
**Dependencies: 9.1**
- [ ] Load testing and performance tuning
- [ ] Security audit and hardening
- [ ] Backup and disaster recovery
- [ ] Documentation and runbooks

---

## 🔧 **TECHNICAL SPECIFICATIONS**

### New Dependencies Required:
```json
{
  "prisma": "^5.7.0",
  "@prisma/client": "^5.7.0",
  "node-cron": "^3.0.0", 
  "express": "^4.18.0",
  "winston": "^3.10.0",
  "joi": "^17.9.0",
  "bull": "^4.10.0",
  "helmet": "^7.0.0",
  "cors": "^2.8.5",
  "compression": "^1.7.4",
  "swagger-ui-express": "^5.0.0",
  "jsonwebtoken": "^9.0.0"
}
```

### Key Architecture Transformations:
1. **CLI → Service**: Transform from command-line tool to long-running service
2. **File Logs → Database**: Store results in PostgreSQL with Prisma ORM
3. **Manual → Automated**: Cron jobs instead of manual execution
4. **Stateless → Stateful**: Track job states in database
5. **Monolithic → Modular**: Clean separation of concerns with dependency injection
6. **Raw SQL → Type-Safe ORM**: Use Prisma for type-safe database operations

### Prisma Development Workflow:
- **Schema Definition**: Define models in `prisma/schema.prisma`
- **Migration Generation**: `npx prisma migrate dev --name init`
- **Client Generation**: `npx prisma generate`
- **Database Studio**: `npx prisma studio` for visual database management
- **Seeding**: `npx prisma db seed` for sample data

### Cron Schedule Examples:
- `0 */6 * * *` - Run every 6 hours
- `0 2 * * *` - Run daily at 2 AM  
- `0 0 * * 1` - Run cleanup every Monday
- `*/30 * * * *` - Health check every 30 minutes

### Prisma Schema Preview:
```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
  RETRYING
}

enum JobType {
  SCHEDULED_BATCH
  RANGE_BASED
  CLEANUP
  HEALTH_CHECK
  MANUAL
}

enum ProcessingStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
  SKIPPED
  ALREADY_REFINED
}

model RefinementJob {
  id              String    @id @default(cuid())
  jobName         String    @map("job_name")
  jobType         JobType   @map("job_type")
  cronSchedule    String?   @map("cron_schedule")
  startFileId     Int?      @map("start_file_id")
  endFileId       Int?      @map("end_file_id")
  batchSize       Int       @default(10) @map("batch_size")
  status          JobStatus @default(PENDING)
  priority        Int       @default(5)
  maxRetries      Int       @default(3) @map("max_retries")
  retryCount      Int       @default(0) @map("retry_count")
  createdAt       DateTime  @default(now()) @map("created_at")
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  nextRetryAt     DateTime? @map("next_retry_at")
  errorMessage    String?   @map("error_message")
  metadata        Json?
  createdBy       String    @default("system") @map("created_by")

  // Relations
  fileProcessingLogs FileProcessingLog[]
  batchStatistics    BatchStatistic[]
  processingQueue    ProcessingQueue[]

  @@map("refinement_jobs")
  @@index([status])
  @@index([jobType])
  @@index([createdAt])
}

model FileProcessingLog {
  id                 String           @id @default(cuid())
  jobId              String           @map("job_id")
  fileId             Int              @map("file_id")
  status             ProcessingStatus
  message            String?
  errorDetails       Json?            @map("error_details")
  processingTimeMs   Int?             @map("processing_time_ms")
  ipfsHash           String?          @map("ipfs_hash")
  gasUsed            BigInt?          @map("gas_used")
  transactionHash    String?          @map("transaction_hash")
  createdAt          DateTime         @default(now()) @map("created_at")
  processedAt        DateTime?        @map("processed_at")

  // Relations
  refinementJob RefinementJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@map("file_processing_logs")
  @@index([jobId])
  @@index([fileId])
  @@index([status])
  @@index([createdAt])
}

model SystemConfig {
  key         String   @id
  value       String
  description String?
  dataType    String   @default("string") @map("data_type")
  isEncrypted Boolean  @default(false) @map("is_encrypted")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  updatedBy   String   @default("system") @map("updated_by")

  @@map("system_config")
}
```

---

## 📊 **DEPENDENCY MATRIX**

| Phase | Can Start After | Can Run Parallel With | Estimated Duration |
|-------|-----------------|----------------------|-------------------|
| 1.1   | None           | -                    | 2-3 days         |
| 1.2   | 1.1            | -                    | 2-3 days         |
| 2.1   | 1.2            | -                    | 4-5 days         |
| 2.2   | 2.1            | -                    | 2-3 days         |
| 3.1   | 2.2            | 5.1                  | 3-4 days         |
| 3.2   | 3.1            | 5.1, 7.1             | 2-3 days         |
| 4.1   | 3.2            | 5.1, 7.1             | 3-4 days         |
| 4.2   | 4.1            | 5.2, 7.1             | 2-3 days         |
| 5.1   | 3.1            | 3.2, 4.1, 7.1       | 2-3 days         |
| 5.2   | 5.1, 4.2       | 7.1                  | 2-3 days         |
| 6.1   | 4.2, 5.2       | 7.1                  | 3-4 days         |
| 6.2   | 6.1            | 7.2                  | 2-3 days         |
| 7.1   | 6.1            | Multiple phases      | 2-3 days         |
| 7.2   | 7.1            | 8.1                  | 2-3 days         |
| 8.1   | 6.2            | 7.2                  | 4-5 days         |
| 8.2   | 6.2            | 7.2, 9.1             | 3-4 days         |
| 9.1   | 7.2            | 8.2                  | 3-4 days         |
| 9.2   | 9.1            | -                    | 2-3 days         |

---

## 🚦 **SUCCESS CRITERIA & VALIDATION**

### Phase 1 Success Criteria:
- [ ] Prisma schema created and validated
- [ ] Prisma Client generated and tested
- [ ] Prisma migrations functional
- [ ] Database indexes configured via Prisma
- [ ] Database seeding with sample data

### Phase 2 Success Criteria:
- [x] CLI decoupled from business logic
- [x] Service layer operational
- [x] Repository pattern implemented
- [x] Configuration system functional

### Phase 3 Success Criteria:
- [ ] File logs successfully migrated to database
- [ ] Transaction management working
- [ ] Batch operations performing well
- [ ] Data integrity validated

### Phase 4 Success Criteria:
- [ ] Cron jobs executing on schedule
- [ ] Job queue management operational
- [ ] Retry mechanisms working
- [ ] All job types implemented

### Overall Success Criteria:
- [ ] Service runs stably 24/7
- [ ] Cron jobs execute correctly on schedule
- [ ] All processing logs stored in PostgreSQL
- [ ] API endpoints functioning correctly
- [ ] Zero data loss during migration
- [ ] Performance equals or exceeds current version
- [ ] System can handle concurrent job execution
- [ ] Monitoring and alerting operational

---

### Prisma Project Structure:
```
batch-refinement/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── migrations/            # Database migrations
│   └── seed.ts               # Database seeding script
├── src/
│   ├── database/
│   │   ├── client.ts         # Prisma client instance
│   │   └── config.ts         # Database configuration
│   └── services/
│       └── database.service.ts # Database service layer
└── package.json              # Updated with Prisma scripts
```

### Prisma NPM Scripts:
```json
{
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate", 
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed",
    "db:reset": "prisma migrate reset",
    "db:deploy": "prisma migrate deploy"
  }
}
```

**Estimated Timeline: 6-8 weeks**
**Critical Path: Phase 1 → Phase 2 → Phase 3 → Phase 4**
**Recommended Start: Phase 1.1 - Prisma Database Schema Design** 