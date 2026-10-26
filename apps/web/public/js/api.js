/**
 * Podman Web UI API Client
 */
const API = {
  async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Accept': 'application/json',
      ...(options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {})
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(endpoint, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.error || data?.stderr || `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.data = data;
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  // System
  getSystemInfo() {
    return this.request('/api/system/info');
  },
  getSystemDf() {
    return this.request('/api/system/df');
  },
  pruneSystem(type = 'all') {
    return this.request('/api/system/prune', { method: 'POST', body: { type } });
  },

  // Containers
  getContainers(all = true) {
    return this.request(`/api/containers?all=${all}`);
  },
  inspectContainer(id) {
    return this.request(`/api/containers/${id}`);
  },
  createContainer(payload) {
    return this.request('/api/containers', { method: 'POST', body: payload });
  },
  startContainer(id) {
    return this.request(`/api/containers/${id}/start`, { method: 'POST' });
  },
  stopContainer(id, timeout = 10) {
    return this.request(`/api/containers/${id}/stop`, { method: 'POST', body: { timeout } });
  },
  restartContainer(id, timeout = 10) {
    return this.request(`/api/containers/${id}/restart`, { method: 'POST', body: { timeout } });
  },
  killContainer(id, signal = 'SIGKILL') {
    return this.request(`/api/containers/${id}/kill`, { method: 'POST', body: { signal } });
  },
  pauseContainer(id) {
    return this.request(`/api/containers/${id}/pause`, { method: 'POST' });
  },
  unpauseContainer(id) {
    return this.request(`/api/containers/${id}/unpause`, { method: 'POST' });
  },
  removeContainer(id, force = false, volumes = false) {
    return this.request(`/api/containers/${id}?force=${force}&volumes=${volumes}`, { method: 'DELETE' });
  },
  getContainerLogs(id, tail = 100, timestamps = false) {
    return this.request(`/api/containers/${id}/logs?tail=${tail}&timestamps=${timestamps}`);
  },
  execContainer(id, command, workdir) {
    return this.request(`/api/containers/${id}/exec`, { method: 'POST', body: { command, workdir } });
  },

  // Pods
  getPods() {
    return this.request('/api/pods');
  },
  inspectPod(id) {
    return this.request(`/api/pods/${id}`);
  },
  createPod(payload) {
    return this.request('/api/pods', { method: 'POST', body: payload });
  },
  startPod(id) {
    return this.request(`/api/pods/${id}/start`, { method: 'POST' });
  },
  stopPod(id) {
    return this.request(`/api/pods/${id}/stop`, { method: 'POST' });
  },
  restartPod(id) {
    return this.request(`/api/pods/${id}/restart`, { method: 'POST' });
  },
  removePod(id, force = false) {
    return this.request(`/api/pods/${id}?force=${force}`, { method: 'DELETE' });
  },

  // Images
  getImages() {
    return this.request('/api/images');
  },
  inspectImage(id) {
    return this.request(`/api/images/${id}`);
  },
  pullImage(image) {
    return this.request('/api/images/pull', { method: 'POST', body: { image } });
  },
  removeImage(id, force = false) {
    return this.request(`/api/images/${id}?force=${force}`, { method: 'DELETE' });
  },

  // Volumes
  getVolumes() {
    return this.request('/api/volumes');
  },
  inspectVolume(name) {
    return this.request(`/api/volumes/${encodeURIComponent(name)}`);
  },
  createVolume(name, driver) {
    return this.request('/api/volumes', { method: 'POST', body: { name, driver } });
  },
  removeVolume(name, force = false) {
    return this.request(`/api/volumes/${encodeURIComponent(name)}?force=${force}`, { method: 'DELETE' });
  },

  // Networks
  getNetworks() {
    return this.request('/api/networks');
  },
  inspectNetwork(name) {
    return this.request(`/api/networks/${encodeURIComponent(name)}`);
  },
  createNetwork(payload) {
    return this.request('/api/networks', { method: 'POST', body: payload });
  },
  removeNetwork(name) {
    return this.request(`/api/networks/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },

  // Events
  getEvents(since = '24h') {
    return this.request(`/api/events?since=${encodeURIComponent(since)}`);
  }
};
