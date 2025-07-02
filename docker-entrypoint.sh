#!/bin/sh
# docker-entrypoint.sh - Flexible startup script

set -e

# Function to wait for database
wait_for_db() {
    if [ -n "$DATABASE_URL" ]; then
        echo "Waiting for database..."
        until node -e "
            const { Client } = require('pg');
            const client = new Client({ connectionString: process.env.DATABASE_URL });
            client.connect()
                .then(() => { console.log('Database ready'); process.exit(0); })
                .catch(() => process.exit(1));
        " 2>/dev/null; do
            echo "Database not ready, waiting..."
            sleep 2
        done
    fi
}

# Auto-migrate database if enabled
auto_migrate() {
    if [ "$AUTO_MIGRATE" = "true" ] && [ -n "$DATABASE_URL" ]; then
        echo "Running database migrations..."
        npx prisma migrate deploy
    fi
}

# Generate Prisma client if needed
generate_client() {
    if [ ! -d "node_modules/.prisma" ]; then
        echo "Generating Prisma client..."
        npx prisma generate
    fi
}

# Main startup logic
case "$1" in
    "service")
        wait_for_db
        generate_client
        auto_migrate
        echo "Starting batch refinement service..."
        exec node dist/index-service.js
        ;;
    "api")
        wait_for_db
        generate_client
        auto_migrate
        echo "Starting API server..."
        exec node dist/index-api.js
        ;;
    "cli")
        wait_for_db
        generate_client
        echo "Starting CLI mode..."
        exec node dist/index.js "${@:2}"
        ;;
    "migrate")
        wait_for_db
        echo "Running migrations only..."
        npx prisma migrate deploy
        ;;
    "seed")
        wait_for_db
        generate_client
        echo "Seeding database..."
        npx prisma db seed
        ;;
    *)
        echo "Usage: $0 {service|api|cli|migrate|seed}"
        echo "Available commands:"
        echo "  service  - Start service with cron jobs (default)"
        echo "  api      - Start API server only"
        echo "  cli      - Run CLI commands"
        echo "  migrate  - Run database migrations only"
        echo "  seed     - Seed database with sample data"
        exit 1
        ;;
esac 