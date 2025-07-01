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
MAX_FILE_ID=1000                                     # Maximum file ID to process
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
