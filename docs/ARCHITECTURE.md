# Podmanager Architecture & Technical Design 🏛️

This document describes the high-level architecture, design patterns, directory structure, and security considerations behind **Podmanager**.

---

## 🎯 Architectural Philosophy

1. **Native Rootless Podman**: Operates directly on user namespaces without requiring `systemd` user sockets or persistent background daemons.
2. **Minimal Resource Overhead**: Designed to run with `< 30 MB RAM` footprint and `< 100 ms` startup time.
3. **Zero Frontend Build Pipeline**: Vanilla ES6+ HTML5/CSS without Webpack, Vite, React, or Vue compilation overhead.
4. **Clean Code & Separation of Concerns**: Clean monorepo structure with decoupled routes, services, and presentation layer.

---

## 📁 Monorepo Layout

Podmanager is organized as an `npm workspaces` monorepo containing two distinct applications:

```
podmanager/
├── package.json                         # Root monorepo workspace configuration
├── package-lock.json
├── docs/
│   ├── ARCHITECTURE.md                  # This architecture guide
│   └── API.md                           # REST & SSE API documentation
├── CONTRIBUTING.md                      # Contribution & development guide
├── LICENSE                              # Open-source license
├── apps/
│   ├── web/                             # [@podmanager/web] Frontend Application
│   │   ├── package.json
│   │   └── public/                      # Static client assets (Zero build step)
│   │       ├── index.html               # Main SPA layout, views & modals
│   │       ├── podmanager.webp          # Official app icon & favicon
│   │       ├── css/
│   │       │   └── style.css            # Dark theme, mobile responsive & skeleton styles
│   │       └── js/
│   │           ├── api.js               # Frontend REST API client & SSE consumer
│   │           └── app.js               # Reactive UI controller, routing & DOM handlers
│   │
│   ├── landing/                         # [@podmanager/landing] Product Landing Page
│   │   ├── package.json
│   │   └── public/                      # Static landing assets (Apple-inspired design)
│   │       ├── index.html               # Product landing page
│   │       ├── podmanager.webp          # Logo asset
│   │       └── dashboard.webp           # Hero showcase screenshot
│   │
│   └── server/                          # [@podmanager/server] Backend Engine & API
│       ├── package.json
│       ├── src/
│       │   ├── index.js                 # HTTP listener & process lifecycle management
│       │   ├── app.js                   # Express application setup, security & SPA fallback
│       │   ├── middlewares/             # Centralized middleware functions
│       │   │   ├── async-handler.middleware.js # Async route wrapper
│       │   │   └── error.middleware.js         # Centralized error handler
│       │   ├── routes/                  # Modular route controllers mounted under /api
│       │   │   ├── index.js             # Route aggregator
│       │   │   ├── system.routes.js     # System info, disk usage df, prune
│       │   │   ├── containers.routes.js # Container CRUD, start/stop, logs, exec
│       │   │   ├── pods.routes.js       # Pod lifecycle management
│       │   │   ├── images.routes.js     # Image catalog, pull stream, inspect
│       │   │   ├── volumes.routes.js    # Persistent volume endpoints
│       │   │   ├── networks.routes.js   # Container network endpoints
│       │   │   └── events.routes.js     # Real-time daemon events stream
│       │   └── services/
│       │       └── podman.service.js    # Safe Podman CLI execution service
│       └── test/                        # Automated backend tests
│           ├── api.test.js              # REST endpoints & static delivery test
│           └── lifecycle.test.js        # Pod & volume lifecycle integration tests
└── README.md
```

---

## 🔒 Security Model

### Safe CLI Execution (No Shell Injection)
Traditional tools often execute commands via `/bin/sh -c "podman ..."` which exposes the system to command injection when handling user-provided parameters (such as container names, environment variables, or images).

Podmanager completely eliminates this risk:
- All CLI invocations use `child_process.execFile` or `child_process.spawn`.
- Arguments are passed as an explicit array of strings (`['container', 'run', '--name', name, ...]`).
- No shell interpreter is spawned.

```javascript
// Example from podman.service.js
execFile('podman', args, { maxBuffer, timeout }, (err, stdout, stderr) => { ... });
```

### Static Asset Exposure
The Express server explicitly serves **only** the `apps/web/public` directory. Sensitive root or server files (such as `package.json`, source code, tests, or hidden directories) are never exposed via HTTP.

---

## 📡 Real-Time Communication (Server-Sent Events)

Instead of maintaining heavy bidirectional WebSocket connections or relying on aggressive HTTP polling, Podmanager leverages lightweight **Server-Sent Events (SSE)** for unidirectional real-time data streaming:

1. **Live Container Logs** (`/api/containers/:id/logs/stream`):
   - Spawns `podman logs -f --tail <n> <id>`.
   - Streams chunks formatted as SSE data blocks to the browser.
   - Cleans up child processes upon client disconnect.
2. **Daemon Events Stream** (`/api/events/stream`):
   - Spawns `podman events --format json`.
   - Pushes live container and image lifecycle events to the UI with automatic keep-alive heartbeats.
3. **Live Image Pull** (`/api/images/pull-stream?image=<name>`):
   - Streams real-time download and layer extraction progress directly to the in-modal progress terminal.

---

## 🌐 Frontend Design Pattern

The web frontend operates as a lightweight Single Page Application (SPA):
- **DOM Routing**: Simple view switcher showing/hiding view sections (`#containers-view`, `#pods-view`, `#images-view`, `#volumes-view`, `#networks-view`, `#events-view`, `#system-view`).
- **Perceived Latency**: Shimmer skeleton placeholders display during data fetching, preventing abrupt content flashes and layout shifts.
- **Responsive Architecture**: Flexbox and CSS Grid layout with custom breakpoints for desktop, tablet, and mobile screens. Modals utilize sticky subheaders for inspect and log viewers.
