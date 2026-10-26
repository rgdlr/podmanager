/**
 * Podman Web UI Application Controller
 */

// Application State
const state = {
  activeView: 'dashboard',
  systemInfo: null,
  dfInfo: [],
  containers: [],
  pods: [],
  images: [],
  volumes: [],
  networks: [],
  events: [],
  loading: {
    containers: true,
    pods: true,
    images: true,
    volumes: true,
    networks: true
  },
  expandedRows: new Set(),
  refreshTimer: null,
  refreshInterval: 5000,
  activeLogStream: null,
  activePullStream: null,
  containerFilter: { search: '', status: 'all' },
  podFilter: { search: '' },
  imageFilter: { search: '' },
  volumeFilter: { search: '' },
  networkFilter: { search: '' },
  eventFilter: { search: '' },
  logsConfig: {
    containerId: null,
    containerName: '',
    autoscroll: true,
    timestamps: false
  }
};

// Row details expansion for mobile & tablet (persists across auto-refresh)
function toggleRowDetails(rowId, btnElement) {
  const row = document.getElementById(rowId);
  if (!row) return;
  const willOpen = !row.classList.contains('open');
  if (willOpen) {
    state.expandedRows.add(rowId);
    row.classList.add('open');
  } else {
    state.expandedRows.delete(rowId);
    row.classList.remove('open');
  }
  const btn = btnElement || document.querySelector(`button[data-target-row="${rowId}"]`);
  if (btn) {
    btn.classList.toggle('expanded', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
  }
}

// Click anywhere on a table row item to toggle drawer expansion (except on action buttons, links, copy badges)
document.addEventListener('click', (e) => {
  // Only activate row-click expansion on tablet & mobile viewports (where drawer info exists)
  if (window.innerWidth > 1024) return;

  if (e.target.closest('.action-trigger-btn') || 
      e.target.closest('.floating-action-menu') || 
      e.target.closest('a') || 
      e.target.closest('.item-id') || 
      e.target.closest('input') ||
      e.target.closest('select')) {
    return;
  }
  const rowItem = e.target.closest('tr.table-row-item');
  if (!rowItem) return;

  const expandBtn = rowItem.querySelector('.btn-expand-row');
  if (expandBtn) {
    const rowId = expandBtn.getAttribute('data-target-row');
    if (rowId) {
      toggleRowDetails(rowId, expandBtn);
    }
  }
});

// Floating Action Dropdown Menu (Portal on document.body to prevent clipping & auto-refresh destruction)
let activeDropdownContext = null;

function openFloatingDropdown(type, id, triggerBtn, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const menu = document.getElementById('floating-action-dropdown');
  if (!menu) return;

  const rawId = decodeURIComponent(id);

  // Toggle close if clicking on the same button while already open
  if (activeDropdownContext && 
      (activeDropdownContext.id === id || activeDropdownContext.id === rawId) && 
      activeDropdownContext.type === type && 
      menu.style.display !== 'none') {
    closeFloatingDropdown();
    return;
  }

  const items = getActionMenuItems(type, id);
  if (!items) {
    console.warn('No action menu items found for:', type, id);
    return;
  }

  menu.innerHTML = items;
  menu.style.display = 'flex';
  menu.style.visibility = 'hidden';
  menu._openedAt = Date.now();

  const rect = triggerBtn.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 180;
  const menuHeight = menu.offsetHeight || 190;

  // Calculate vertical position (prefer below, flip above if overflowing bottom)
  let top = rect.bottom + 4;
  if (top + menuHeight > window.innerHeight - 8) {
    top = Math.max(8, rect.top - menuHeight - 4);
  }

  // Calculate horizontal position (align right edge to button right edge)
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8;
  }

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.visibility = 'visible';

  if (activeDropdownContext && activeDropdownContext.triggerBtn) {
    activeDropdownContext.triggerBtn.setAttribute('aria-expanded', 'false');
  }
  activeDropdownContext = { type, id, triggerBtn };
  triggerBtn.setAttribute('aria-expanded', 'true');
}

function closeFloatingDropdown() {
  const menu = document.getElementById('floating-action-dropdown');
  if (menu) {
    menu.style.display = 'none';
  }
  if (activeDropdownContext && activeDropdownContext.triggerBtn) {
    activeDropdownContext.triggerBtn.setAttribute('aria-expanded', 'false');
  }
  activeDropdownContext = null;
}

function getActionMenuItems(type, id) {
  const rawId = decodeURIComponent(id);

  if (type === 'container') {
    const c = state.containers.find(item => item.Id === id || item.Id === rawId || item.id === id || item.id === rawId || (item.Names && item.Names.includes(id)));
    if (!c) return '';
    const cId = c.Id || c.id;
    const name = c.Names?.[0] || shortId(cId);
    const isRunning = (c.State || '').toLowerCase() === 'running';
    const isPaused = (c.State || '').toLowerCase() === 'paused';
    const safeName = escapeHtml(name);

    return `
      ${isRunning ? `
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); actionContainer('${cId}', 'stop');">
          <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"></rect></svg>
          <span>Stop Container</span>
        </button>
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); actionContainer('${cId}', 'restart');">
          <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Restart Container</span>
        </button>
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); openExecModal('${cId}', '${safeName}');">
          <svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span>Exec Shell</span>
        </button>
      ` : isPaused ? `
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); actionContainer('${cId}', 'unpause');">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Resume Container</span>
        </button>
      ` : `
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); actionContainer('${cId}', 'start');">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Start Container</span>
        </button>
      `}
      <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); viewContainerLogs('${cId}', '${safeName}');">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        <span>View Logs</span>
      </button>
      <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); inspectItem('container', '${cId}');">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Inspect JSON</span>
      </button>
      <div class="dropdown-divider"></div>
      <button type="button" class="dropdown-item danger" onclick="closeFloatingDropdown(); confirmDeleteContainer('${cId}', '${safeName}');">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>Delete Container</span>
      </button>
    `;
  }

  if (type === 'pod') {
    const p = state.pods.find(item => item.Id === id || item.Id === rawId || item.id === id || item.Name === id || item.Name === rawId);
    if (!p) return '';
    const pId = p.Id || p.id;
    const isRunning = (p.Status || '').toLowerCase() === 'running';
    const safeName = escapeHtml(p.Name || shortId(pId));

    return `
      ${isRunning ? `
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); actionPod('${pId}', 'stop');">
          <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"></rect></svg>
          <span>Stop Pod</span>
        </button>
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); actionPod('${pId}', 'restart');">
          <svg viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Restart Pod</span>
        </button>
      ` : `
        <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); actionPod('${pId}', 'start');">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <span>Start Pod</span>
        </button>
      `}
      <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); inspectItem('pod', '${pId}');">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Inspect JSON</span>
      </button>
      <div class="dropdown-divider"></div>
      <button type="button" class="dropdown-item danger" onclick="closeFloatingDropdown(); confirmDeletePod('${pId}', '${safeName}');">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>Delete Pod</span>
      </button>
    `;
  }

  if (type === 'image') {
    const img = state.images.find(item => item.Id === id || item.Id === rawId || item.id === id || item.id === rawId);
    if (!img) return '';
    const imgId = img.Id || img.id;
    const repo = img.Repositories?.[0] || img.Repository || (img.Names?.[0]?.split(':')[0]) || '<none>';
    const tag = img.Tag || (img.Names?.[0]?.split(':')[1]) || 'latest';
    const imageRef = `${repo}:${tag}`;

    return `
      <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); openCreateContainerModal('${escapeHtml(imageRef)}');">
        <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Run Container</span>
      </button>
      <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); inspectItem('image', '${imgId}');">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Inspect JSON</span>
      </button>
      <div class="dropdown-divider"></div>
      <button type="button" class="dropdown-item danger" onclick="closeFloatingDropdown(); confirmDeleteImage('${imgId}', '${escapeHtml(repo)}');">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>Delete Image</span>
      </button>
    `;
  }

  if (type === 'volume') {
    const v = state.volumes.find(item => item.Name === id || item.Name === rawId || item.name === id || item.name === rawId);
    if (!v) return '';
    const volName = v.Name || v.name;
    return `
      <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); inspectItem('volume', '${encodeURIComponent(volName)}');">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Inspect JSON</span>
      </button>
      <div class="dropdown-divider"></div>
      <button type="button" class="dropdown-item danger" onclick="closeFloatingDropdown(); deleteVolume('${encodeURIComponent(volName)}');">
        <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        <span>Delete Volume</span>
      </button>
    `;
  }

  if (type === 'network') {
    const n = state.networks.find(item => item.name === id || item.id === id || item.name === rawId || item.id === rawId || item.Name === id || item.Name === rawId);
    if (!n) return '';
    const netName = n.name || n.Name;
    return `
      <button type="button" class="dropdown-item" onclick="closeFloatingDropdown(); inspectItem('network', '${encodeURIComponent(netName)}');">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Inspect JSON</span>
      </button>
      ${netName !== 'podman' ? `
        <div class="dropdown-divider"></div>
        <button type="button" class="dropdown-item danger" onclick="closeFloatingDropdown(); deleteNetwork('${encodeURIComponent(netName)}');">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>Delete Network</span>
        </button>
      ` : ''}
    `;
  }

  return '';
}

// Global listeners to close floating dropdown
document.addEventListener('click', (e) => {
  const menu = document.getElementById('floating-action-dropdown');
  if (!menu || menu.style.display === 'none') return;
  // If clicked inside dropdown menu or on any action trigger button, do not close here
  if (e.target.closest && (e.target.closest('#floating-action-dropdown') || e.target.closest('.action-trigger-btn'))) {
    return;
  }
  closeFloatingDropdown();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeFloatingDropdown();
});

window.addEventListener('resize', closeFloatingDropdown);

// Format utilities
const formatBytes = (bytes, decimals = 2) => {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const shortId = (id) => (id ? id.substring(0, 12) : '-');

// Toast Notification
function showToast(title, message = '', type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="modal-close" style="padding:2px;" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Modal Handlers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    if (modalId === 'logs-modal' && state.activeLogStream) {
      state.activeLogStream.close();
      state.activeLogStream = null;
    }
  }
}

// Main View Navigation
function switchView(viewName, updateUrl = true) {
  const validViews = ['dashboard', 'containers', 'pods', 'images', 'volumes', 'networks', 'events'];
  if (!validViews.includes(viewName)) {
    viewName = 'dashboard';
  }
  state.activeView = viewName;
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  const navItem = document.querySelector(`.nav-link[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add('active');

  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    const titles = {
      dashboard: 'Dashboard Overview',
      containers: 'Containers Management',
      pods: 'Pods Management',
      images: 'Images Management',
      volumes: 'Volumes Management',
      networks: 'Networks Management',
      events: 'Live System Events'
    };
    pageTitle.textContent = titles[viewName] || 'Podmanager';
  }

  // Synchronize state with browser URL
  if (updateUrl && window.history && window.history.pushState) {
    const url = new URL(window.location);
    if (viewName === 'dashboard') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', viewName);
    }
    window.history.pushState({ view: viewName }, '', url.pathname + url.search + url.hash);
  }

  // If navigating to events view, render immediately from cached state
  if (viewName === 'events') {
    renderEvents();
  }

  // Refresh active view data immediately
  refreshData();
}

// Data Fetching & Sync
async function refreshData() {
  const refreshIcon = document.getElementById('refresh-icon');
  if (refreshIcon) refreshIcon.classList.add('spin');

  try {
    // Parallel fetch core lists and all sections for sidebar badges
    const [infoRes, dfRes, containersRes, podsRes, imagesRes, volumesRes, networksRes] = await Promise.all([
      API.getSystemInfo().catch(e => null),
      API.getSystemDf().catch(e => null),
      API.getContainers().catch(e => null),
      API.getPods().catch(e => null),
      API.getImages().catch(e => null),
      API.getVolumes().catch(e => null),
      API.getNetworks().catch(e => null)
    ]);

    if (infoRes?.data) state.systemInfo = infoRes.data;
    if (dfRes?.data) state.dfInfo = dfRes.data;
    if (containersRes?.data) {
      state.containers = containersRes.data;
      state.loading.containers = false;
    }
    if (podsRes?.data) {
      state.pods = podsRes.data;
      state.loading.pods = false;
    }
    if (imagesRes?.data) {
      state.images = imagesRes.data;
      state.loading.images = false;
    }
    if (volumesRes?.data) {
      state.volumes = volumesRes.data;
      state.loading.volumes = false;
    }
    if (networksRes?.data) {
      state.networks = networksRes.data;
      state.loading.networks = false;
    }

    // Update navigation counter badges for all sections
    updateBadges();

    // Render current active view
    if (state.activeView === 'dashboard') {
      renderDashboard();
    } else if (state.activeView === 'containers') {
      renderContainers();
    } else if (state.activeView === 'pods') {
      renderPods();
    } else if (state.activeView === 'images') {
      renderImages();
    } else if (state.activeView === 'volumes') {
      renderVolumes();
    } else if (state.activeView === 'networks') {
      renderNetworks();
    } else if (state.activeView === 'events') {
      renderEvents();
    }

    updateSystemStatus(true);
  } catch (err) {
    console.error('Failed to refresh data:', err);
    updateSystemStatus(false);
  } finally {
    if (refreshIcon) refreshIcon.classList.remove('spin');
  }
}

function updateBadges() {
  const dBadge = document.getElementById('badge-dashboard');
  const cBadge = document.getElementById('badge-containers');
  const pBadge = document.getElementById('badge-pods');
  const iBadge = document.getElementById('badge-images');
  const vBadge = document.getElementById('badge-volumes');
  const nBadge = document.getElementById('badge-networks');
  const eBadge = document.getElementById('badge-events');

  const runningCount = state.containers.filter(c => c.State === 'running').length;

  if (dBadge) {
    dBadge.textContent = 'Live';
  }

  if (cBadge) {
    cBadge.textContent = `${runningCount}/${state.containers.length}`;
    cBadge.className = runningCount > 0 ? 'nav-badge active-count' : 'nav-badge';
  }

  if (pBadge) {
    pBadge.textContent = state.pods.length;
  }

  if (iBadge) {
    iBadge.textContent = state.images.length;
  }

  if (vBadge) {
    vBadge.textContent = state.volumes.length;
  }

  if (nBadge) {
    nBadge.textContent = state.networks.length;
  }

  if (eBadge) {
    eBadge.textContent = state.events.length;
  }
}

function updateSystemStatus(isOnline) {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (dot && text) {
    if (isOnline) {
      dot.className = 'status-dot';
      const version = state.systemInfo?.version?.Version || '';
      text.textContent = version ? `Podman v${version} Connected` : 'Podman Connected';
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Connection Error';
    }
  }
}

// ----------------- RENDER VIEWS -----------------

// 1. Dashboard View
function renderDashboard() {
  const runningContainers = state.containers.filter(c => c.State === 'running').length;

  document.getElementById('dash-stat-running').textContent = runningContainers;
  document.getElementById('dash-stat-containers').textContent = state.containers.length;
  document.getElementById('dash-stat-pods').textContent = state.pods.length;
  document.getElementById('dash-stat-images').textContent = state.images.length;

  // Host specs
  const host = state.systemInfo?.host || {};
  const ver = state.systemInfo?.version || {};
  const store = state.systemInfo?.store || {};

  document.getElementById('spec-podman-version').textContent = ver.Version || '-';
  document.getElementById('spec-os-arch').textContent = `${host.os || ''} (${host.arch || ''})`;
  document.getElementById('spec-distro').textContent = host.distribution ? `${host.distribution.distribution} ${host.distribution.version}` : '-';
  document.getElementById('spec-kernel').textContent = host.kernel || '-';
  document.getElementById('spec-cpus').textContent = host.cpus ? `${host.cpus} Cores` : '-';
  document.getElementById('spec-mem').textContent = host.memTotal ? formatBytes(host.memTotal) : '-';
  document.getElementById('spec-driver').textContent = store.graphDriverName || '-';
  
  const rootlessBadge = document.getElementById('spec-rootless');
  if (rootlessBadge) {
    rootlessBadge.textContent = host.rootless ? 'Rootless Mode' : 'Root Mode';
    rootlessBadge.className = host.rootless ? 'tag-badge rootless' : 'tag-badge';
  }

  // Disk usage list
  const diskContainer = document.getElementById('dash-disk-list');
  if (diskContainer && state.dfInfo.length > 0) {
    diskContainer.innerHTML = state.dfInfo.map(item => `
      <div class="disk-item">
        <div class="disk-header">
          <strong>${escapeHtml(item.Type)} (${item.TotalCount ?? item.Total ?? 0})</strong>
          <span>${escapeHtml(item.Size || '0B')}</span>
        </div>
        <div class="disk-bar-bg">
          <div class="disk-bar-fill" style="width: ${item.Active > 0 ? Math.min(100, Math.round((item.Active / (item.Total || 1)) * 100)) : 10}%;"></div>
        </div>
        <div class="disk-reclaimable">Reclaimable: ${escapeHtml(item.Reclaimable || '0B')}</div>
      </div>
    `).join('');
  }
}

// Skeleton Generator for Tables
function renderTableSkeletons(type, count = 5) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    const varW = (base, mod) => base + ((i % 3) * mod);

    if (type === 'containers') {
      rows.push(`
        <tr class="table-row-item skeleton-row">
          <td><div class="skeleton skeleton-badge" style="width:65px;"></div></td>
          <td>
            <div class="skeleton-group">
              <div class="skeleton skeleton-text" style="width:${varW(120, 15)}px;"></div>
              <div class="skeleton skeleton-text skeleton-sub" style="width:${varW(75, 10)}px;"></div>
            </div>
          </td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:${varW(100, 20)}px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:${varW(80, 15)}px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:75px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:85px;"></div></td>
          <td class="col-actions-header" style="text-align:right;">
            <div class="skeleton skeleton-btn" style="margin-left:auto;"></div>
          </td>
          <td class="mobile-toggle-cell">
            <div class="skeleton skeleton-icon" style="margin:0 auto;"></div>
          </td>
        </tr>
      `);
    } else if (type === 'pods') {
      rows.push(`
        <tr class="table-row-item skeleton-row">
          <td><div class="skeleton skeleton-badge" style="width:65px;"></div></td>
          <td>
            <div class="skeleton-group">
              <div class="skeleton skeleton-text" style="width:${varW(130, 20)}px;"></div>
              <div class="skeleton skeleton-text skeleton-sub" style="width:${varW(70, 10)}px;"></div>
            </div>
          </td>
          <td class="col-hide-tablet">
            <div class="skeleton-group">
              <div class="skeleton skeleton-badge" style="width:70px;"></div>
              <div class="skeleton skeleton-text skeleton-sub" style="width:110px;"></div>
            </div>
          </td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:85px;"></div></td>
          <td class="col-actions-header" style="text-align:right;">
            <div class="skeleton skeleton-btn" style="margin-left:auto;"></div>
          </td>
          <td class="mobile-toggle-cell">
            <div class="skeleton skeleton-icon" style="margin:0 auto;"></div>
          </td>
        </tr>
      `);
    } else if (type === 'images') {
      rows.push(`
        <tr class="table-row-item skeleton-row">
          <td>
            <div class="skeleton-group">
              <div class="skeleton skeleton-text" style="width:${varW(140, 25)}px;"></div>
              <div class="skeleton skeleton-text skeleton-sub" style="width:${varW(85, 10)}px;"></div>
            </div>
          </td>
          <td><div class="skeleton skeleton-badge" style="width:45px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:55px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-badge" style="width:50px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:85px;"></div></td>
          <td class="col-actions-header" style="text-align:right;">
            <div class="skeleton skeleton-btn" style="margin-left:auto;"></div>
          </td>
          <td class="mobile-toggle-cell">
            <div class="skeleton skeleton-icon" style="margin:0 auto;"></div>
          </td>
        </tr>
      `);
    } else if (type === 'volumes') {
      rows.push(`
        <tr class="table-row-item skeleton-row">
          <td><div class="skeleton skeleton-text" style="width:${varW(130, 20)}px;"></div></td>
          <td><div class="skeleton skeleton-badge" style="width:50px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:${varW(150, 30)}px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:85px;"></div></td>
          <td class="col-actions-header" style="text-align:right;">
            <div class="skeleton skeleton-btn" style="margin-left:auto;"></div>
          </td>
          <td class="mobile-toggle-cell">
            <div class="skeleton skeleton-icon" style="margin:0 auto;"></div>
          </td>
        </tr>
      `);
    } else if (type === 'networks') {
      rows.push(`
        <tr class="table-row-item skeleton-row">
          <td><div class="skeleton skeleton-text" style="width:${varW(110, 20)}px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:80px;"></div></td>
          <td><div class="skeleton skeleton-badge" style="width:55px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:110px;"></div></td>
          <td class="col-hide-tablet"><div class="skeleton skeleton-text" style="width:95px;"></div></td>
          <td class="col-actions-header" style="text-align:right;">
            <div class="skeleton skeleton-btn" style="margin-left:auto;"></div>
          </td>
          <td class="mobile-toggle-cell">
            <div class="skeleton skeleton-icon" style="margin:0 auto;"></div>
          </td>
        </tr>
      `);
    }
  }
  return rows.join('');
}

// 2. Containers View
function renderContainers() {
  const tbody = document.getElementById('containers-tbody');
  if (!tbody) return;

  if (state.loading.containers) {
    tbody.innerHTML = renderTableSkeletons('containers');
    return;
  }

  const search = state.containerFilter.search.toLowerCase();
  const status = state.containerFilter.status;

  const filtered = state.containers.filter(c => {
    const nameMatch = (c.Names?.[0] || '').toLowerCase().includes(search) ||
                      (c.Image || '').toLowerCase().includes(search) ||
                      (c.Id || '').toLowerCase().includes(search);
    const statusMatch = status === 'all' || c.State === status;
    return nameMatch && statusMatch;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            <div class="empty-state-title">No containers found</div>
            <div class="empty-state-desc">No containers match your search or filter. Launch a container to get started.</div>
            <button class="btn btn-primary" onclick="openCreateContainerModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Run Container</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const name = c.Names?.[0] || shortId(c.Id);
    const cShort = shortId(c.Id);
    const rowId = `expand-c-${cShort}`;
    const isExpanded = state.expandedRows.has(rowId);

    return `
      <tr class="table-row-item">
        <td>
          <span class="status-pill status-${c.State}">${c.State}</span>
        </td>
        <td>
          <div class="item-name">${escapeHtml(name)}</div>
          <span class="item-id" title="Click to copy ID" onclick="navigator.clipboard.writeText('${c.Id}'); showToast('Copied ID', '${cShort}', 'info');">${cShort}</span>
        </td>
        <td class="col-hide-tablet">
          <span title="${escapeHtml(c.Image)}">${escapeHtml(c.Image)}</span>
        </td>
        <td class="col-hide-tablet">${formatPorts(c.Ports)}</td>
        <td class="col-hide-tablet">${c.PodName ? `<span class="tag-badge rootless">${escapeHtml(c.PodName)}</span>` : '-'}</td>
        <td class="col-hide-tablet" style="color:var(--text-secondary); font-size:12px;">${escapeHtml(c.Status)}</td>
        <td class="col-actions-cell" style="text-align:right;">
          <button type="button" class="btn btn-secondary btn-icon-only btn-sm action-trigger-btn" title="Actions" aria-label="Actions" aria-haspopup="true" aria-expanded="false" onclick="openFloatingDropdown('container', '${c.Id}', this, event)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="5" cy="12" r="2"></circle></svg>
          </button>
        </td>
        <td class="mobile-toggle-cell" style="text-align:center;">
          <button type="button" class="btn-expand-row ${isExpanded ? 'expanded' : ''}" data-target-row="${rowId}" aria-label="Toggle details for ${escapeHtml(name)}" aria-expanded="${isExpanded}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </td>
      </tr>
      <tr class="expandable-details-row ${isExpanded ? 'open' : ''}" id="${rowId}">
        <td colspan="8">
          <div class="details-drawer-content">
            <div class="drawer-grid">
              <div class="drawer-field">
                <span class="drawer-label">Image</span>
                <span class="drawer-value">${escapeHtml(c.Image)}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Ports</span>
                <span class="drawer-value">${formatPorts(c.Ports)}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Pod</span>
                <span class="drawer-value">${c.PodName ? escapeHtml(c.PodName) : 'Standalone'}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Status / Uptime</span>
                <span class="drawer-value">${escapeHtml(c.Status)}</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function formatPorts(ports) {
  if (!ports || ports.length === 0) return '<span style="color:var(--text-tertiary);">-</span>';
  return ports.map(p => {
    const hostPort = p.host_port || p.HostPort;
    const containerPort = p.container_port || p.ContainerPort;
    const protocol = p.protocol || 'tcp';
    if (hostPort) {
      return `<a class="ports-badge" href="http://localhost:${hostPort}" target="_blank" title="Open port in browser">${hostPort}:${containerPort}/${protocol}</a>`;
    }
    return `<span class="ports-badge">${containerPort}/${protocol}</span>`;
  }).join(' ');
}

// 3. Pods View
function renderPods() {
  const tbody = document.getElementById('pods-tbody');
  if (!tbody) return;

  if (state.loading.pods) {
    tbody.innerHTML = renderTableSkeletons('pods');
    return;
  }

  const search = state.podFilter.search.toLowerCase();
  const filtered = state.pods.filter(p => {
    return (p.Name || '').toLowerCase().includes(search) || (p.Id || '').toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
            <div class="empty-state-title">No pods found</div>
            <div class="empty-state-desc">No pods match your search. Create a pod to group multiple containers together.</div>
            <button class="btn btn-primary" onclick="openModal('create-pod-modal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Create Pod</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const isRunning = p.Status?.toLowerCase() === 'running';
    const containerCount = p.Containers ? p.Containers.length : 0;
    const pShort = shortId(p.Id);
    const rowId = `expand-p-${pShort}`;
    const isExpanded = state.expandedRows.has(rowId);
    const containersSummary = p.Containers ? p.Containers.map(c => escapeHtml(c.Names || c.Name || '')).join(', ') : '';

    return `
      <tr class="table-row-item">
        <td>
          <span class="status-pill status-${isRunning ? 'running' : 'exited'}">${p.Status}</span>
        </td>
        <td>
          <div class="item-name">${escapeHtml(p.Name)}</div>
          <span class="item-id" title="Copy ID" onclick="navigator.clipboard.writeText('${p.Id}'); showToast('Copied Pod ID', '${pShort}', 'info');">${pShort}</span>
        </td>
        <td class="col-hide-tablet">
          <span class="tag-badge rootless">${containerCount} Container${containerCount === 1 ? '' : 's'}</span>
          <div style="font-size:11px; color:var(--text-tertiary); margin-top:4px;">
            ${containersSummary}
          </div>
        </td>
        <td class="col-hide-tablet" style="color:var(--text-secondary); font-size:12px;">${escapeHtml(p.Created || '-')}</td>
        <td class="col-actions-cell" style="text-align:right;">
          <button type="button" class="btn btn-secondary btn-icon-only btn-sm action-trigger-btn" title="Actions" aria-label="Actions" aria-haspopup="true" aria-expanded="false" onclick="openFloatingDropdown('pod', '${p.Id}', this, event)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="5" cy="12" r="2"></circle></svg>
          </button>
        </td>
        <td class="mobile-toggle-cell" style="text-align:center;">
          <button type="button" class="btn-expand-row ${isExpanded ? 'expanded' : ''}" data-target-row="${rowId}" aria-label="Toggle details for ${escapeHtml(p.Name)}" aria-expanded="${isExpanded}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </td>
      </tr>
      <tr class="expandable-details-row ${isExpanded ? 'open' : ''}" id="${rowId}">
        <td colspan="6">
          <div class="details-drawer-content">
            <div class="drawer-grid">
              <div class="drawer-field">
                <span class="drawer-label">Containers (${containerCount})</span>
                <span class="drawer-value">${containersSummary || 'None'}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Created</span>
                <span class="drawer-value">${escapeHtml(p.Created || '-')}</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 4. Images View
function renderImages() {
  const tbody = document.getElementById('images-tbody');
  if (!tbody) return;

  if (state.loading.images) {
    tbody.innerHTML = renderTableSkeletons('images');
    return;
  }

  const search = state.imageFilter.search.toLowerCase();
  const filtered = state.images.filter(img => {
    const repo = (img.Repositories?.[0] || img.Repository || '').toLowerCase();
    const id = (img.Id || '').toLowerCase();
    return repo.includes(search) || id.includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            <div class="empty-state-title">No images found</div>
            <div class="empty-state-desc">No container images match your search. Pull an image from a registry to get started.</div>
            <button class="btn btn-primary" onclick="openModal('pull-image-modal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Pull Image</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(img => {
    const repo = img.Repositories?.[0] || img.Repository || '<none>';
    const tag = img.Tag || (img.Names?.[0]?.split(':')[1]) || 'latest';
    const size = img.Size ? (typeof img.Size === 'number' ? formatBytes(img.Size) : img.Size) : '-';
    const containersInUse = img.Containers || 0;
    const imgShort = shortId(img.Id);
    const rowId = `expand-img-${imgShort}`;
    const isExpanded = state.expandedRows.has(rowId);
    const createdStr = img.Created ? (typeof img.Created === 'number' ? new Date(img.Created * 1000).toLocaleDateString() : img.Created) : '-';

    return `
      <tr class="table-row-item">
        <td>
          <div class="item-name">${escapeHtml(repo)}</div>
          <span class="item-id" title="Copy ID" onclick="navigator.clipboard.writeText('${img.Id}'); showToast('Copied Image ID', '${imgShort}', 'info');">${imgShort}</span>
        </td>
        <td><span class="tag-badge rootless">${escapeHtml(tag)}</span></td>
        <td class="col-hide-tablet">${escapeHtml(size)}</td>
        <td class="col-hide-tablet">
          ${containersInUse > 0 
            ? `<span class="tag-badge" style="background-color:var(--apple-green-soft); color:var(--apple-green);">${containersInUse} In Use</span>` 
            : `<span style="color:var(--text-tertiary); font-size:12px;">Unused</span>`}
        </td>
        <td class="col-hide-tablet" style="color:var(--text-secondary); font-size:12px;">${escapeHtml(createdStr)}</td>
        <td class="col-actions-cell" style="text-align:right;">
          <button type="button" class="btn btn-secondary btn-icon-only btn-sm action-trigger-btn" title="Actions" aria-label="Actions" aria-haspopup="true" aria-expanded="false" onclick="openFloatingDropdown('image', '${img.Id}', this, event)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="5" cy="12" r="2"></circle></svg>
          </button>
        </td>
        <td class="mobile-toggle-cell" style="text-align:center;">
          <button type="button" class="btn-expand-row ${isExpanded ? 'expanded' : ''}" data-target-row="${rowId}" aria-label="Toggle details for ${escapeHtml(repo)}" aria-expanded="${isExpanded}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </td>
      </tr>
      <tr class="expandable-details-row ${isExpanded ? 'open' : ''}" id="${rowId}">
        <td colspan="7">
          <div class="details-drawer-content">
            <div class="drawer-grid">
              <div class="drawer-field">
                <span class="drawer-label">Size</span>
                <span class="drawer-value">${escapeHtml(size)}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">In Use</span>
                <span class="drawer-value">${containersInUse > 0 ? `${containersInUse} container(s)` : 'Unused'}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Created</span>
                <span class="drawer-value">${escapeHtml(createdStr)}</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 5. Volumes View
function renderVolumes() {
  const tbody = document.getElementById('volumes-tbody');
  if (!tbody) return;

  if (state.loading.volumes) {
    tbody.innerHTML = renderTableSkeletons('volumes');
    return;
  }

  const search = state.volumeFilter.search.toLowerCase();
  const filtered = state.volumes.filter(v => {
    return (v.Name || '').toLowerCase().includes(search) || (v.Driver || '').toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
            <div class="empty-state-title">No volumes found</div>
            <div class="empty-state-desc">No storage volumes match your search. Create a persistent volume for your application data.</div>
            <button class="btn btn-primary" onclick="openModal('create-volume-modal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Create Volume</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(v => {
    const volIdSafe = encodeURIComponent(v.Name).replace(/[^a-zA-Z0-9_-]/g, '_');
    const rowId = `expand-vol-${volIdSafe}`;
    const isExpanded = state.expandedRows.has(rowId);

    return `
      <tr class="table-row-item">
        <td><strong>${escapeHtml(v.Name)}</strong></td>
        <td><span class="tag-badge rootless">${escapeHtml(v.Driver || 'local')}</span></td>
        <td class="col-hide-tablet" style="font-family:monospace; font-size:11px; color:var(--text-secondary);">${escapeHtml(v.MountPoint || '-')}</td>
        <td class="col-hide-tablet" style="color:var(--text-secondary); font-size:12px;">${escapeHtml(v.CreatedAt || '-')}</td>
        <td class="col-actions-cell" style="text-align:right;">
          <button type="button" class="btn btn-secondary btn-icon-only btn-sm action-trigger-btn" title="Actions" aria-label="Actions" aria-haspopup="true" aria-expanded="false" onclick="openFloatingDropdown('volume', '${encodeURIComponent(v.Name)}', this, event)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="5" cy="12" r="2"></circle></svg>
          </button>
        </td>
        <td class="mobile-toggle-cell" style="text-align:center;">
          <button type="button" class="btn-expand-row ${isExpanded ? 'expanded' : ''}" data-target-row="${rowId}" aria-label="Toggle details for ${escapeHtml(v.Name)}" aria-expanded="${isExpanded}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </td>
      </tr>
      <tr class="expandable-details-row ${isExpanded ? 'open' : ''}" id="${rowId}">
        <td colspan="6">
          <div class="details-drawer-content">
            <div class="drawer-grid">
              <div class="drawer-field">
                <span class="drawer-label">Mountpoint</span>
                <span class="drawer-value" style="font-family:monospace; font-size:11px;">${escapeHtml(v.MountPoint || '-')}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Created</span>
                <span class="drawer-value">${escapeHtml(v.CreatedAt || '-')}</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 6. Networks View
function renderNetworks() {
  const tbody = document.getElementById('networks-tbody');
  if (!tbody) return;

  if (state.loading.networks) {
    tbody.innerHTML = renderTableSkeletons('networks');
    return;
  }

  const search = state.networkFilter.search.toLowerCase();
  const filtered = state.networks.filter(n => {
    return (n.name || '').toLowerCase().includes(search) ||
           (n.driver || '').toLowerCase().includes(search) ||
           (n.id || '').toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><path d="M12 12V8"></path></svg>
            <div class="empty-state-title">No networks found</div>
            <div class="empty-state-desc">No networks match your search. Create a custom network to isolate or connect containers.</div>
            <button class="btn btn-primary" onclick="openModal('create-network-modal')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Create Network</span>
            </button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(n => {
    const subnets = n.subnets ? n.subnets.map(s => s.subnet).join(', ') : '-';
    const gateways = n.subnets ? n.subnets.map(s => s.gateway).filter(Boolean).join(', ') : '-';
    const nShort = shortId(n.id);
    const netIdSafe = encodeURIComponent(n.name).replace(/[^a-zA-Z0-9_-]/g, '_');
    const rowId = `expand-net-${netIdSafe}`;
    const isExpanded = state.expandedRows.has(rowId);

    return `
      <tr class="table-row-item">
        <td><strong>${escapeHtml(n.name)}</strong></td>
        <td class="col-hide-tablet"><span class="item-id">${nShort}</span></td>
        <td><span class="tag-badge rootless">${escapeHtml(n.driver || 'bridge')}</span></td>
        <td class="col-hide-tablet" style="font-family:monospace; font-size:12px;">${escapeHtml(subnets)}</td>
        <td class="col-hide-tablet" style="font-family:monospace; font-size:12px;">${escapeHtml(gateways)}</td>
        <td class="col-actions-cell" style="text-align:right;">
          <button type="button" class="btn btn-secondary btn-icon-only btn-sm action-trigger-btn" title="Actions" aria-label="Actions" aria-haspopup="true" aria-expanded="false" onclick="openFloatingDropdown('network', '${encodeURIComponent(n.name)}', this, event)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><circle cx="5" cy="12" r="2"></circle></svg>
          </button>
        </td>
        <td class="mobile-toggle-cell" style="text-align:center;">
          <button type="button" class="btn-expand-row ${isExpanded ? 'expanded' : ''}" data-target-row="${rowId}" aria-label="Toggle details for ${escapeHtml(n.name)}" aria-expanded="${isExpanded}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </td>
      </tr>
      <tr class="expandable-details-row ${isExpanded ? 'open' : ''}" id="${rowId}">
        <td colspan="7">
          <div class="details-drawer-content">
            <div class="drawer-grid">
              <div class="drawer-field">
                <span class="drawer-label">Network ID</span>
                <span class="drawer-value" style="font-family:monospace; font-size:11px;">${nShort}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Subnets</span>
                <span class="drawer-value" style="font-family:monospace; font-size:11px;">${escapeHtml(subnets)}</span>
              </div>
              <div class="drawer-field">
                <span class="drawer-label">Gateways</span>
                <span class="drawer-value" style="font-family:monospace; font-size:11px;">${escapeHtml(gateways)}</span>
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 7. Events Log
async function loadEvents(force = false) {
  try {
    const res = await API.getEvents('24h');
    if (res?.data && Array.isArray(res.data)) {
      if (force || state.events.length === 0) {
        state.events = res.data;
      } else {
        // Merge without duplicating
        const existingKeys = new Set(state.events.map(e => `${e.time || e.Time}_${e.timeNano || ''}_${e.ID || e.Name}_${e.Status || e.Action}`));
        for (const item of res.data) {
          const key = `${item.time || item.Time}_${item.timeNano || ''}_${item.ID || item.Name}_${item.Status || item.Action}`;
          if (!existingKeys.has(key)) {
            state.events.push(item);
            existingKeys.add(key);
          }
        }
        state.events.sort((a, b) => ((b.time || b.Time || 0) - (a.time || a.Time || 0)));
      }
      updateBadges();
      if (state.activeView === 'events') {
        renderEvents();
      }
    }
  } catch (err) {
    console.warn('Failed to load past events:', err);
  }
}

function initEventStream() {
  try {
    const eventSource = new EventSource('/api/events/stream');
    eventSource.onmessage = (e) => {
      try {
        const item = JSON.parse(e.data);
        if (item && (item.Type || item.Action || item.Status)) {
          state.events.unshift(item);
          if (state.events.length > 250) state.events.pop();
          updateBadges();
          if (state.activeView === 'events') {
            renderEvents();
          }
        }
      } catch {}
    };
    eventSource.onerror = () => {
      // Reconnect handled automatically by EventSource
    };
  } catch (err) {
    console.warn('Events SSE not supported or blocked:', err);
  }
}

function renderEvents() {
  const container = document.getElementById('events-container');
  if (!container) return;

  const search = (state.eventFilter?.search || '').toLowerCase();
  const filtered = state.events.filter(ev => {
    if (!search) return true;
    const type = (ev.Type || '').toLowerCase();
    const action = (ev.Action || ev.Status || '').toLowerCase();
    const name = (ev.Name || ev.ID || '').toLowerCase();
    return type.includes(search) || action.includes(search) || name.includes(search);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
        <div class="empty-state-title">No events found</div>
        <div class="empty-state-desc">Listening for Podman daemon activity (containers created, started, stopped, images pulled, etc.).</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(ev => {
    const type = ev.Type || 'system';
    const action = ev.Action || ev.Status || 'event';
    const name = ev.Name || (ev.Image ? ev.Image.split('/').pop() : '') || (ev.ID ? shortId(ev.ID) : '-');
    const timestamp = ev.time || ev.Time;
    const timeStr = timestamp ? new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
    const dateStr = timestamp ? new Date(timestamp * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

    let actionStyle = 'background-color:rgba(255,255,255,0.06); color:var(--text-secondary);';
    if (['start', 'create', 'pull'].includes(action)) {
      actionStyle = 'background-color:var(--apple-green-soft); color:var(--apple-green);';
    } else if (['died', 'die', 'kill', 'remove', 'rm'].includes(action)) {
      actionStyle = 'background-color:var(--apple-red-soft); color:var(--apple-red);';
    } else if (['stop', 'pause'].includes(action)) {
      actionStyle = 'background-color:var(--apple-yellow-soft); color:var(--apple-yellow);';
    }

    return `
      <div style="padding:12px 18px; border-bottom:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:13px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; min-width:0;">
          <span class="tag-badge rootless" style="text-transform:uppercase; font-size:10px; letter-spacing:0.5px;">${escapeHtml(type)}</span>
          <span class="tag-badge" style="${actionStyle}; font-weight:600;">${escapeHtml(action)}</span>
          <strong style="color:var(--text-primary); word-break:break-all;">${escapeHtml(name)}</strong>
          ${ev.ID ? `<span class="item-id" title="${escapeHtml(ev.ID)}">${shortId(ev.ID)}</span>` : ''}
          ${ev.ExitCode !== undefined || ev.ContainerExitCode !== undefined ? `<span style="font-size:11px; color:var(--text-tertiary);">(exit ${ev.ExitCode ?? ev.ContainerExitCode})</span>` : ''}
        </div>
        <div style="text-align:right; white-space:nowrap; flex-shrink:0;">
          <div style="font-size:12px; font-weight:500; color:var(--text-primary); font-family:ui-monospace, SFMono-Regular, monospace;">${timeStr}</div>
          <div style="font-size:10px; color:var(--text-tertiary);">${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------- ACTIONS -----------------

// Container Actions
async function actionContainer(id, action) {
  try {
    showToast('Executing...', `${action.toUpperCase()} container ${shortId(id)}`, 'info');
    if (action === 'start') await API.startContainer(id);
    else if (action === 'stop') await API.stopContainer(id);
    else if (action === 'restart') await API.restartContainer(id);
    else if (action === 'pause') await API.pauseContainer(id);
    else if (action === 'unpause') await API.unpauseContainer(id);

    showToast('Success', `Container ${action} completed`, 'success');
    await refreshData();
  } catch (err) {
    showToast(`Failed to ${action} container`, err.message, 'error');
  }
}

function confirmDeleteContainer(id, name) {
  if (confirm(`Are you sure you want to remove container "${name}" (${shortId(id)})?`)) {
    API.removeContainer(id, true)
      .then(() => {
        showToast('Container Removed', `Removed ${name}`, 'success');
        refreshData();
      })
      .catch(err => {
        showToast('Failed to Remove Container', err.message, 'error');
      });
  }
}

// Pod Actions
async function actionPod(id, action) {
  try {
    showToast('Executing...', `${action.toUpperCase()} pod ${shortId(id)}`, 'info');
    if (action === 'start') await API.startPod(id);
    else if (action === 'stop') await API.stopPod(id);
    else if (action === 'restart') await API.restartPod(id);

    showToast('Success', `Pod ${action} completed`, 'success');
    await refreshData();
  } catch (err) {
    showToast(`Failed to ${action} pod`, err.message, 'error');
  }
}

function confirmDeletePod(id, name) {
  if (confirm(`Are you sure you want to delete pod "${name}"? Containers inside will also be removed.`)) {
    API.removePod(id, true)
      .then(() => {
        showToast('Pod Removed', `Removed ${name}`, 'success');
        refreshData();
      })
      .catch(err => {
        showToast('Failed to Remove Pod', err.message, 'error');
      });
  }
}

// Image Actions
function confirmDeleteImage(id, name) {
  if (confirm(`Are you sure you want to remove image "${name}"?`)) {
    API.removeImage(id, true)
      .then(() => {
        showToast('Image Removed', `Removed ${name}`, 'success');
        refreshData();
      })
      .catch(err => {
        showToast('Failed to Remove Image', err.message, 'error');
      });
  }
}

// Volume Actions
function deleteVolume(name) {
  if (confirm(`Are you sure you want to delete volume "${decodeURIComponent(name)}"?`)) {
    API.removeVolume(name, true)
      .then(() => {
        showToast('Volume Removed', decodeURIComponent(name), 'success');
        refreshData();
      })
      .catch(err => {
        showToast('Failed to Remove Volume', err.message, 'error');
      });
  }
}

// Network Actions
function deleteNetwork(name) {
  if (confirm(`Are you sure you want to delete network "${decodeURIComponent(name)}"?`)) {
    API.removeNetwork(name)
      .then(() => {
        showToast('Network Removed', decodeURIComponent(name), 'success');
        refreshData();
      })
      .catch(err => {
        showToast('Failed to Remove Network', err.message, 'error');
      });
  }
}

// System Prune
async function executePrune(type) {
  if (!confirm(`Are you sure you want to prune ${type}? This will delete unused data irreversibly.`)) {
    return;
  }
  try {
    showToast('Pruning...', `Pruning ${type}...`, 'info');
    const res = await API.pruneSystem(type);
    showToast('Prune Completed', res.stdout || 'Cleaned unused resources', 'success');
    closeModal('prune-modal');
    await refreshData();
  } catch (err) {
    showToast('Prune Failed', err.message, 'error');
  }
}

// Inspect Modal
async function inspectItem(type, id) {
  openModal('inspect-modal');
  const inspectTitle = document.getElementById('inspect-modal-title');
  const inspectViewer = document.getElementById('inspect-content');

  inspectTitle.textContent = `Inspect ${type.toUpperCase()}: ${decodeURIComponent(id)}`;
  inspectViewer.textContent = 'Loading details...';

  try {
    let data;
    if (type === 'container') data = (await API.inspectContainer(id)).data;
    else if (type === 'pod') data = (await API.inspectPod(id)).data;
    else if (type === 'image') data = (await API.inspectImage(id)).data;
    else if (type === 'volume') data = (await API.inspectVolume(id)).data;
    else if (type === 'network') data = (await API.inspectNetwork(id)).data;

    inspectViewer.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    inspectViewer.textContent = `Error loading inspection data:\n${err.message}`;
  }
}

// Container Logs Viewer
function viewContainerLogs(id, name) {
  state.logsConfig.containerId = id;
  state.logsConfig.containerName = name;
  openModal('logs-modal');
  document.getElementById('logs-modal-title').textContent = `Logs: ${name}`;

  // Sync button active states
  const autoBtn = document.getElementById('btn-logs-autoscroll');
  if (autoBtn) autoBtn.classList.toggle('active', state.logsConfig.autoscroll);
  const timeBtn = document.getElementById('btn-logs-timestamps');
  if (timeBtn) timeBtn.classList.toggle('active', state.logsConfig.timestamps);

  restartLogsStream();
}

function restartLogsStream() {
  const viewer = document.getElementById('logs-viewer');
  if (!viewer) return;
  const id = state.logsConfig.containerId;
  if (!id) return;

  viewer.textContent = 'Streaming logs...\n';

  if (state.activeLogStream) {
    state.activeLogStream.close();
    state.activeLogStream = null;
  }

  const tail = document.getElementById('logs-tail-select')?.value || 100;
  const timestamps = state.logsConfig.timestamps;

  try {
    const sse = new EventSource(`/api/containers/${id}/logs/stream?tail=${tail}&timestamps=${timestamps}`);
    state.activeLogStream = sse;

    sse.onmessage = (e) => {
      try {
        const item = JSON.parse(e.data);
        if (item.log) {
          viewer.textContent += item.log + '\n';
          if (state.logsConfig.autoscroll) {
            viewer.scrollTop = viewer.scrollHeight;
          }
        }
      } catch {}
    };

    sse.addEventListener('end', () => {
      viewer.textContent += '\n[Log stream closed]\n';
      sse.close();
      state.activeLogStream = null;
    });

    sse.onerror = () => {
      // fallback to static log fetch if streaming encounters error
      API.getContainerLogs(id, tail, timestamps).then(res => {
        viewer.textContent = res.logs || 'No logs available.';
        if (state.logsConfig.autoscroll) {
          viewer.scrollTop = viewer.scrollHeight;
        }
      }).catch(err => {
        viewer.textContent = `Error fetching logs: ${err.message}`;
      });
      sse.close();
      state.activeLogStream = null;
    };
  } catch (err) {
    viewer.textContent = `Log viewer error: ${err.message}`;
  }
}

function toggleLogsAutoscroll() {
  state.logsConfig.autoscroll = !state.logsConfig.autoscroll;
  const btn = document.getElementById('btn-logs-autoscroll');
  if (btn) {
    btn.classList.toggle('active', state.logsConfig.autoscroll);
  }
  if (state.logsConfig.autoscroll) {
    const viewer = document.getElementById('logs-viewer');
    if (viewer) viewer.scrollTop = viewer.scrollHeight;
  }
}

function toggleLogsTimestamps() {
  state.logsConfig.timestamps = !state.logsConfig.timestamps;
  const btn = document.getElementById('btn-logs-timestamps');
  if (btn) {
    btn.classList.toggle('active', state.logsConfig.timestamps);
  }
  restartLogsStream();
}

function copyLogsToClipboard() {
  const viewer = document.getElementById('logs-viewer');
  if (!viewer) return;
  navigator.clipboard.writeText(viewer.textContent).then(() => {
    showToast('Copied to Clipboard', 'Container logs copied', 'info');
  }).catch(() => {
    showToast('Copy Failed', 'Unable to copy logs', 'error');
  });
}

function clearLogsViewer() {
  const viewer = document.getElementById('logs-viewer');
  if (viewer) viewer.textContent = '';
}

// Container Exec Terminal
let activeExecContainerId = null;
function openExecModal(id, name) {
  activeExecContainerId = id;
  openModal('exec-modal');
  document.getElementById('exec-modal-title').textContent = `Execute Command: ${name}`;
  document.getElementById('exec-cmd-input').value = '';
  document.getElementById('exec-output').textContent = 'Enter a command above and press Run (e.g. uname -a, ps aux, ls -la, env)...';
}

async function runContainerExec() {
  if (!activeExecContainerId) return;
  const cmd = document.getElementById('exec-cmd-input').value.trim();
  if (!cmd) return;

  const outputBox = document.getElementById('exec-output');
  outputBox.textContent = `Running: ${cmd}...\n`;

  try {
    const res = await API.execContainer(activeExecContainerId, cmd);
    outputBox.textContent = (res.stdout || '') + (res.stderr ? '\n[STDERR]:\n' + res.stderr : '');
    if (!res.stdout && !res.stderr) {
      outputBox.textContent = '[Command completed with empty output]';
    }
  } catch (err) {
    outputBox.textContent = `Execution failed:\n${err.message}`;
  }
}

// Create Container Modal
function openCreateContainerModal(prefillImage = '') {
  openModal('create-container-modal');
  if (prefillImage) {
    document.getElementById('create-image-input').value = prefillImage;
  }
}

async function handleCreateContainer(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-create-container');
  btn.disabled = true;
  btn.textContent = 'Launching Container...';

  const payload = {
    image: document.getElementById('create-image-input').value.trim(),
    name: document.getElementById('create-name-input').value.trim(),
    ports: document.getElementById('create-ports-input').value.trim(),
    envs: document.getElementById('create-envs-input').value.trim(),
    volumes: document.getElementById('create-volumes-input').value.trim(),
    cmd: document.getElementById('create-cmd-input').value.trim(),
    restart: document.getElementById('create-restart-select').value,
    autoRemove: document.getElementById('create-autoremove-check').checked
  };

  try {
    const result = await API.createContainer(payload);
    showToast('Container Launched', `ID: ${shortId(result.containerId)}`, 'success');
    closeModal('create-container-modal');
    e.target.reset();
    await refreshData();
  } catch (err) {
    showToast('Launch Failed', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Run Container';
  }
}

// Create Pod Modal
async function handleCreatePod(e) {
  e.preventDefault();
  const name = document.getElementById('create-pod-name').value.trim();
  const ports = document.getElementById('create-pod-ports').value.trim();

  try {
    await API.createPod({ name, ports });
    showToast('Pod Created', name || 'New Pod', 'success');
    closeModal('create-pod-modal');
    e.target.reset();
    await refreshData();
  } catch (err) {
    showToast('Failed to Create Pod', err.message, 'error');
  }
}

// Pull Image Modal
function handlePullImage(e) {
  e.preventDefault();
  const image = document.getElementById('pull-image-input').value.trim();
  if (!image) return;

  const outputBox = document.getElementById('pull-output');
  outputBox.style.display = 'block';
  outputBox.textContent = `Starting pull for ${image}...\n`;

  const btn = document.getElementById('btn-submit-pull');
  btn.disabled = true;
  btn.textContent = 'Pulling...';

  try {
    const sse = new EventSource(`/api/images/pull-stream?image=${encodeURIComponent(image)}`);
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.text) {
          outputBox.textContent += data.text;
          outputBox.scrollTop = outputBox.scrollHeight;
        }
      } catch {}
    };

    sse.addEventListener('complete', () => {
      outputBox.textContent += '\nImage pull completed successfully!\n';
      showToast('Image Pulled', image, 'success');
      btn.disabled = false;
      btn.textContent = 'Pull Image';
      sse.close();
      refreshData();
    });

    sse.addEventListener('error', (event) => {
      try {
        const data = JSON.parse(event.data);
        outputBox.textContent += `\nError pulling image: ${data.error}\n`;
        showToast('Pull Failed', data.error, 'error');
      } catch {
        outputBox.textContent += '\nConnection to pull stream closed or failed.\n';
      }
      btn.disabled = false;
      btn.textContent = 'Pull Image';
      sse.close();
    });
  } catch (err) {
    outputBox.textContent += `\nError: ${err.message}\n`;
    btn.disabled = false;
    btn.textContent = 'Pull Image';
  }
}

// Create Volume Modal
async function handleCreateVolume(e) {
  e.preventDefault();
  const name = document.getElementById('create-vol-name').value.trim();
  const driver = document.getElementById('create-vol-driver').value.trim();

  try {
    await API.createVolume(name, driver);
    showToast('Volume Created', name, 'success');
    closeModal('create-volume-modal');
    e.target.reset();
    await refreshData();
  } catch (err) {
    showToast('Failed to Create Volume', err.message, 'error');
  }
}

// Create Network Modal
async function handleCreateNetwork(e) {
  e.preventDefault();
  const name = document.getElementById('create-net-name').value.trim();
  const driver = document.getElementById('create-net-driver').value.trim() || 'bridge';
  const subnet = document.getElementById('create-net-subnet').value.trim() || undefined;
  const gateway = document.getElementById('create-net-gateway').value.trim() || undefined;

  try {
    await API.createNetwork({ name, driver, subnet, gateway });
    showToast('Network Created', name, 'success');
    closeModal('create-network-modal');
    e.target.reset();
    await refreshData();
  } catch (err) {
    showToast('Failed to Create Network', err.message, 'error');
  }
}

// Setup Auto Refresh
function setupAutoRefresh() {
  const select = document.getElementById('refresh-interval-select');
  if (!select) return;

  const updateInterval = () => {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    const val = parseInt(select.value, 10);
    state.refreshInterval = val;
    if (val > 0) {
      state.refreshTimer = setInterval(() => {
        refreshData();
      }, val);
    }
  };

  select.addEventListener('change', updateInterval);
  updateInterval();
}

// Mobile Navigation Toggle
function toggleMobileSidebar(open) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggleBtn = document.getElementById('btn-menu-toggle');

  const shouldOpen = typeof open === 'boolean' ? open : !sidebar?.classList.contains('mobile-open');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open', shouldOpen);
  }
  if (backdrop) {
    backdrop.classList.toggle('active', shouldOpen);
  }
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', String(shouldOpen));
  }
  if (shouldOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Mobile drawer controls
  document.getElementById('btn-menu-toggle')?.addEventListener('click', () => toggleMobileSidebar());
  document.getElementById('btn-sidebar-close')?.addEventListener('click', () => toggleMobileSidebar(false));
  document.getElementById('sidebar-backdrop')?.addEventListener('click', () => toggleMobileSidebar(false));

  // Navigation tabs with mobile auto-collapse and keyboard support
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    const handleNav = (e) => {
      e.preventDefault();
      switchView(link.getAttribute('data-view'));
      toggleMobileSidebar(false);
    };

    link.addEventListener('click', handleNav);
    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleNav(e);
      }
    });
  });

  // Global Keyboard Navigation (Escape closes modals or mobile drawer)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeFloatingDropdown();
      const openModalEl = document.querySelector('.modal-overlay.open');
      if (openModalEl) {
        closeModal(openModalEl.id);
      } else {
        toggleMobileSidebar(false);
      }
    }
  });

  // Manual refresh button
  document.getElementById('btn-refresh-manual')?.addEventListener('click', () => {
    refreshData();
  });

  // Auto-refresh config
  setupAutoRefresh();

  // Filter & Search inputs
  document.getElementById('container-search')?.addEventListener('input', (e) => {
    state.containerFilter.search = e.target.value;
    renderContainers();
  });

  // Container status segmented control
  document.querySelectorAll('#container-status-segmented .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#container-status-segmented .segment-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.containerFilter.status = btn.dataset.status || 'all';
      renderContainers();
    });
  });

  // Fallback native select if present
  document.getElementById('container-status-filter')?.addEventListener('change', (e) => {
    state.containerFilter.status = e.target.value;
    renderContainers();
  });

  document.getElementById('pod-search')?.addEventListener('input', (e) => {
    state.podFilter.search = e.target.value;
    renderPods();
  });

  document.getElementById('image-search')?.addEventListener('input', (e) => {
    state.imageFilter.search = e.target.value;
    renderImages();
  });

  document.getElementById('volume-search')?.addEventListener('input', (e) => {
    state.volumeFilter.search = e.target.value;
    renderVolumes();
  });

  document.getElementById('network-search')?.addEventListener('input', (e) => {
    state.networkFilter.search = e.target.value;
    renderNetworks();
  });

  document.getElementById('event-search')?.addEventListener('input', (e) => {
    state.eventFilter.search = e.target.value;
    renderEvents();
  });

  // Forms submission
  document.getElementById('form-create-container')?.addEventListener('submit', handleCreateContainer);
  document.getElementById('form-create-pod')?.addEventListener('submit', handleCreatePod);
  document.getElementById('form-pull-image')?.addEventListener('submit', handlePullImage);
  document.getElementById('form-create-volume')?.addEventListener('submit', handleCreateVolume);
  document.getElementById('form-create-network')?.addEventListener('submit', handleCreateNetwork);

  // Exec run button & Enter key
  document.getElementById('btn-run-exec')?.addEventListener('click', runContainerExec);
  document.getElementById('exec-cmd-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runContainerExec();
  });

  // Copy inspect JSON
  document.getElementById('btn-copy-inspect')?.addEventListener('click', () => {
    const text = document.getElementById('inspect-content').textContent;
    navigator.clipboard.writeText(text);
    showToast('Copied to Clipboard', 'Inspection JSON copied', 'info');
  });

  // Modal overlay click outside to close
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Popstate listener for browser back/forward navigation
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const viewFromQuery = params.get('view');
    const viewFromHash = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : null;
    const target = viewFromQuery || viewFromHash || 'dashboard';
    switchView(target, false);
  });

  // Initial load from URL state
  const initialParams = new URLSearchParams(window.location.search);
  const initialViewQuery = initialParams.get('view');
  const initialViewHash = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : null;
  const initialView = initialViewQuery || initialViewHash || 'dashboard';

  switchView(initialView, false);
  loadEvents();
  initEventStream();
});
