# Podmanager API Reference 🔌

Podmanager provides a comprehensive REST and Server-Sent Events (SSE) API mounted under the `/api` prefix.

All JSON responses follow a consistent schema:

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional status message"
}
```

In the event of an error, a standard error payload is returned with HTTP status `400` or `500`:

```json
{
  "success": false,
  "error": "Error message description",
  "stderr": "Podman CLI stderr output if applicable"
}
```

## 📑 Endpoints Summary

- [System](#system-api)
- [Containers](#containers-api)
- [Pods](#pods-api)
- [Images](#images-api)
- [Volumes](#volumes-api)
- [Networks](#networks-api)
- [Events](#events-api)

## 🖥️ System API

### `GET /api/system/info`
Returns host environment details and Podman engine metadata.

**Response `data` fields:**
- `version`: Engine version, API version, Go version, Git commit.
- `host`: OS, architecture, kernel, CPU count, total & free memory, rootless mode (`boolean`), cgroup version.
- `store`: Graph driver name, graph root path, container & image store counts.

### `GET /api/system/df`
Returns disk storage usage parsed from `podman system df --format json`.

### `POST /api/system/prune`
Prunes unused resources.

**Request Body:**
```json
{
  "type": "all" // "all" | "containers" | "images" | "volumes" | "pods"
}
```

## 📦 Containers API

### `GET /api/containers`
Lists containers.
- Query Parameter: `all` (`boolean`, default: `true`).

### `POST /api/containers`
Creates and starts a new container.

**Request Body:**
```json
{
  "image": "alpine:latest",
  "name": "my-app",
  "ports": ["8080:80"],
  "env": ["KEY=value"],
  "volumes": ["/host/path:/container/path:ro"],
  "restart": "unless-stopped",
  "rm": false
}
```

### `GET /api/containers/:id`
Returns full OCI JSON inspection for the specified container.

### `POST /api/containers/:id/start`
Starts a stopped container.

### `POST /api/containers/:id/stop`
Stops a running container.
- Request Body (optional): `{ "timeout": 10 }`

### `POST /api/containers/:id/restart`
Restarts a container.
- Request Body (optional): `{ "timeout": 10 }`

### `POST /api/containers/:id/pause`
Pauses all processes in the specified container.

### `POST /api/containers/:id/unpause`
Resumes paused processes in the specified container.

### `POST /api/containers/:id/kill`
Sends a signal to a container.
- Request Body (optional): `{ "signal": "SIGKILL" }`

### `DELETE /api/containers/:id`
Removes a container.
- Query Parameters: `force` (`boolean`), `volumes` (`boolean`).

### `GET /api/containers/:id/logs`
Fetches static log output.
- Query Parameters: `tail` (number, default: `100`), `timestamps` (`boolean`).

### `GET /api/containers/:id/logs/stream`
**Server-Sent Events (SSE)** stream of live container logs.
- Query Parameters: `tail` (number, default: `50`), `timestamps` (`boolean`).
- Event stream emits: `data: {"log": "..."}`.

### `POST /api/containers/:id/exec`
Executes a command inside a running container.

**Request Body:**
```json
{
  "command": "ps aux",
  "workdir": "/app"
}
```

**Response:**
```json
{
  "success": true,
  "stdout": "...",
  "stderr": "..."
}
```

## ☸️ Pods API

### `GET /api/pods`
Lists all pods with status, created timestamp, and member container lists.

### `POST /api/pods`
Creates a new pod.

**Request Body:**
```json
{
  "name": "web-pod",
  "ports": ["8080:80", "8443:443"]
}
```

### `GET /api/pods/:id`
Inspects pod configuration and associated containers.

### `POST /api/pods/:id/start`
Starts a pod and all its member containers.

### `POST /api/pods/:id/stop`
Stops a pod and all its member containers.

### `POST /api/pods/:id/restart`
Restarts a pod.

### `DELETE /api/pods/:id`
Deletes a pod.
- Query Parameter: `force` (`boolean`).

## 🖼️ Images API

### `GET /api/images`
Lists local images with Repository, Tag, ID, and Virtual Size.

### `GET /api/images/:id`
Inspects image configuration.

### `POST /api/images/pull`
Pulls an image synchronously.

**Request Body:**
```json
{
  "image": "docker.io/library/nginx:alpine"
}
```

### `GET /api/images/pull-stream`
**Server-Sent Events (SSE)** stream of real-time image pull progress.
- Query Parameter: `image` (string, required).
- Event stream emits:
  - `data: {"text": "Downloading [===>    ] ..."}`
  - `event: complete`, `data: {"success": true}`
  - `event: error`, `data: {"error": "..."}`

### `DELETE /api/images/:id`
Removes an image.
- Query Parameter: `force` (`boolean`).

## 💾 Volumes API

### `GET /api/volumes`
Lists all named persistent volumes.

### `GET /api/volumes/:name`
Inspects volume metadata and host mountpoint.

### `POST /api/volumes`
Creates a new named volume.

**Request Body:**
```json
{
  "name": "app-data",
  "driver": "local"
}
```

### `DELETE /api/volumes/:name`
Removes a volume.
- Query Parameter: `force` (`boolean`).

## 🌐 Networks API

### `GET /api/networks`
Lists container networks.

### `GET /api/networks/:name`
Inspects network configuration, driver, subnets, and gateways.

### `POST /api/networks`
Creates a container network.

**Request Body:**
```json
{
  "name": "custom-net",
  "driver": "bridge",
  "subnet": "10.89.0.0/16",
  "gateway": "10.89.0.1"
}
```

### `DELETE /api/networks/:name`
Removes a container network.

## 📡 Events API

### `GET /api/events`
Returns past Podman daemon events.
- Query Parameter: `since` (string, e.g., `24h`, `1h`, `10m`).

### `GET /api/events/stream`
**Server-Sent Events (SSE)** stream emitting real-time Podman daemon events as JSON objects.
- Heartbeat comments sent every 20 seconds (`: heartbeat`).
