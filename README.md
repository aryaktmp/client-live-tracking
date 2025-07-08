# Live Tracking System

A real-time tracking system built with a modern web stack, featuring a React-based frontend and a NestJS backend with WebSocket support for live updates.

## Table of Contents

- [Live Tracking System](#live-tracking-system)
  - [Table of Contents](#table-of-contents)
  - [Project Overview](#project-overview)
  - [Monorepo Structure](#monorepo-structure)
  - [Key Folders and Files](#key-folders-and-files)
    - [Root](#root)
    - [`apps/api/` (Backend)](#appsapi-backend)
    - [`apps/ui/` (Frontend)](#appsui-frontend)
    - [`packages/shared/` (Shared Code)](#packagesshared-shared-code)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [Development](#development)
    - [Start Backend (API)](#start-backend-api)
    - [Start Frontend (UI)](#start-frontend-ui)
    - [Shared Package](#shared-package)
  - [Configuration](#configuration)
    - [Backend](#backend-1)
    - [Frontend](#frontend-1)
  - [WebSocket API](#websocket-api)
  - [License](#license)

---

## Project Overview

This project enables real-time location tracking of multiple entities (such as vehicles or assets) with a live map interface. It consists of:

- **Frontend:** A React app (with Vite) for the user interface and map visualization.
- **Backend:** A NestJS server providing REST and WebSocket APIs for real-time updates.
- **Shared Package:** TypeScript types and utilities shared between frontend and backend.

---

## Monorepo Structure

```
live-tracker/
├── apps/
│   ├── api/         # NestJS backend server
│   └── ui/          # React frontend application
├── packages/
│   └── shared/      # Shared code (types, utilities)
├── package.json     # Monorepo root config and scripts
├── pnpm-workspace.yaml
└── README.md        # (You are here)
```

---

## Key Folders and Files

### Root

- **package.json**: Monorepo-level scripts (e.g., start both apps, build, test).
- **pnpm-workspace.yaml**: Declares workspace packages for pnpm.
- **README.md**: Project documentation.

### `apps/api/` (Backend)

- **package.json**: Backend dependencies and scripts.
- **src/**
  - **main.ts**: Entry point for the NestJS server.
  - **app.module.ts**: Root module, imports tracking and config modules.
  - **app.controller.ts / app.service.ts**: Example controller/service.
  - **tracking/**
    - **tracking.controller.ts**: HTTP endpoints for tracking.
    - **tracking.gateway.ts**: WebSocket gateway for real-time updates.
    - **tracking.module.ts**: NestJS module for tracking features.
    - **tracking.service.ts**: Business logic for tracking.
- **test/**: End-to-end tests and Jest config.
- **README.md**: (Default NestJS readme, can be customized.)

### `apps/ui/` (Frontend)

- **package.json**: Frontend dependencies and scripts.
- **src/**
  - **main.tsx**: Entry point for the React app.
  - **App.tsx**: Main application component, handles WebSocket connection and UI.
  - **assets/**: Static assets (e.g., images).
  - **App.css / index.css**: Styling for the app.
- **public/**: Static files served by Vite.
- **vite.config.ts**: Vite configuration.
- **README.md**: (Default Vite/React readme, can be customized.)

### `packages/shared/` (Shared Code)

- **package.json**: Shared package config.
- **src/**
  - **types.ts**: TypeScript types/interfaces shared across apps (e.g., WebSocket payloads).
  - **utils.ts**: Shared utility functions (e.g., formatting timestamps, color generation).
  - **index.ts**: Barrel file exporting types and utilities.
- **tsup.config.ts**: Build config for the shared package.

---

## Getting Started

### Prerequisites

- Node.js (v22.17.0 or later)
- pnpm (recommended) or npm
- Git

### Installation

```bash
git clone <repository-url>
cd live-tracker
pnpm install
```

---

## Development

### Shared Package

- Used automatically by both apps via workspace linking.
- Build shared package:

```bash
pnpm --filter shared build
```

### Start Backend (API)

```bash
pnpm run start:api
```

- Runs on `http://localhost:3000` by default.

### Start Frontend (UI)

```bash
pnpm run start:ui
```

- Runs on `http://localhost:5173` by default.

---

## Configuration

### Backend

- Environment variables can be set in `apps/api/.env`.
- Key variables:
  - `ORS_API_KEY`: OpenRouteService API key

### Frontend

- Backend URL can be configured in `apps/ui/src/App.tsx` (see `BACKEND_URL`).

---

## WebSocket API

- **locationUpdate**: Sent when a tracker's location is updated.
- **initialState**: Sent when a client first connects.

Example payloads and types are defined in `packages/shared/src/types.ts`.

---

## License

This project is licensed under the MIT License.
