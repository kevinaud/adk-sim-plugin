FROM node:25-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source (for initial build; volume mount overrides in dev)
COPY . .

EXPOSE 4200
