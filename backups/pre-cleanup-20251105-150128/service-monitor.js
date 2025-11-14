#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const SERVICES = {
    'api-server': {
        command: 'node',
        args: ['api-server.js'],
        port: 3001,
        healthCheck: 'http://localhost:3001/api/health',
        restartDelay: 2000,
        checkInterval: 10000,
    },
    'frontend': {
        command: 'python3',
        args: ['-m', 'http.server', '8081'],
        port: 8081,
        cwd: './public',
        healthCheck: 'http://localhost:8081/',
        restartDelay: 2000,
        checkInterval: 15000,
    }
};

const processes = {};
const failureCount = {};

// Initialize failure counts
Object.keys(SERVICES).forEach(service => {
    failureCount[service] = 0;
});

// Logging
function log(service, message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
        'info': '✓',
        'warn': '⚠',
        'error': '✗',
        'start': '▶'
    }[type] || '•';
    console.log(`[${timestamp}] [${service}] ${prefix} ${message}`);
}

// Check if service is healthy
function healthCheck(service) {
    return new Promise((resolve) => {
        const serviceConfig = SERVICES[service];
        const req = http.get(serviceConfig.healthCheck, { timeout: 3000 }, (res) => {
            resolve(res.statusCode === 200 || res.statusCode === 304);
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.abort();
            resolve(false);
        });
    });
}

// Start a service
function startService(service) {
    if (processes[service]) {
        log(service, 'Already running, skipping start');
        return;
    }

    const config = SERVICES[service];
    const cwd = config.cwd ? path.join(__dirname, config.cwd) : __dirname;

    log(service, `Starting (cwd: ${cwd})...`, 'start');

    const proc = spawn(config.command, config.args, {
        cwd: cwd,
        stdio: 'pipe',
        detached: false,
        env: { ...process.env, NODE_ENV: 'production' }
    });

    // Capture stdout/stderr for debugging
    proc.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) log(service, message, 'info');
    });

    proc.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) log(service, message, 'error');
    });

    proc.on('exit', (code) => {
        log(service, `Exited with code ${code}`, 'warn');
        processes[service] = null;
        failureCount[service]++;
    });

    processes[service] = proc;
    failureCount[service] = 0;
    log(service, `Started (PID: ${proc.pid})`, 'start');
}

// Check and restart service if needed
async function monitorService(service) {
    const config = SERVICES[service];

    // Check if process is still alive
    if (!processes[service]) {
        log(service, 'Process not running, restarting...', 'warn');
        startService(service);
        await new Promise(r => setTimeout(r, config.restartDelay));
    }

    // Check health
    const isHealthy = await healthCheck(service);

    if (!isHealthy) {
        failureCount[service]++;
        log(service, `Health check failed (${failureCount[service]} consecutive failures)`, 'warn');

        // Restart after 2 consecutive failures
        if (failureCount[service] >= 2) {
            log(service, 'Restarting due to health check failures...', 'error');
            if (processes[service]) {
                processes[service].kill('SIGTERM');
                await new Promise(r => setTimeout(r, 1000));
                if (processes[service]) {
                    processes[service].kill('SIGKILL');
                }
            }
            processes[service] = null;
            await new Promise(r => setTimeout(r, config.restartDelay));
            startService(service);
        }
    } else {
        failureCount[service] = 0;
        log(service, 'Healthy', 'info');
    }
}

// Main monitoring loop
async function monitor() {
    log('monitor', 'Starting service monitor', 'start');

    // Start all services initially
    Object.keys(SERVICES).forEach(service => {
        startService(service);
    });

    // Monitor loop
    setInterval(async () => {
        for (const service of Object.keys(SERVICES)) {
            try {
                await monitorService(service);
            } catch (err) {
                log(service, `Monitor error: ${err.message}`, 'error');
            }
        }
    }, 5000);
}

// Graceful shutdown
process.on('SIGINT', () => {
    log('monitor', 'Shutting down...', 'warn');
    Object.values(processes).forEach(proc => {
        if (proc) proc.kill('SIGTERM');
    });
    setTimeout(() => process.exit(0), 2000);
});

// Start monitoring
monitor().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
