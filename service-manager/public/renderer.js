const socket = io();

const logsContainer = document.getElementById('logs');
const clearLogsBtn = document.getElementById('clear-logs');
const themeToggleBtn = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

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
    },
    agent: {
        startBtn: document.getElementById('start-agent'),
        stopBtn: document.getElementById('stop-agent'),
        status: document.getElementById('agent-status'),
        labelClass: 'label-server', // Re-use violet theme
        label: 'Agent'
    }
};

// Theme Switcher Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
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
    const isDark = document.body.classList.contains('dark-theme');
    applyTheme(isDark ? 'light' : 'dark');
});

initTheme();

function appendLog(serviceName, data, isError = false) {
    const line = document.createElement('div');
    line.className = `log-line ${isError ? 'error' : ''}`;

    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const service = services[serviceName];

    line.innerHTML = `
        <span class="timestamp">${timestamp}</span>
        <span class="label ${service.labelClass}">${service.label}</span>
        <span class="content">${data.trim()}</span>
    `;

    logsContainer.appendChild(line);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    if (logsContainer.children.length > 500) {
        logsContainer.removeChild(logsContainer.firstChild);
    }
}

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
    logsContainer.innerHTML = '';
});

// Socket listeners
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

// Initial sync
async function syncStatus() {
    try {
        const res = await fetch('/api/status');
        const status = await res.json();

        if (status.client) {
            services.client.status.classList.add('running');
            services.client.startBtn.disabled = true;
            services.client.stopBtn.disabled = false;
        }
        if (status.server) {
            services.server.status.classList.add('running');
            services.server.startBtn.disabled = true;
            services.server.stopBtn.disabled = false;
        }
        if (status.agent) {
            services.agent.status.classList.add('running');
            services.agent.startBtn.disabled = true;
            services.agent.stopBtn.disabled = false;
        }
    } catch (e) {
        console.error('Failed to sync status:', e);
    }
}

syncStatus();
