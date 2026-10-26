<p align="center">
  <img src="apps/web/public/podmanager.webp" width="96" height="96" alt="Podmanager Logo" style="border-radius: 18px;" />
</p>

# Podmanager

The lightweight, native, and modern web app for podman environments.

[![Podman Compatible](https://img.shields.io/badge/Podman-Compatible%20v4+-892CA0?logo=podman&logoColor=white)](#-key-features)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.0.0-339933?logo=node.js&logoColor=white)](#-quick-start)
[![Monorepo](https://img.shields.io/badge/Architecture-Monorepo%20Workspaces-02569B)](docs/ARCHITECTURE.md)
[![Footprint](https://img.shields.io/badge/Footprint-%3C30MB%20RAM-00b894)](#-why-podmanager)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![Podmanager Dashboard](docs/dashboard.webp)

## 📖 Overview

**Podmanager** is a sleek, responsive, and production-ready web interface designed specifically for [Podman](https://podman.io/). It empowers developers and system administrators to inspect, manage, and monitor containers, pods, images, volumes, and networks with speed and precision.

Unlike traditional container dashboards designed around Docker daemons, **Podmanager embraces the Podman philosophy**:
- Works natively with **rootless** containers without privileged root access.
- Operates directly via the Podman CLI without requiring complex systemd user sockets or persistent background daemons.
- Delivers a lightning-fast single-page interface with **zero frontend build overhead** and a footprint under **30 MB RAM**.

## 🚀 Quick Start

### Prerequisites
- **Node.js** v24 or higher
- **Podman** installed and accessible in `$PATH` (rootless or rootful)

### Installation & Launch

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rgdlr/podmanager.git
   cd podmanager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

4. Open your browser at:
   ```
   http://localhost:3030
   ```

### Configuration Options

| Variable | Default   | Description                                                      |
| :------- | :-------- | :--------------------------------------------------------------- |
| `PORT`   | `3030`    | HTTP listening port for the web application and API              |
| `HOST`   | `0.0.0.0` | Network interface to bind to (`127.0.0.1` for local-only access) |

Example:
```bash
PORT=8080 HOST=127.0.0.1 npm start
```

## ⚡ Why Podmanager?

| Feature                           | Podmanager                         | Portainer                       | Cockpit-Podman            |
| :-------------------------------- | :--------------------------------- | :------------------------------ | :------------------------ |
| **Native Rootless Podman**        | ✅ Native                           | ⚠️ Complex socket setup          | ✅ Native                  |
| **Native Pods Support**           | ✅ First-class                      | ❌ Docker focused                | ⚠️ Basic                   |
| **Zero Socket / Daemon Required** | ✅ Direct CLI execution             | ❌ Requires Docker/Podman socket | ❌ Requires cockpit-bridge |
| **Resource Footprint**            | ⚡ **< 30 MB RAM**                  | 🐢 ~150–250 MB                   | 🐢 System service overhead |
| **Real-Time SSE Streaming**       | ✅ Logs, Events & Pulls             | ⚠️ Polling / WebSocket           | ⚠️ Polling                 |
| **In-Browser Container Exec**     | ✅ Instant CLI runner               | ✅ Available                     | ✅ Available               |
| **Build & Setup Overhead**        | 🚀 **Zero build step (Vanilla JS)** | 📦 Heavy React bundle            | 📦 OS package dependency   |

## ✨ Key Features

- **📊 Dashboard & Resource Analytics**: Real-time Podman engine health, CPU/memory stats, storage usage breakdown (`system df`), and one-click resource pruning.
- **📦 Container Lifecycle & Web Terminal**: Start, stop, restart, pause, remove, inspect OCI configs, stream live logs via SSE, and run interactive commands with in-browser `exec`.
- **☸️ First-Class Podman Pods**: Full support for multi-container pods, shared networking, port publications, and batch lifecycle management.
- **🖼️ Image Hub & Live Pull Streaming**: Browse local images, deploy containers in one click, and pull new images with real-time download progress logs.
- **💾 Volumes & Container Networks**: Inspect and manage persistent named volumes and container bridge networks.
- **📡 Real-Time Daemon Event Stream**: Continuous Server-Sent Events (SSE) feed reflecting all daemon events live as they occur.

## 📚 Documentation

For deep technical details, development workflows, and API specifications, refer to our specialized guides:

- 🏛️ **[Architecture & Security Guide](docs/ARCHITECTURE.md)**: Monorepo design, zero-build frontend, process execution security, and SSE streaming internals.
- 🔌 **[REST & SSE API Reference](docs/API.md)**: Full endpoint definitions, payload schemas, query parameters, and SSE event formats.
- 🤝 **[Contributing Guide](CONTRIBUTING.md)**: Local development setup, workspace commands, coding conventions, and pull request workflow.

## 📄 Community & License

Contributions, feature requests, and bug reports are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
