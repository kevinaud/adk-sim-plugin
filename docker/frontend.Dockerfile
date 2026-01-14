FROM node:25-slim

WORKDIR /app

# Copy root package.json for npm workspaces configuration
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages/adk-sim-protos-ts ./packages/adk-sim-protos-ts
COPY frontend/package.json ./frontend/

# Install all workspace dependencies
RUN npm ci --workspace=frontend --workspace=@adk-sim/protos

# Copy frontend source
COPY frontend ./frontend

WORKDIR /app/frontend

EXPOSE 4200
