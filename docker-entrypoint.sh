#!/bin/sh

set -e
auto_migrate() {
    if [ "$AUTO_MIGRATE" = "true" ] && [ -n "$DATABASE_URL" ]; then
        echo "Running database migrations..."
        npx prisma migrate deploy
    fi
}

generate_client() {
    if [ ! -d "node_modules/.prisma" ]; then
        echo "Generating Prisma client..."
        npx prisma generate
    fi
}

case "$1" in
    "start")
        generate_client
        auto_migrate
        echo "Starting batch refinement service..."
        exec npm start
        ;;
    "service")
        generate_client
        auto_migrate
        echo "Starting batch refinement service..."
        exec node dist/index-service.js
        ;;
    "api")
        generate_client
        auto_migrate
        echo "Starting API server..."
        exec node dist/index-api.js
        ;;
    "cli")
        generate_client
        echo "Starting CLI mode..."
        exec node dist/index.js "${@:2}"
        ;;
    "migrate")
        echo "Running migrations only..."
        npx prisma migrate deploy
        ;;
    "seed")
        generate_client
        echo "Seeding database..."
        npx prisma db seed
        ;;
    *)
        echo "Usage: $0 {start|service|api|cli|migrate|seed}"
        echo "Available commands:"
        echo "  start    - Start service with path aliases (recommended)"
        echo "  service  - Start service with cron jobs"
        echo "  api      - Start API server only"
        echo "  cli      - Run CLI commands"
        echo "  migrate  - Run database migrations only"
        echo "  seed     - Seed database with sample data"
        exit 1
        ;;
esac 