FROM node:18-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY src/ ./src/

# Create directories for logs
RUN mkdir -p logs

# Set environment variables (default values - can be overridden at runtime)
ENV REFINEMENT_SERVICE_API_BASE_URL=https://a7df0ae43df690b889c1201546d7058ceb04d21b-8000.dstack-prod5.phala.network

ENV BATCH_SIZE=10
ENV REFINER_ID=7
ENV VERBOSE=false
ENV RPC_URL=https://rpc.moksha.vana.org

# Define entrypoint
ENTRYPOINT ["node", "src/index.js"]

# Default command (can be overridden)
CMD ["--help"] 