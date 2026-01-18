FROM node:22-slim

WORKDIR /app

# Copy root package.json for npm workspaces configuration
COPY package.json package-lock.json ./

# Copy workspace packages
COPY packages/adk-sim-protos-ts ./packages/adk-sim-protos-ts
COPY packages/adk-converters-ts ./packages/adk-converters-ts
COPY frontend/package.json ./frontend/

# Install all workspace dependencies
RUN npm ci --workspace=frontend --workspace=@adk-sim/protos --workspace=@adk-sim/converters

# Build workspace packages (they export from dist/)
RUN npm run build --workspace=@adk-sim/protos && \
    npm run build --workspace=@adk-sim/converters

# Copy frontend source
COPY frontend ./frontend

WORKDIR /app/frontend

EXPOSE 4200
