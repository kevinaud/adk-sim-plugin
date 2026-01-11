---
title: Frontend Configuration Research
type: research
parent: ../frontend-tdd.md
related:
  - ../frontend-spec.md
  - ./project-infrastructure.md
---

# Frontend Configuration Research

**Date**: January 11, 2026  
**Purpose**: Define a configuration strategy that makes the frontend agnostic to server URLs and ports, enabling seamless development and production deployment.

## Table of Contents

- [Executive Summary](#executive-summary)
  - [Key Benefits](#key-benefits)
- [Part 1: Current State Analysis](#part-1-current-state-analysis)
  - [Backend Configuration](#backend-configuration)
  - [Frontend Configuration (Before)](#frontend-configuration-before)
- [Part 2: Recommended Solution](#part-2-recommended-solution)
  - [Root-Relative Paths + Angular Proxy](#root-relative-paths-angular-proxy)
  - [Implementation](#implementation)
    - [1. Proxy Configuration](#1-proxy-configuration)
    - [2. Angular Configuration](#2-angular-configuration)
    - [3. Unified Environment Files](#3-unified-environment-files)
    - [4. Connect-ES Client Configuration](#4-connect-es-client-configuration)
- [Part 3: Port Configuration Options](#part-3-port-configuration-options)
  - [Customizing Development Ports](#customizing-development-ports)
    - [Option A: CLI Arguments](#option-a-cli-arguments)
    - [Option B: Environment-Based Proxy (Advanced)](#option-b-environment-based-proxy-advanced)
    - [Option C: Local Override File](#option-c-local-override-file)
- [Part 4: Docker Compose Configuration](#part-4-docker-compose-configuration)
  - [Current docker-compose.yaml](#current-docker-composeyaml)
  - [Production-Like Docker Compose](#production-like-docker-compose)
  - [With Nginx Reverse Proxy](#with-nginx-reverse-proxy)
- [Part 5: CI/CD Considerations](#part-5-cicd-considerations)
  - [Build-Time vs Runtime Configuration](#build-time-vs-runtime-configuration)
  - [Verifying Configuration in CI](#verifying-configuration-in-ci)
- [Part 6: Troubleshooting](#part-6-troubleshooting)
  - [Common Issues](#common-issues)
  - [Debugging Proxy](#debugging-proxy)
- [Implementation Checklist](#implementation-checklist)
  - [Required Changes](#required-changes)
  - [Optional Enhancements](#optional-enhancements)
- [References](#references)

## Executive Summary

**Recommendation**: Use root-relative paths for all API requests, eliminating environment-specific URL configuration.

| Environment | API Request Path | Routing |
|-------------|------------------|---------|
| Development (`ng serve`) | `/adksim.v1.SimulatorService/*` | Angular proxy → `localhost:8080` |
| Production | `/adksim.v1.SimulatorService/*` | Same-origin (Python serves both) |
| Docker Compose | `/adksim.v1.SimulatorService/*` | Nginx/Envoy proxy or same container |

### Key Benefits

1. **Single configuration** - No environment-specific URLs
2. **No CORS issues** - All requests are same-origin
3. **Port agnostic** - Frontend doesn't know backend port
4. **Simplified deployment** - Works behind any reverse proxy

---

## Part 1: Current State Analysis

### Backend Configuration

The Python server ([cli.py](../../../server/src/adk_sim_server/cli.py)) already supports flexible port configuration:

```bash
# CLI options
adk-sim --port 50051 --web-port 8080

# Environment variable
ADK_AGENT_SIM_DATABASE_URL=sqlite+aiosqlite:///path/to/db.sqlite
```

| Port | Default | CLI Flag | Purpose |
|------|---------|----------|---------|
| gRPC | 50051 | `--port`, `-p` | Plugin communication (grpclib) |
| Web/HTTP | 8080 | `--web-port`, `-w` | HTTP + gRPC-Web for browser |

### Frontend Configuration (Before)

Current environment files have hardcoded URLs:

```typescript
// environment.ts (development)
export const ENVIRONMENT = {
  production: false,
  grpcWebUrl: 'http://localhost:8080',  // ❌ Hardcoded port
};

// environment.prod.ts (production)
export const ENVIRONMENT = {
  production: true,
  grpcWebUrl: '',  // ✅ Already correct for production
};
```

**Problem**: Development requires knowing the backend port, creating coupling.

---

## Part 2: Recommended Solution

### Root-Relative Paths + Angular Proxy

The solution uses Angular CLI's built-in proxy for development:

```
┌─────────────────────────────────────────────────────────────┐
│                     Development                              │
│                                                             │
│  Browser → http://localhost:4200/adksim.v1.SimulatorService │
│                          │                                  │
│                          ▼                                  │
│              Angular Dev Server (ng serve)                  │
│                          │                                  │
│              proxy.conf.json routes to ───────────────────► │
│                          │                                  │
│                          ▼                                  │
│              http://localhost:8080/adksim.v1.SimulatorService│
│                   (Python Backend)                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Production                               │
│                                                             │
│  Browser → https://app.example.com/adksim.v1.SimulatorService│
│                          │                                  │
│                          ▼                                  │
│              Python Server (serves both)                    │
│              - Static files (/, /index.html, /assets/*)     │
│              - gRPC-Web (/adksim.v1.SimulatorService/*)     │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

#### 1. Proxy Configuration

Create `frontend/proxy.conf.json`:

```json
{
  "/adksim.v1.SimulatorService": {
    "target": "http://localhost:8080",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

#### 2. Angular Configuration

Update `frontend/angular.json`:

```json
{
  "projects": {
    "frontend": {
      "architect": {
        "serve": {
          "options": {
            "proxyConfig": "proxy.conf.json",
            "port": 4200
          }
        }
      }
    }
  }
}
```

#### 3. Unified Environment Files

```typescript
// environment.ts (development)
export const ENVIRONMENT = {
  production: false,
  grpcWebUrl: '',  // Empty = same-origin (proxy handles routing)
};

// environment.prod.ts (production)
export const ENVIRONMENT = {
  production: true,
  grpcWebUrl: '',  // Empty = same-origin (server serves both)
};
```

#### 4. Connect-ES Client Configuration

The gRPC-Web client uses the base URL from environment:

```typescript
// data-access/session/grpc-session.gateway.ts
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { ENVIRONMENT } from '@environments/environment';

const transport = createGrpcWebTransport({
  baseUrl: ENVIRONMENT.grpcWebUrl || window.location.origin,
});
```

With `grpcWebUrl: ''`, requests go to:
- Dev: `http://localhost:4200/adksim.v1.SimulatorService/Subscribe` → proxied to `:8080`
- Prod: `https://app.example.com/adksim.v1.SimulatorService/Subscribe` → same server

---

## Part 3: Port Configuration Options

### Customizing Development Ports

Developers can customize ports without modifying committed files:

#### Option A: CLI Arguments

```bash
# Custom frontend port
ng serve --port 3000

# Custom backend port (requires proxy update)
adk-sim --web-port 9000
```

#### Option B: Environment-Based Proxy (Advanced)

For teams needing different backend ports, use a dynamic proxy:

```javascript
// proxy.conf.js (JavaScript, not JSON)
const BACKEND_PORT = process.env.BACKEND_PORT || 8080;

module.exports = {
  '/adksim.v1.SimulatorService': {
    target: `http://localhost:${BACKEND_PORT}`,
    secure: false,
    changeOrigin: true,
  },
};
```

Then run:
```bash
BACKEND_PORT=9000 ng serve --proxy-config proxy.conf.js
```

#### Option C: Local Override File

Add `proxy.conf.local.json` to `.gitignore` and document the override pattern:

```json
// proxy.conf.local.json (not committed)
{
  "/adksim.v1.SimulatorService": {
    "target": "http://localhost:9000",
    "secure": false,
    "changeOrigin": true
  }
}
```

```bash
ng serve --proxy-config proxy.conf.local.json
```

---

## Part 4: Docker Compose Configuration

### Current docker-compose.yaml

```yaml
services:
  backend:
    ports:
      - "50051:50051"  # gRPC (plugins)
      - "8080:8080"    # HTTP/gRPC-Web
    
  frontend:
    ports:
      - "4200:4200"
    # Note: In dev mode, frontend talks to backend via host network
```

### Production-Like Docker Compose

For testing production configuration locally:

```yaml
# docker-compose.prod.yaml
services:
  backend:
    build:
      context: .
      dockerfile: docker/backend.Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SERVE_STATIC_FILES=true
      - STATIC_FILES_PATH=/app/frontend/dist
    volumes:
      - ./frontend/dist:/app/frontend/dist:ro

  # No separate frontend service - backend serves everything
```

### With Nginx Reverse Proxy

```yaml
# docker-compose.nginx.yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend

  backend:
    # Internal only, no exposed ports
    expose:
      - "8080"
```

```nginx
# nginx.conf
server {
    listen 80;
    
    # Serve Angular app
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy gRPC-Web to backend
    location /adksim.v1.SimulatorService {
        proxy_pass http://backend:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Part 5: CI/CD Considerations

### Build-Time vs Runtime Configuration

| Approach | Pros | Cons |
|----------|------|------|
| **Build-time** (environment.ts) | Simple, type-safe | Requires rebuild per environment |
| **Runtime** (fetch config) | Single build artifact | Extra HTTP request, complexity |

**Recommendation**: With root-relative paths, build-time configuration is sufficient. The `grpcWebUrl: ''` works everywhere.

### Verifying Configuration in CI

Add a test to verify environment configuration:

```typescript
// environment.spec.ts
import { ENVIRONMENT } from './environment';
import { ENVIRONMENT as PROD_ENV } from './environment.prod';

describe('Environment Configuration', () => {
  it('should use root-relative paths in all environments', () => {
    expect(ENVIRONMENT.grpcWebUrl).toBe('');
    expect(PROD_ENV.grpcWebUrl).toBe('');
  });
});
```

---

## Part 6: Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 404 on API requests | Proxy not configured | Add `proxy.conf.json` to `ng serve` |
| CORS errors | Proxy bypassed | Ensure `grpcWebUrl` is empty |
| Connection refused | Backend not running | Start `adk-sim` before `ng serve` |
| Wrong port | Custom port not propagated | Update `proxy.conf.json` target |

### Debugging Proxy

Enable verbose logging:

```json
{
  "/adksim.v1.SimulatorService": {
    "target": "http://localhost:8080",
    "logLevel": "debug"
  }
}
```

Check Angular CLI output:
```
[HPM] Proxy created: /adksim.v1.SimulatorService -> http://localhost:8080
[HPM] POST /adksim.v1.SimulatorService/Subscribe -> http://localhost:8080
```

---

## Implementation Checklist

### Required Changes

- [ ] Create `frontend/proxy.conf.json`
- [ ] Update `frontend/angular.json` with `proxyConfig` option
- [ ] Update `frontend/src/environments/environment.ts` to use `grpcWebUrl: ''`
- [ ] Update Connect-ES transport to handle empty base URL
- [ ] Add environment configuration test

### Optional Enhancements

- [ ] Create `proxy.conf.js` for environment variable support
- [ ] Add `.gitignore` entry for `proxy.conf.local.json`
- [ ] Document port customization in README
- [ ] Create production Docker Compose with Nginx

---

## References

- [Angular CLI Proxy Documentation](https://angular.dev/tools/cli/serve#proxying-to-a-backend-server)
- [Connect-ES Transport Configuration](https://connectrpc.com/docs/web/using-clients)
- [Current CLI Implementation](../../../server/src/adk_sim_server/cli.py)
- [Project Infrastructure Research](./project-infrastructure.md)
