# 🐳 Batch Refinement Service - Docker Guide

This guide explains how to deploy the Batch Refinement Service using Docker.

## 🚀 Quick Start

### Build the Image
```bash
# Build locally
docker build -t batch-refinement .

# Or build for specific platform
docker buildx build --platform linux/amd64 -t batch-refinement .
```

### Run the Service
```bash
# Run with external PostgreSQL
docker run -d \
  --name batch-refinement \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e REFINEMENT_SERVICE_API_BASE_URL="https://your-api.com" \
  -e RPC_URL="https://rpc.moksha.vana.org" \
  batch-refinement:latest
```

## 🔧 Available Commands

The container supports multiple startup modes:

```bash
# Run as service (default)
docker run batch-refinement service

# Run API server only
docker run batch-refinement api

# Run CLI commands
docker run batch-refinement cli --help

# Run database migrations
docker run batch-refinement migrate

# Seed database
docker run batch-refinement seed
```

## 📋 Environment Variables

### Required Variables
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
REFINEMENT_SERVICE_API_BASE_URL=https://your-api.com
RPC_URL=https://rpc.moksha.vana.org
```

### Optional Variables
```bash
# Server Configuration
PORT=3000                  # Default: 3000
NODE_ENV=production       # Default: production
HOST=0.0.0.0             # Default: 0.0.0.0

# Feature Flags
AUTO_MIGRATE=true        # Default: true
ENABLE_SCHEDULER=true    # Default: true

# Processing Configuration
BATCH_SIZE=10           # Default: 10
REFINER_ID=7           # Default: 7
LOG_LEVEL=info         # Default: info

# Security
JWT_SECRET=your-secret-key
```

## 🌐 Cloud Deployment Examples

### Google Cloud Run
```bash
# Build and push
docker build -t gcr.io/PROJECT-ID/batch-refinement .
docker push gcr.io/PROJECT-ID/batch-refinement

# Deploy
gcloud run deploy batch-refinement \
  --image gcr.io/PROJECT-ID/batch-refinement \
  --platform managed \
  --set-env-vars DATABASE_URL="postgresql://..." \
  --allow-unauthenticated
```

### AWS ECS/Fargate
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-east-1.amazonaws.com

docker tag batch-refinement:latest \
  123456789012.dkr.ecr.us-east-1.amazonaws.com/batch-refinement:latest

docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/batch-refinement:latest
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: batch-refinement
spec:
  replicas: 2
  selector:
    matchLabels:
      app: batch-refinement
  template:
    metadata:
      labels:
        app: batch-refinement
    spec:
      containers:
      - name: batch-refinement
        image: batch-refinement:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: url
        - name: NODE_ENV
          value: "production"
```

## 📊 Monitoring & Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker inspect batch-refinement | grep Health

# Check service health directly
curl http://localhost:3000/health

# View logs
docker logs -f batch-refinement
```

## 🔒 Security Notes

1. Always run as non-root user (built into image)
2. Use secrets management for sensitive variables
3. Keep container up to date with security patches
4. Use private container registries
5. Implement proper network security rules

## 🛠️ Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker logs batch-refinement

# Check environment
docker exec batch-refinement env

# Verify health
docker inspect batch-refinement
```

**Database connection issues:**
```bash
# Test database connection
docker exec batch-refinement node -e "
  const { Client } = require('pg');
  const client = new Client();
  client.connect();
"
```

**Resource constraints:**
```bash
# Check resource usage
docker stats batch-refinement

# Increase limits if needed
docker run -d \
  --memory=1g \
  --cpus=1 \
  batch-refinement
```

## 📦 Volume Management

For persistent data, mount volumes:

```bash
docker run -d \
  -v batch-logs:/app/logs \
  -v batch-data:/app/data \
  batch-refinement
```

## 🔄 Updates and Maintenance

```bash
# Pull latest image
docker pull batch-refinement:latest

# Graceful update
docker stop batch-refinement
docker rm batch-refinement
docker run -d --name batch-refinement [options] batch-refinement:latest
```

## 🤝 Support

For issues or questions:
1. Check this documentation
2. Review container logs
3. Check environment configuration
4. Verify database connectivity
5. Create an issue in the repository 