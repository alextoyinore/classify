const socket = io();

const logsContainer = document.getElementById('logs');
const clearLogsBtn = document.getElementById('clear-logs');
const themeToggleBtn = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');
const filterBtns = document.querySelectorAll('.log-filter-btn');

const netIp = document.getElementById('net-ip');
const netApi = document.getElementById('net-api');
const netClient = document.getElementById('net-client');

// ── Network Info ─────────────────────────────────────────
async function fetchNetworkInfo() {
    try {
        const res = await fetch(`/api/config`);
        const data = await res.json();
        netIp.textContent = data.lanIP;
        netApi.textContent = data.apiUrl;
        netClient.textContent = data.clientUrl;
    } catch (e) {
        console.error('Failed to fetch network info:', e);
    }
}

function makeCopyable(btn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
        const text = btn.textContent;
        if (!text || text === '—') return;
        navigator.clipboard.writeText(text).then(() => {
            btn.classList.add('copied');
            const prev = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = prev; btn.classList.remove('copied'); }, 1500);
        });
    });
}

makeCopyable(netIp);
makeCopyable(netApi);
makeCopyable(netClient);

fetchNetworkInfo();

const services = {
    client: {
        startBtn: document.getElementById('start-client'),
        stopBtn: document.getElementById('stop-client'),
        status: document.getElementById('client-status'),
        labelClass: 'label-client',
        label: 'Client'
    },
    server: {
        startBtn: document.getElementById('start-server'),
        stopBtn: document.getElementById('stop-server'),
        status: document.getElementById('server-status'),
        labelClass: 'label-server',
        label: 'Server'
    }
};

// ... existing theme logic ...
// ── Theme ────────────────────────────────────────────────
function initTheme() {
    applyTheme(localStorage.getItem('theme') || 'light');
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    } else {
        document.body.classList.remove('dark-theme');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }
    localStorage.setItem('theme', theme);
}

themeToggleBtn.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('dark-theme') ? 'light' : 'dark');
});

initTheme();

// ── Log filter ───────────────────────────────────────────
let activeFilter = 'all';

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter();
    });
});

function applyFilter() {
    const lines = logsContainer.querySelectorAll('.log-line');
    lines.forEach(line => {
        if (activeFilter === 'all') {
            line.style.display = '';
        } else {
            line.style.display = line.dataset.service === activeFilter ? '' : 'none';
        }
    });
}

// ── Logging ──────────────────────────────────────────────
function clearEmpty() {
    const empty = logsContainer.querySelector('.log-empty');
    if (empty) empty.remove();
}

function appendLog(serviceName, data, isError = false) {
    clearEmpty();

    const line = document.createElement('div');
    line.className = `log-line${isError ? ' error' : ''}`;
    line.dataset.service = serviceName;

    const service = services[serviceName];
    if (!service) return; // Ignore removed services
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    line.innerHTML = `<span class="timestamp">${timestamp}</span><span class="label ${service.labelClass}">${service.label}</span><span class="content">${escapeHtml(data.trim())}</span>`;

    // Apply current filter immediately
    if (activeFilter !== 'all' && activeFilter !== serviceName) {
        line.style.display = 'none';
    }

    logsContainer.appendChild(line);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Cap at 500 lines
    const lines = logsContainer.querySelectorAll('.log-line');
    if (lines.length > 500) lines[0].remove();
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ── Service Button Bindings ──────────────────────────────
Object.keys(services).forEach(serviceName => {
    const service = services[serviceName];

    service.startBtn.addEventListener('click', async () => {
        service.startBtn.disabled = true;
        try {
            await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: serviceName })
            });
        } catch (err) {
            console.error(err);
            service.startBtn.disabled = false;
        }
    });

    service.stopBtn.addEventListener('click', async () => {
        service.stopBtn.disabled = true;
        try {
            await fetch('/api/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: serviceName })
            });
        } catch (err) {
            console.error(err);
            service.stopBtn.disabled = false;
        }
    });
});

clearLogsBtn.addEventListener('click', () => {
    logsContainer.innerHTML = '<div class="log-empty"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.4"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg><span>Start a service to see logs</span></div>';
});

// ── Socket Listeners ─────────────────────────────────────
socket.on('service-log', ({ serviceName, data, isError }) => {
    if (data && data.trim()) {
        appendLog(serviceName, data, isError);
    }
});

socket.on('service-started', (serviceName) => {
    const service = services[serviceName];
    if (service) {
        service.status.classList.add('running');
        service.startBtn.disabled = true;
        service.stopBtn.disabled = false;
        appendLog(serviceName, 'Service started.');
    }
});

socket.on('service-stopped', (serviceName) => {
    const service = services[serviceName];
    if (service) {
        service.status.classList.remove('running');
        service.startBtn.disabled = false;
        service.stopBtn.disabled = true;
        appendLog(serviceName, 'Service stopped.');
    }
});

// ── Initial Status Sync ──────────────────────────────────
async function syncStatus() {
    try {
        const res = await fetch('/api/status');
        const status = await res.json();

        Object.keys(services).forEach(name => {
            if (status[name]) {
                services[name].status.classList.add('running');
                services[name].startBtn.disabled = true;
                services[name].stopBtn.disabled = false;
            }
        });
    } catch (e) {
        console.error('Failed to sync status:', e);
    }
}

syncStatus();
