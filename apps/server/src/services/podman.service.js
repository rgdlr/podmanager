const { execFile, spawn } = require('child_process');

/**
 * Execute podman command safely using execFile
 */
function runPodman(args, options = {}) {
  return new Promise((resolve, reject) => {
    const maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB default
    const timeout = options.timeout || 60000; // 60s default timeout
    execFile('podman', args, { maxBuffer, timeout, ...options }, (err, stdout, stderr) => {
      if (err) {
        const error = new Error(stderr.trim() || err.message);
        error.code = err.code;
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Execute podman command and parse JSON output
 */
async function runPodmanJson(args) {
  const { stdout } = await runPodman(args);
  if (!stdout) return [];
  try {
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error(`Failed to parse Podman JSON output: ${err.message}. Raw output: ${stdout.slice(0, 200)}`);
  }
}

const Podman = {
  // System
  async getSystemInfo() {
    const raw = await runPodmanJson(['system', 'info', '--format', 'json']);
    return {
      version: raw.version || {},
      host: {
        os: raw.host?.os || 'Unknown',
        arch: raw.host?.arch || 'Unknown',
        distribution: raw.host?.distribution || {},
        kernel: raw.host?.kernel || 'Unknown',
        cpus: raw.host?.cpus || 0,
        memTotal: raw.host?.memTotal || 0,
        memFree: raw.host?.memFree || 0,
        hostname: raw.host?.hostname || '',
        rootless: raw.host?.security?.rootless ?? true,
        cgroupVersion: raw.host?.cgroupVersion || ''
      },
      store: {
        graphDriverName: raw.store?.graphDriverName || '',
        graphRoot: raw.store?.graphRoot || '',
        imageStore: raw.store?.imageStore?.number || 0,
        containerStore: raw.store?.containerStore?.number || 0
      },
      raw
    };
  },

  async getSystemDf() {
    try {
      const data = await runPodmanJson(['system', 'df', '--format', 'json']);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  async prune(type = 'all') {
    let args = [];
    if (type === 'containers') {
      args = ['container', 'prune', '-f'];
    } else if (type === 'images') {
      args = ['image', 'prune', '-f'];
    } else if (type === 'volumes') {
      args = ['volume', 'prune', '-f'];
    } else if (type === 'pods') {
      args = ['pod', 'prune', '-f'];
    } else {
      args = ['system', 'prune', '-f', '--volumes'];
    }
    const { stdout, stderr } = await runPodman(args);
    return { stdout, stderr };
  },

  // Containers
  async listContainers(all = true) {
    const args = ['ps', '--format', 'json'];
    if (all) args.push('-a');
    const containers = await runPodmanJson(args);
    return Array.isArray(containers) ? containers : [];
  },

  async inspectContainer(id) {
    const result = await runPodmanJson(['inspect', id]);
    return Array.isArray(result) && result.length > 0 ? result[0] : result;
  },

  async startContainer(id) {
    return await runPodman(['start', id]);
  },

  async stopContainer(id, timeout = 10) {
    const args = ['stop'];
    if (typeof timeout === 'number') {
      args.push('-t', String(timeout));
    }
    args.push(id);
    return await runPodman(args);
  },

  async restartContainer(id, timeout = 10) {
    const args = ['restart'];
    if (typeof timeout === 'number') {
      args.push('-t', String(timeout));
    }
    args.push(id);
    return await runPodman(args);
  },

  async killContainer(id, signal = 'SIGKILL') {
    return await runPodman(['kill', '-s', signal, id]);
  },

  async pauseContainer(id) {
    return await runPodman(['pause', id]);
  },

  async unpauseContainer(id) {
    return await runPodman(['unpause', id]);
  },

  async removeContainer(id, force = false, volumes = false) {
    const args = ['rm'];
    if (force) args.push('-f');
    if (volumes) args.push('-v');
    args.push(id);
    return await runPodman(args);
  },

  async createRunContainer(params) {
    const {
      image,
      name,
      ports = [],
      envs = [],
      volumes = [],
      cmd = '',
      restart,
      pod,
      network,
      autoRemove = false,
      detach = true,
      privileged = false
    } = params;

    if (!image) {
      throw new Error('Image name is required');
    }

    const args = ['run'];
    if (detach) args.push('-d');
    if (autoRemove) args.push('--rm');
    if (privileged) args.push('--privileged');
    if (name && name.trim()) args.push('--name', name.trim());
    if (restart) args.push('--restart', restart);
    if (pod) args.push('--pod', pod);
    else if (network) args.push('--network', network);

    // Ports
    const portList = Array.isArray(ports) ? ports : ports.split('\n');
    for (const p of portList) {
      const trimmed = p.trim();
      if (trimmed) args.push('-p', trimmed);
    }

    // Envs
    const envList = Array.isArray(envs) ? envs : envs.split('\n');
    for (const e of envList) {
      const trimmed = e.trim();
      if (trimmed) args.push('-e', trimmed);
    }

    // Volumes
    const volList = Array.isArray(volumes) ? volumes : volumes.split('\n');
    for (const v of volList) {
      const trimmed = v.trim();
      if (trimmed) args.push('-v', trimmed);
    }

    args.push(image.trim());

    if (cmd && cmd.trim()) {
      // Split command respecting basic space separation or pass as shell
      const cmdParts = cmd.trim().split(/\s+/);
      args.push(...cmdParts);
    }

    const { stdout, stderr } = await runPodman(args);
    return { containerId: stdout.trim(), stderr };
  },

  async getLogs(id, tail = 100, timestamps = false) {
    const args = ['logs'];
    if (tail && tail !== 'all') {
      args.push('--tail', String(tail));
    }
    if (timestamps) {
      args.push('-t');
    }
    args.push(id);
    const { stdout, stderr } = await runPodman(args);
    return stdout + (stderr ? (stdout ? '\n' : '') + stderr : '');
  },

  spawnLogs(id, tail = 100, timestamps = false) {
    const args = ['logs', '-f'];
    if (tail && tail !== 'all') {
      args.push('--tail', String(tail));
    }
    if (timestamps) {
      args.push('-t');
    }
    args.push(id);
    return spawn('podman', args);
  },

  async execCommand(id, command, workdir) {
    if (!command) throw new Error('Command is required');
    const args = ['exec'];
    if (workdir) args.push('-w', workdir);
    args.push(id, 'sh', '-c', command);
    return await runPodman(args, { timeout: 30000 });
  },

  // Pods
  async listPods() {
    const pods = await runPodmanJson(['pod', 'ps', '--format', 'json']);
    return Array.isArray(pods) ? pods : [];
  },

  async inspectPod(id) {
    const result = await runPodmanJson(['pod', 'inspect', id]);
    return Array.isArray(result) && result.length > 0 ? result[0] : result;
  },

  async startPod(id) {
    return await runPodman(['pod', 'start', id]);
  },

  async stopPod(id) {
    return await runPodman(['pod', 'stop', id]);
  },

  async restartPod(id) {
    return await runPodman(['pod', 'restart', id]);
  },

  async removePod(id, force = false) {
    const args = ['pod', 'rm'];
    if (force) args.push('-f');
    args.push(id);
    return await runPodman(args);
  },

  async createPod(params) {
    const { name, ports = [] } = params;
    const args = ['pod', 'create'];
    if (name && name.trim()) {
      args.push('--name', name.trim());
    }
    const portList = Array.isArray(ports) ? ports : ports.split('\n');
    for (const p of portList) {
      const trimmed = p.trim();
      if (trimmed) args.push('-p', trimmed);
    }
    const { stdout, stderr } = await runPodman(args);
    return { podId: stdout.trim(), stderr };
  },

  // Images
  async listImages() {
    const images = await runPodmanJson(['images', '--format', 'json']);
    return Array.isArray(images) ? images : [];
  },

  async inspectImage(id) {
    const result = await runPodmanJson(['image', 'inspect', id]);
    return Array.isArray(result) && result.length > 0 ? result[0] : result;
  },

  async pullImage(imageName, onProgress = null) {
    if (!imageName) throw new Error('Image name is required');
    if (!onProgress) {
      return await runPodman(['pull', imageName], { timeout: 300000 });
    }
    return new Promise((resolve, reject) => {
      const proc = spawn('podman', ['pull', imageName]);
      let fullOutput = '';
      proc.stdout.on('data', chunk => {
        const text = chunk.toString();
        fullOutput += text;
        onProgress(text);
      });
      proc.stderr.on('data', chunk => {
        const text = chunk.toString();
        fullOutput += text;
        onProgress(text);
      });
      proc.on('close', code => {
        if (code === 0) resolve({ stdout: fullOutput });
        else reject(new Error(`podman pull exited with code ${code}:\n${fullOutput}`));
      });
      proc.on('error', err => reject(err));
    });
  },

  async removeImage(id, force = false) {
    const args = ['rmi'];
    if (force) args.push('-f');
    args.push(id);
    return await runPodman(args);
  },

  // Volumes
  async listVolumes() {
    const volumes = await runPodmanJson(['volume', 'ls', '--format', 'json']);
    return Array.isArray(volumes) ? volumes : [];
  },

  async inspectVolume(name) {
    const result = await runPodmanJson(['volume', 'inspect', name]);
    return Array.isArray(result) && result.length > 0 ? result[0] : result;
  },

  async createVolume(name, driver) {
    const args = ['volume', 'create'];
    if (driver) args.push('--driver', driver);
    if (name) args.push(name);
    return await runPodman(args);
  },

  async removeVolume(name, force = false) {
    const args = ['volume', 'rm'];
    if (force) args.push('-f');
    args.push(name);
    return await runPodman(args);
  },

  // Networks
  async listNetworks() {
    const networks = await runPodmanJson(['network', 'ls', '--format', 'json']);
    return Array.isArray(networks) ? networks : [];
  },

  async inspectNetwork(name) {
    const result = await runPodmanJson(['network', 'inspect', name]);
    return Array.isArray(result) && result.length > 0 ? result[0] : result;
  },

  async createNetwork(params) {
    const { name, subnet, gateway, driver } = params;
    const args = ['network', 'create'];
    if (driver) args.push('--driver', driver);
    if (subnet) args.push('--subnet', subnet);
    if (gateway) args.push('--gateway', gateway);
    if (name) args.push(name);
    return await runPodman(args);
  },

  async removeNetwork(name) {
    return await runPodman(['network', 'rm', name]);
  },

  // Events
  async getEvents(since = '24h') {
    try {
      const args = ['events', '--stream=false', '--format', 'json'];
      if (since) args.push('--since', since);
      const { stdout } = await runPodman(args);
      if (!stdout) return [];
      const lines = stdout.split('\n').filter(Boolean);
      const events = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {}
      }
      return events.reverse();
    } catch {
      return [];
    }
  },

  spawnEvents() {
    return spawn('podman', ['events', '--format', 'json']);
  }
};

module.exports = Podman;
