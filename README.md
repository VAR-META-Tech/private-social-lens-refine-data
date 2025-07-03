# 🚀 Batch Refinement Service

A high-performance, production-ready service for processing and refining files in batches with automated job scheduling, REST API, and comprehensive monitoring.

## 📑 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Architecture](#-architecture)
- [Job Lifecycle](#-job-lifecycle)
- [Monitoring & Health Checks](#-monitoring--health-checks)
- [Docker Deployment](#-docker-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🌟 Overview

Batch Refinement Service is a robust solution for processing and refining large batches of files. It supports:

- Automated job scheduling with cron expressions
- RESTful API for external integrations
- Real-time monitoring and health checks
- Comprehensive logging and error handling
- Docker containerization
- PostgreSQL database integration

## ✨ Features

- **Job Management**
  - Automated scheduling
  - Priority-based processing
  - Retry mechanisms
  - Progress tracking

- **API Integration**
  - RESTful endpoints
  - JWT & API key authentication
  - Rate limiting
  - Swagger documentation

- **Monitoring**
  - Health checks
  - Performance metrics
  - Error tracking
  - Real-time statistics

- **Security**
  - Role-based access control
  - Input validation
  - Secure configuration
  - API authentication

## 🔧 Prerequisites

- Node.js 18.x or later
- PostgreSQL 13.x or later
- npm or yarn
- Docker (optional)

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd batch-refinement
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize database**
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Run migrations
   npm run db:migrate

   # (Optional) Seed initial data
   npm run db:seed
   ```

## 🔐 Environment Variables

### Required Environment Variables

#### Database Configuration
```bash
# PostgreSQL connection URL
DATABASE_URL=postgresql://user:password@localhost:5432/batch_refinement
```

#### Application Settings
```bash
# Server configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# API and security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

#### Blockchain & DLP Configuration
```bash
# DLP settings
DLP_PRIVATE_KEY=your_dlp_private_key
DLP_ADDRESS=your_dlp_wallet_address
DATA_REGISTRY_ADDRESS=0x...registry_contract_address
RPC_URL=https://rpc.moksha.vana.org

# External API configuration
REFINEMENT_SERVICE_API_BASE_URL=https://your-refinement-api.com
```

### Optional Environment Variables

#### IPFS Configuration (Optional)
```bash
# Pinata IPFS configuration
PINATA_API_JWT=your_pinata_jwt_token
```

#### Processing Configuration (Optional)
```bash
# Processing settings
BATCH_SIZE=10
REFINER_ID=7
VERBOSE=false

# Feature flags
AUTO_MIGRATE=true
```

## 🚀 Usage

### Running in Different Modes

1. **Service Mode (Recommended)**
   ```bash
   # Start as service
   npm run service

   # Development mode with auto-reload
   npm run dev:service
   ```

2. **API Mode**
   ```bash
   # Start API server
   npm run api

   # Development mode with auto-reload
   npm run dev:api
   ```

3. **CLI Mode (Legacy)**
   ```bash
   npm start -- --start 1000 --end 900 --batch 10
   ```

### Available Scripts

```bash
# Database operations
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run migrations
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed database
npm run db:reset      # Reset database (dev only)

# Development
npm run lint          # Run ESLint
npm run test         # Run tests
npm run validate     # Run validation
```

## 📡 API Documentation

### Authentication

The API supports two authentication methods:

1. **JWT Authentication**
   ```bash
   # Get token
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"password"}'

   # Use token
   curl -H "Authorization: Bearer <jwt-token>" \
        http://localhost:3000/api/jobs
   ```

2. **API Key Authentication**
   ```bash
   curl -H "X-API-Key: your-api-key" \
        http://localhost:3000/api/jobs
   ```

### Key Endpoints

- **API Base**: `http://localhost:3000/api`
- **Swagger Docs**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/health`

## 🏗️ Architecture

```mermaid
graph TD
    A[Client] --> B[API Layer]
    B --> C[Job Scheduler]
    B --> D[Database]
    C --> E[Batch Processor]
    E --> F[File Processing]
    F --> G[Blockchain]
    F --> H[IPFS]
```

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

## 🔄 Job Lifecycle

### Job States Overview

The Batch Refinement Service uses a comprehensive state machine to manage job lifecycles. Each job transitions through specific states based on its type and execution status.

#### Available Job States

| State | Description | Can Transition To |
|-------|-------------|-------------------|
| `PENDING` | Job created, ready to start | `SCHEDULED`, `RUNNING`, `CANCELLED` |
| `SCHEDULED` | Job with cron schedule, waiting for trigger | `RUNNING`, `CANCELLED` |
| `RUNNING` | Job actively executing | `COMPLETED`, `RETRYING`, `FAILED`, `CANCELLED` |
| `COMPLETED` | Single execution completed successfully | `SCHEDULED` (for cron jobs) |
| `RETRYING` | Failed execution, waiting for auto-retry | `RUNNING`, `CANCELLED` |
| `FAILED` | Max retries exceeded, requires manual intervention | `PENDING` (manual retry) |
| `CANCELLED` | Manually stopped by user | `PENDING` (manual retry) |

### Job State Diagram

```mermaid
stateDiagram-v2
    [*] --> PENDING : createJob()
    
    PENDING --> SCHEDULED : startJob()<br/>(job has cronSchedule)
    PENDING --> RUNNING : executeJob()<br/>(job has no cronSchedule)
    PENDING --> CANCELLED : stopJob()
    
    SCHEDULED --> RUNNING : Cron trigger<br/>executeJob()
    SCHEDULED --> CANCELLED : stopJob()
    
    RUNNING --> COMPLETED : Execution success
    RUNNING --> RETRYING : Execution fails<br/>& retryCount < maxRetries
    RUNNING --> FAILED : Execution fails<br/>& retryCount >= maxRetries
    RUNNING --> CANCELLED : stopJob()
    
    RETRYING --> RUNNING : nextRetryAt expires<br/>auto retry
    RETRYING --> CANCELLED : stopJob()
    
    COMPLETED --> SCHEDULED : For scheduled jobs<br/>(wait for next cron)
    
    FAILED --> PENDING : retryJob()<br/>(manual retry)
    CANCELLED --> PENDING : retryJob()<br/>(manual retry)
    
    note right of PENDING
        Job created, ready to start
        Can be one-time or scheduled
    end note
    
    note right of SCHEDULED
        Job with cronSchedule
        Waiting for next trigger
        Task registered in scheduler
    end note
    
    note right of RUNNING
        Job actively executing
        In runningJobs map
        Cannot be retried
    end note
    
    note right of RETRYING
        Failed execution
        nextRetryAt set
        Auto retry pending
    end note
    
    note right of COMPLETED
        Single execution done
        For scheduled jobs: back to SCHEDULED
        For one-time jobs: final state
    end note
    
    note right of FAILED
        Max retries exceeded
        Requires manual intervention
        Can be manually retried
    end note
    
    note right of CANCELLED
        Manually stopped
        Scheduled task removed
        Can be manually restarted
    end note
```

### Job Type Lifecycles

#### 1. Scheduled Jobs (with cronSchedule)
**Infinite Loop Lifecycle:**
```
PENDING → SCHEDULED → RUNNING → COMPLETED → SCHEDULED → RUNNING → ...
```

**Example:**
```javascript
// Daily batch processing at 2 AM
{
  "jobName": "daily-batch-refinement",
  "jobType": "SCHEDULED_BATCH",
  "cronSchedule": "0 2 * * *",
  "metadata": {
    "batchIncrement": 100,
    "initialStartFileId": 1000
  }
}
```

#### 2. One-Time Jobs (no cronSchedule)
**Linear Lifecycle:**
```
PENDING → RUNNING → COMPLETED (final)
```

**Example:**
```javascript
// Process specific file range once
{
  "jobName": "manual-range-processing",
  "jobType": "RANGE_BASED",
  "startFileId": 500,
  "endFileId": 400,
  "batchSize": 10
}
```

#### Manual Recovery
```bash
# Get failed jobs
curl http://localhost:3000/api/jobs?status=FAILED

# Retry specific job
curl -X POST http://localhost:3000/api/jobs/{jobId}/retry

# Check job status
curl http://localhost:3000/api/jobs/{jobId}
```

### Job Monitoring Commands

```bash
# List jobs by status
curl "http://localhost:3000/api/jobs?status=SCHEDULED"
curl "http://localhost:3000/api/jobs?status=RUNNING"
curl "http://localhost:3000/api/jobs?status=FAILED"

# Get job details with execution history
curl "http://localhost:3000/api/jobs/{jobId}"

# View job execution logs
curl "http://localhost:3000/api/jobs/{jobId}/logs"

# Job statistics
curl "http://localhost:3000/api/stats/jobs?since=2024-01-01"
```

### Best Practices

1. **Scheduled Jobs**: Use cron expressions for automated processing
2. **One-Time Jobs**: Use for manual ranges or API-triggered processing  
3. **Error Recovery**: Monitor FAILED jobs and retry manually when needed
4. **Resource Management**: Limit concurrent RUNNING jobs (default: 5)
5. **Monitoring**: Set up alerts for jobs stuck in RETRYING state

## 📊 Monitoring & Health Checks

### Health Endpoints

```bash
# Basic health check
curl http://localhost:3000/api/health

# Detailed health status
curl http://localhost:3000/api/health/detailed

# Kubernetes probes
curl http://localhost:3000/api/health/readiness
curl http://localhost:3000/api/health/liveness
```

### Logging

```bash
# View recent logs
tail -f logs/application.log

# Filter errors
grep "ERROR" logs/application.log | jq
```

## 🐳 Docker Deployment

### Basic Usage

```bash
# Build image
docker build -t batch-refinement .

# Run service
docker run -d \
  --name batch-refinement \
  --env-file .env \
  -p 3000:3000 \
  batch-refinement
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - postgres
  
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

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check database connectivity
   npm run db:studio

   # Reset database (dev only)
   npm run db:reset
   ```

2. **API Authentication Issues**
   ```bash
   # Verify JWT token
   curl -H "Authorization: Bearer <token>" \
        http://localhost:3000/api/health
   ```

3. **Job Processing Issues**
   ```bash
   # Check job status
   curl http://localhost:3000/api/jobs/{jobId}

   # View job logs
   curl http://localhost:3000/api/jobs/{jobId}/logs
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 