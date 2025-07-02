# 🚀 Batch Refinement Service

A high-performance, production-ready service for processing and refining files in batches with automated job scheduling, REST API, and comprehensive monitoring.

## 📋 Project Status

**Current Phase**: ✅ **Phase 6: API Layer** - COMPLETED  
**Next Phase**: 🚧 **Phase 7: Containerization & Orchestration**

### Completed Phases
- ✅ **Phase 1**: Foundation Setup (Prisma & Database)
- ✅ **Phase 2**: Core Service Refactoring  
- ✅ **Phase 3**: Database Integration
- ✅ **Phase 4**: Job Scheduling System
- ✅ **Phase 5**: Monitoring & Observability
- ✅ **Phase 6**: API Layer

---

## 🏗️ Architecture Overview

The service has been transformed from a CLI tool into a **long-running service** with:

- **🔄 Automated Job Scheduling**: Cron-based job execution
- **🗄️ PostgreSQL Database**: Persistent storage with Prisma ORM
- **🌐 REST API**: Complete HTTP API for external integrations
- **📊 Real-time Monitoring**: Health checks and performance metrics
- **🔒 Enterprise Security**: JWT authentication and role-based access
- **📚 API Documentation**: Interactive Swagger UI

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   REST API      │    │  Job Scheduler  │    │   Database      │
│   (Express)     │    │   (node-cron)   │    │  (PostgreSQL)   │
│                 │    │                 │    │                 │
│ • Auth & Auth   │◄──►│ • Cron Jobs     │◄──►│ • Prisma ORM    │
│ • Rate Limiting │    │ • Queue Mgmt    │    │ • Migrations    │
│ • Documentation │    │ • Retry Logic   │    │ • Connection    │
│ • Validation    │    │ • Health Checks │    │   Pooling       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Core Services  │
                    │                 │
                    │ • File Process  │
                    │ • Batch Stats   │
                    │ • Health Mon    │
                    │ • Logging       │
                    │ • Config Mgmt   │
                    └─────────────────┘
```

---

## 📊 Data Flow & Job Types

The service supports multiple job types with different execution patterns and data flows. Here's how the two main job types work:

### Job Types Overview

| Job Type | Trigger | Configuration | Use Case |
|----------|---------|---------------|----------|
| **SCHEDULED_BATCH** | Cron schedule (automatic) | Auto-incrementing ranges | Recurring automated processing (creates RANGE_BASED jobs with calculated ranges) |
| **RANGE_BASED** | Manual/API call or from SCHEDULED_BATCH | Required parameters | Actual file processing execution |

### Data Flow Architecture

```mermaid
graph TD
    A[User/Cron Scheduler] --> B{Job Type?}
    
    B -->|SCHEDULED_BATCH| C[Create Scheduled Batch Job]
    B -->|RANGE_BASED| D[Create Range-Based Job<br/>Manual/API or from SCHEDULED_BATCH]
    
    C --> E[Job Config from metadata/defaults<br/>batchIncrement: 100<br/>cronSchedule: required<br/>Auto-calculate next range]
    D --> F[Job Config from parameters<br/>startFileId: required<br/>endFileId: required<br/>No cron schedule]
    
    E --> G[JobSchedulerService.executeScheduledBatchJob]
    F --> H[JobSchedulerService.executeRangeBasedJob]
    
    G --> D
    
    H --> I[BatchProcessor.processByFileRange]
    
    I --> J[Create RefinementJob in DB<br/>Status: PENDING → RUNNING]
    
    J --> K[Generate File IDs List<br/>Descending order: startFileId → endFileId]
    
    K --> L[Create ProcessingQueue entries<br/>for all file IDs]
    
    L --> M[Create BatchStatistics record]
    
    M --> N[Process files in batches<br/>parallel processing]
    
    N --> O{For each file}
    
    O --> P[Check file permissions/EEK]
    P --> Q{Has EEK?}
    Q -->|No| R[Log SKIPPED<br/>No EEK or file not exist]
    Q -->|Yes| S[Check if already refined]
    
    S --> T{Already refined?}
    T -->|Yes| U[Log ALREADY_REFINED]
    T -->|No| V[Decrypt EEK]
    
    V --> W[Call Refinement API]
    W --> X{API Success?}
    X -->|Yes| Y[Log SUCCESS<br/>Store IPFS hash, gas, tx hash]
    X -->|No| Z[Log FAILED<br/>Store error details]
    
    R --> AA[Update ProcessingQueue status]
    U --> AA
    Y --> AA
    Z --> AA
    
    AA --> BB[Update FileProcessingLog]
    BB --> CC[Aggregate BatchStatistics]
    
    CC --> DD[Complete Job<br/>Status: COMPLETED/FAILED]
    
    DD --> EE[Return ProcessingResult<br/>Total, success, failed counts]
    
    style C fill:#e1f5fe
    style D fill:#f3e5f5
    style I fill:#fff3e0
    style N fill:#e8f5e8
```

### 1. JobType.SCHEDULED_BATCH (Automated Job Creator)

**Characteristics:**
- **Trigger**: Automatic execution based on cron schedule
- **Configuration**: Retrieved from `job.metadata` with fallback to defaults
- **Scheduling**: Requires `cronSchedule` field (e.g., `"0 2 * * *"` for daily at 2 AM)
- **Use Case**: Recurring job creation, creates RANGE_BASED jobs for actual processing

**Data Flow:**

1. **Job Creation & Scheduling**
   ```typescript
   // Example: Daily batch processing at 2 AM with auto-incrementing ranges
   {
     jobName: 'daily-batch-refinement',
     jobType: 'SCHEDULED_BATCH',
     cronSchedule: '0 2 * * *',
     metadata: {
       batchIncrement: 100,          // Process 100 files per execution
       initialStartFileId: 100,      // First run: 200-100, second run: 300-200, etc.
       description: 'Daily automated processing with auto-incrementing ranges'
     }
   }
   ```

2. **Execution Trigger**
   - Cron scheduler automatically triggers job at scheduled time
   - `JobSchedulerService.executeScheduledBatchJob()` is called
   - Configuration loaded from `job.metadata` with intelligent defaults

3. **Dynamic Range Calculation & RANGE_BASED Job Creation**
   - Calculates next file range based on previous execution:
     - First run: `initialStartFileId` to `initialEndFileId` (e.g., 100 to 0)
     - Subsequent runs: Previous start + increment to previous start (e.g., 200 to 100)
   - Creates a new RANGE_BASED job with calculated range
   - Updates job metadata with execution tracking information
        - RANGE_BASED job is then executed for actual file processing

#### Auto-Incrementing Range Logic

The SCHEDULED_BATCH jobs use an intelligent auto-incrementing range system:

**Configuration Parameters:**
- `batchIncrement`: Number of files to process per execution (default: 100)
- `initialStartFileId`: Starting file ID for first execution (default: 100)

**Execution Pattern:**
```
Execution 1: startFileId=200,  endFileId=100  (processes files 200 down to 100)
Execution 2: startFileId=300,  endFileId=200  (processes files 300 down to 200)
Execution 3: startFileId=400,  endFileId=300  (processes files 400 down to 300)
...
Execution n: startFileId=(n+1)*100, endFileId=n*100
```

**Tracking in Metadata:**
```typescript
metadata: {
  lastExecution: {
    executionNumber: 3,
    startFileId: 400,
    endFileId: 300,
    executedAt: "2024-01-15T02:00:00Z",
    filesProcessed: 101,
    successfulFiles: 95,
    failedFiles: 6
  }
}
```

### 2. JobType.RANGE_BASED (Actual File Processing)

**Characteristics:**
- **Trigger**: Manual execution, API call, or created by SCHEDULED_BATCH
- **Configuration**: `startFileId` and `endFileId` are required parameters
- **Scheduling**: No cron schedule needed
- **Use Case**: Actual file processing execution for specific file ranges

**Data Flow:**

1. **Job Creation**
   ```typescript
   // Example: Process files 1000-900
   {
     jobName: 'manual-range-1000-900',
     jobType: 'RANGE_BASED',
     startFileId: 1000,
     endFileId: 900,
     batchSize: 10,
     priority: 8
   }
   ```

2. **Execution Trigger**
   - Immediate execution after creation or manual trigger
   - `JobSchedulerService.executeRangeBasedJob()` is called
   - Validates required `startFileId` and `endFileId` parameters

3. **Processing Pipeline**
   - Calls `BatchProcessor.processByFileRange()` with job parameters
   - Follows shared processing logic (see below)

### 3. Shared Processing Logic (BatchProcessor)

Both job types converge into the same processing pipeline:

#### Phase 1: Job Setup & Database Preparation
```typescript
// 1. Create RefinementJob record
const job = await refinementJobService.createJob({
  jobName: config.jobName,
  jobType: JobType.RANGE_BASED, // or SCHEDULED_BATCH
  startFileId: config.startFileId,
  endFileId: config.endFileId,
  status: 'PENDING'
});

// 2. Start the job (PENDING → RUNNING)
await refinementJobService.startJob(job.id);
```

#### Phase 2: File ID Generation & Queue Setup
```typescript
// 3. Generate file IDs in descending order
const fileIds: number[] = [];
for (let id = startFileId; id >= endFileId; id--) {
  fileIds.push(id);
}

// 4. Create processing queue entries
await fileProcessingService.createQueueEntries(job.id, fileIds, priority);

// 5. Initialize batch statistics
await batchStatisticsService.createBatchStats({
  jobId: job.id,
  totalFiles: fileIds.length
});
```

#### Phase 3: Batch Processing Loop
```typescript
// 6. Process files in batches with parallel execution
for (let i = 0; i < fileIds.length; i += batchSize) {
  const batchFileIds = fileIds.slice(i, i + batchSize);
  
  const batchResults = await Promise.allSettled(
    batchFileIds.map(fileId => this.processFile(job.id, fileId))
  );
  
  // Count and log results
  // Update progress statistics
}
```

#### Phase 4: Individual File Processing Pipeline

For each file, the system follows this detailed workflow:

1. **Permission Check**
   ```typescript
   const encryptedEEK = await getFilePermissions(fileId);
   if (!encryptedEEK) return 'SKIPPED'; // No EEK found
   ```

2. **Refinement Status Check**
   ```typescript
   const isAlreadyRefined = await checkFileRefinement(fileId);
   if (isAlreadyRefined) return 'ALREADY_REFINED';
   ```

3. **EEK Decryption**
   ```typescript
   const dataEncryptionKey = await decryptEEK(encryptedEEK, fileId);
   ```

4. **Refinement API Call**
   ```typescript
   const result = await refineFile(fileId, dataEncryptionKey);
   // Returns: IPFS hash, transaction hash, gas used
   ```

5. **Result Logging**
   ```typescript
   await fileProcessingService.logSuccess({
     jobId, fileId,
     ipfsHash: result.ipfsHash,
     gasUsed: result.gasUsed,
     transactionHash: result.transactionHash
   });
   ```

#### Phase 5: Aggregation & Completion
```typescript
// 7. Aggregate final statistics from individual file logs
await batchStatisticsService.aggregateFromLogs(job.id);

// 8. Complete the job (RUNNING → COMPLETED/FAILED)
await refinementJobService.completeJob(job.id, success);

// 9. Return comprehensive results
return {
  jobId: job.id,
  totalFiles: fileIds.length,
  successfulFiles: successCount,
  failedFiles: failedCount,
  alreadyRefinedFiles: alreadyRefinedCount,
  skippedFiles: skippedCount,
  processingTimeMs: totalTime
};
```

### 4. Database Tables in the Flow

The data flow involves these key database tables:

1. **`refinement_jobs`**: Job metadata and status tracking
2. **`processing_queue`**: File processing queue with priority management
3. **`file_processing_logs`**: Detailed logs for each file processed
4. **`batch_statistics`**: Aggregated statistics and performance metrics
5. **`system_config`**: Dynamic configuration (batch size, priorities, etc.)

### 5. Error Handling & Retry Mechanisms

Both job types include comprehensive error handling:

- **File-level retries**: Individual files can be retried with exponential backoff
- **Job-level retries**: Entire jobs can be retried if they fail
- **Partial completion**: Jobs can complete successfully even if some files fail
- **Detailed error logging**: All errors are captured with context and stack traces
- **Queue management**: Failed files are marked for retry or manual intervention

### 6. Monitoring & Observability

The system provides real-time monitoring for both job types:

- **Real-time progress**: Track processing progress via WebSocket or polling
- **Performance metrics**: Processing time, throughput, error rates
- **Resource usage**: Memory, CPU, database connection utilization
- **Business metrics**: Success rates, file refinement statistics
- **Health checks**: Automated health monitoring and alerting

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.x or later
- **PostgreSQL** 13.x or later
- **npm** or **yarn**

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd batch-refinement

# Install dependencies
npm install

# Setup environment variables
cp env.example .env
# Edit .env with your configuration
```

### 2. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 3. Start the Service

#### CLI Mode (Legacy)
```bash
npm start -- --start 1000 --end 900 --batch 10
```

#### Service Mode (Recommended)
```bash
# Start as long-running service
npm run service

# Start with API server
npm run api

# Development mode with auto-reload
npm run dev:api
```

### 4. Access the API

- **API Base URL**: `http://localhost:3000/api`
- **API Documentation**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/health`

---

## 🌐 API Usage

### Authentication

The API supports two authentication methods:

#### JWT Authentication
```bash
# Get token (implement your auth endpoint)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Use token
curl -H "Authorization: Bearer <jwt-token>" \
     http://localhost:3000/api/jobs
```

#### API Key Authentication
```bash
curl -H "X-API-Key: demo-api-key-for-development" \
     http://localhost:3000/api/jobs
```

### Job Management

#### List Jobs
```bash
# List all jobs
curl http://localhost:3000/api/jobs

# Filter by status
curl "http://localhost:3000/api/jobs?status=RUNNING&limit=10"

# Filter by date range
curl "http://localhost:3000/api/jobs?startDate=2024-01-01&endDate=2024-01-31"
```

#### Create New Job
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "jobName": "manual-refinement-job",
    "jobType": "RANGE_BASED",
    "startFileId": 1000,
    "endFileId": 900,
    "batchSize": 10,
    "priority": 5
  }'
```

#### Job Control
```bash
# Start a job
curl -X POST http://localhost:3000/api/jobs/{jobId}/start \
     -H "Authorization: Bearer <token>"

# Stop a job
curl -X POST http://localhost:3000/api/jobs/{jobId}/stop \
     -H "Authorization: Bearer <token>"

# Retry a failed job
curl -X POST http://localhost:3000/api/jobs/{jobId}/retry \
     -H "Authorization: Bearer <token>"
```

### Configuration Management

```bash
# Get all configuration
curl http://localhost:3000/api/config

# Get specific config
curl http://localhost:3000/api/config/processing.batch_size

# Update configuration
curl -X PUT http://localhost:3000/api/config/processing.batch_size \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"value": "20", "description": "Updated batch size"}'
```

### Statistics & Monitoring

```bash
# System overview
curl http://localhost:3000/api/stats/overview

# Job performance statistics
curl "http://localhost:3000/api/stats/jobs?timeframe=24h"

# System performance metrics
curl http://localhost:3000/api/stats/performance

# Export data as CSV
curl http://localhost:3000/api/stats/export?format=csv&timeframe=7d
```

---

## 🗄️ Database Schema

### Core Tables

- **`refinement_jobs`**: Job management and scheduling
- **`file_processing_logs`**: Individual file processing results
- **`processing_queue`**: File processing queue with priorities
- **`batch_statistics`**: Aggregated batch processing statistics
- **`system_config`**: Dynamic configuration management

### Prisma Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and apply migration
npm run db:migrate

# View database in Prisma Studio
npm run db:studio

# Reset database (development only)
npm run db:reset

# Deploy migrations (production)
npm run db:deploy
```

---

## ⏰ Job Scheduling

### Cron Job Types

1. **SCHEDULED_BATCH**: Automated cron jobs
   - Example: `"0 2 * * *"` (Daily at 2 AM)
   - Example: `"0 */6 * * *"` (Every 6 hours)

2. **RANGE_BASED**: Process specific file ID ranges
   - Manual or API-triggered
   - Configurable start/end file IDs

3. **CLEANUP**: Maintenance jobs
   - Clean old logs and temporary data
   - Archive completed jobs

4. **HEALTH_CHECK**: System monitoring
   - Regular health verification
   - Performance metrics collection

### Job Configuration

```typescript
interface JobConfig {
  jobName: string
  jobType: 'SCHEDULED_BATCH' | 'RANGE_BASED' | 'CLEANUP' | 'HEALTH_CHECK'
  cronSchedule?: string  // For scheduled jobs
  startFileId?: number   // For range-based jobs
  endFileId?: number
  batchSize: number
  priority: number       // 1-10 (higher = more important)
  maxRetries: number
}
```

---

## 📊 Monitoring & Health Checks

### Health Endpoints

```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed system health
curl http://localhost:3000/api/health/detailed

# Kubernetes readiness probe
curl http://localhost:3000/api/health/readiness

# Kubernetes liveness probe
curl http://localhost:3000/api/health/liveness
```

### System Metrics

- **Job Statistics**: Success/failure rates, processing times
- **Performance Metrics**: CPU, memory, throughput
- **Error Analysis**: Failure patterns and trends
- **Queue Health**: Processing queue depth and wait times

### Logging

Structured JSON logging with multiple levels:

```bash
# View logs in real-time
tail -f logs/application.log

# Search logs
grep "ERROR" logs/application.log | jq

# Log levels: ERROR, WARN, INFO, DEBUG, TRACE
```

---

## 🔧 Configuration

The service uses a **Hybrid Configuration System** that combines:
- **Environment Variables**: Static, security-sensitive configuration (requires restart)
- **Database Configuration**: Dynamic, business logic configuration (hot-reloadable)

### Environment Variables (Static Configuration)

Create a `.env` file with the following variables:

#### Application & Server
```bash
NODE_ENV=production                                    # Application environment
PORT=3000                                             # Server port
LOG_LEVEL=info                                        # Logging level (error, warn, info, debug, trace)
LOG_DIR=./logs                                        # Log directory path
```

#### Database
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/batch_refinement
```

#### Authentication & Security  
```bash
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
API_KEY=your-api-key-for-development
ADMIN_API_KEY=your-admin-api-key-with-full-access
```

#### Blockchain & DLP (Decentralized Learning Protocol)
```bash
DLP_PRIVATE_KEY=your_dlp_private_key                 # DLP account private key
DLP_ADDRESS=your_dlp_wallet_address                  # DLP wallet address
DATA_REGISTRY_ADDRESS=0x...registry_contract_address # Smart contract address
RPC_URL=https://rpc.moksha.vana.org                  # Blockchain RPC endpoint
```

#### External APIs
```bash
REFINEMENT_SERVICE_API_BASE_URL=https://your-refinement-api.com
```

#### IPFS & Storage
```bash
PINATA_API_KEY=your_pinata_api_key                   # Optional: IPFS via Pinata
PINATA_API_SECRET=your_pinata_api_secret             # Optional: IPFS via Pinata  
PINATA_API_JWT=your_pinata_jwt_token                 # Optional: IPFS via Pinata
```

#### Processing Defaults (Override Database Config)
```bash
BATCH_SIZE=10                                        # Default batch size for processing

REFINER_ID=7                                         # Default refiner ID
VERBOSE=false                                        # Enable verbose logging
```

### Database Configuration (Dynamic Configuration)

These settings can be changed via API **without restarting** the service:

#### Processing Configuration
| Key | Default | Description |
|-----|---------|-------------|
| `processing.batch_size` | `10` | Number of files processed per batch |
| `processing.max_concurrent_jobs` | `5` | Maximum parallel jobs |
| `processing.default_priority` | `5` | Default job priority (1-10) |
| `processing.max_retries` | `3` | Maximum retry attempts for failed jobs |
| `processing.retry_delay_seconds` | `300` | Delay between retry attempts |

#### Cron Schedules
| Key | Default | Description |
|-----|---------|-------------|
| `cron.batch_processing` | `0 */6 * * *` | Batch processing schedule (every 6 hours) |
| `cron.cleanup_old_logs` | `0 2 * * 1` | Log cleanup schedule (Monday 2 AM) |
| `cron.health_check` | `*/30 * * * *` | Health check schedule (every 30 minutes) |

#### API Configuration
| Key | Default | Description |
|-----|---------|-------------|
| `api.refinement_timeout_ms` | `30000` | API request timeout (30 seconds) |

#### Feature Flags
| Key | Default | Description |
|-----|---------|-------------|
| `features.auto_retry` | `true` | Enable automatic retry for failed jobs |
| `features.parallel_processing` | `true` | Enable parallel file processing |

#### Logging Configuration
| Key | Default | Description |
|-----|---------|-------------|
| `logging.level` | `info` | Runtime log level |
| `logging.max_file_size_mb` | `10` | Maximum log file size |

### Configuration Management API

#### View Configuration
```bash
# Get all configuration
curl http://localhost:3000/api/config

# Get specific configuration group
curl http://localhost:3000/api/config?prefix=processing

# Get single configuration value
curl http://localhost:3000/api/config/processing.batch_size
```

#### Update Configuration (Requires Admin Token)
```bash
# Update processing configuration
curl -X PUT http://localhost:3000/api/config/processing.batch_size \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "value": "20",
    "description": "Increased batch size for better throughput"
  }'

# Update cron schedule
curl -X PUT http://localhost:3000/api/config/cron.batch_processing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "value": "0 */4 * * *",
    "description": "Changed to every 4 hours for faster processing"
  }'

# Enable/disable features
curl -X PUT http://localhost:3000/api/config/features.auto_retry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "value": "false",
    "description": "Disabled auto-retry for debugging"
  }'
```

#### Configuration Hot-Reload
```bash
# Force configuration refresh
curl -X POST http://localhost:3000/api/config/reload \
  -H "Authorization: Bearer <admin-token>"

# Validate all configuration
curl http://localhost:3000/api/config/validate
```

#### Configuration Backup & Restore
```bash
# Export configuration
curl http://localhost:3000/api/config/export > config-backup.json

# Import configuration (Admin only)
curl -X POST http://localhost:3000/api/config/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d @config-backup.json
```

### Configuration Validation

The system validates configuration on:
- Service startup
- Configuration updates via API
- Periodic health checks

**Validation Rules:**
- Batch size: 1-1000
- Max concurrent jobs: 1-50  
- API timeout: 1-300 seconds
- Cron expressions: Valid 5-field format
- Feature flags: boolean values only

---

## 🐳 Docker Deployment

### Basic Docker Usage

```bash
# Build image
docker build -t batch-refinement .

# Run in legacy CLI mode
docker run --rm --env-file .env \
  batch-refinement --start 1000 --end 900

# Run as service
docker run -d --name batch-refinement-service \
  --env-file .env \
  -p 3000:3000 \
  batch-refinement npm run service

# Run with API
docker run -d --name batch-refinement-api \
  --env-file .env \
  -p 3000:3000 \
  batch-refinement npm run api
```

### Docker Compose (Coming in Phase 7)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/batch_refinement
  
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=batch_refinement
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 📁 Project Structure

```
batch-refinement/
├── docs/                           # Documentation
│   ├── plan.md                     # Implementation plan
│   ├── data-flow.md               # Database schema docs
│   └── phase*-completion-summary.md # Phase summaries
├── prisma/                         # Database schema & migrations
│   ├── schema.prisma              # Prisma schema definition
│   ├── migrations/                # Database migrations
│   └── seed.ts                    # Database seeding
├── src/
│   ├── api/                       # REST API layer
│   │   ├── middleware/            # Express middleware
│   │   ├── routes/                # API route handlers
│   │   └── server.ts              # Express server setup
│   ├── application/               # Application entry points
│   │   ├── cli-application.ts     # CLI interface
│   │   └── service-application.ts # Service interface
│   ├── core/                      # Core business logic
│   │   ├── batch-processor.ts     # Batch processing logic
│   │   └── container.ts           # Dependency injection
│   ├── database/                  # Database layer
│   │   ├── client.ts              # Prisma client
│   │   └── connection-pool.ts     # Connection pooling
│   ├── services/                  # Business services
│   │   ├── job-scheduler.service.ts
│   │   ├── health-monitoring.service.ts
│   │   ├── batch-statistics.service.ts
│   │   └── system-config.service.ts
│   ├── config/                    # Configuration management
│   └── utils/                     # Utility functions
├── tests/                         # Validation tests
└── package.json                   # Dependencies & scripts
```

---

## 🔄 Development Workflow

### Available Scripts

```bash
# Legacy CLI mode
npm start                          # Run CLI application
npm run cli                        # Run CLI application

# Service mode
npm run service                    # Run as long-running service
npm run dev:service               # Development mode with auto-reload

# API mode
npm run api                        # Run API server
npm run dev:api                   # Development mode with auto-reload

# Database operations
npm run db:generate               # Generate Prisma client
npm run db:migrate                # Create and apply migration
npm run db:studio                 # Open Prisma Studio
npm run db:seed                   # Seed database with sample data
npm run db:reset                  # Reset database (dev only)

# Development tools
npm run lint                      # Run ESLint
npm run test                      # Run tests
npm run validate                  # Run validation tests
```

### Development Mode

```bash
# Start API server with auto-reload
npm run dev:api

# Start service with auto-reload
npm run dev:service

# Open Prisma Studio for database management
npm run db:studio
```

---

## 📊 Monitoring & Analytics

### Key Metrics

- **Job Success Rate**: Percentage of successfully completed jobs
- **Processing Throughput**: Files processed per hour/day
- **Error Rate**: Failed processing percentage and patterns
- **Response Times**: API endpoint performance
- **Queue Health**: Processing queue depth and wait times
- **Resource Usage**: CPU, memory, database connections

### Alerting Integration

Health checks are designed for integration with monitoring systems:

- **Kubernetes**: Readiness and liveness probes
- **Prometheus**: Metrics endpoints (coming in Phase 8)
- **Grafana**: Dashboard integration (coming in Phase 8)
- **PagerDuty/Slack**: Alert notifications (configurable)

---

## 🔐 Security Features

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication with configurable expiration
- **API Keys**: Simple authentication for service-to-service calls
- **Role-Based Access**: Admin, user, and API roles
- **Permission System**: Granular read/write permissions

### Security Hardening
- **Rate Limiting**: IP-based request throttling
- **Input Validation**: Comprehensive request validation with Joi
- **Security Headers**: Helmet.js security headers
- **CORS Configuration**: Configurable cross-origin resource sharing
- **SQL Injection Prevention**: Prisma ORM parameterized queries

---

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database connectivity
npm run db:studio

# Reset database (development only)
npm run db:reset

# Check migration status
npx prisma migrate status
```

#### API Authentication Issues
```bash
# Verify JWT token
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/health

# Check API key configuration
echo $API_KEY
```

#### Job Processing Issues
```bash
# Check job status via API
curl http://localhost:3000/api/jobs/{jobId}

# View job logs
curl http://localhost:3000/api/jobs/{jobId}/logs

# Check system health
curl http://localhost:3000/api/health/detailed
```

### Log Analysis

```bash
# View recent errors
grep "ERROR" logs/application.log | tail -20

# Check job failures
grep "FAILED" logs/application.log | jq .

# Monitor API requests
grep "HTTP" logs/application.log | tail -20
```

---

## 🎯 Performance Optimization

### Database Optimization
- **Connection Pooling**: Prisma connection pooling for high concurrency
- **Indexes**: Strategic indexing for frequent query patterns
- **Batch Operations**: Efficient bulk insert/update operations
- **Query Optimization**: Optimized Prisma queries with proper relations

### API Performance
- **Response Compression**: Gzip compression for large responses
- **Rate Limiting**: Prevent API abuse and ensure fair usage
- **Pagination**: Efficient data pagination for large datasets
- **Caching**: HTTP caching headers for static responses

### Processing Performance
- **Concurrent Processing**: Configurable concurrent job execution
- **Batch Sizing**: Optimized batch sizes for throughput
- **Retry Logic**: Intelligent retry mechanisms with exponential backoff
- **Queue Management**: Priority-based processing queue

---

## 🎉 Success Metrics

### Performance Benchmarks
- **Throughput**: 1000+ files processed per hour
- **API Response Time**: < 100ms for most endpoints
- **Database Queries**: < 50ms average response time
- **System Uptime**: 99.9% availability target
- **Error Rate**: < 1% failed processing rate

### Scalability Targets
- **Concurrent Jobs**: Support for 10+ concurrent refinement jobs
- **API Throughput**: 100+ requests per minute per instance
- **Database Load**: Handle 1000+ concurrent connections
- **File Processing**: Scale to millions of files

---

## 📚 Additional Resources

- **[Implementation Plan](docs/plan.md)**: Detailed phase-by-phase implementation plan
- **[Database Schema](docs/data-flow.md)**: Complete database schema and data flow documentation
- **[API Documentation](http://localhost:3000/api/docs)**: Interactive Swagger documentation
- **[Phase Summaries](docs/)**: Detailed completion summaries for each phase

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Use Prisma for all database operations
- Add API tests for new endpoints
- Update documentation for new features
- Follow the established project structure

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🚀 What's Next?

### Phase 7: Containerization & Orchestration
- Docker Compose setup with PostgreSQL
- Kubernetes deployment manifests
- Container orchestration and scaling
- Production deployment automation

### Phase 8: Advanced Features
- Web dashboard for job monitoring
- Advanced analytics and reporting
- Real-time WebSocket updates
- Performance optimization and caching

The batch refinement service has been successfully transformed from a simple CLI tool into a production-ready, API-driven service with enterprise-grade features. 🎉
