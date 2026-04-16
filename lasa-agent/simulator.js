import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import lasaAgent from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
// Set these via environment variables or a .env file
// Get your agent token from LASA Dashboard → Endpoints → Copy Token
const API_KEY = process.env.LASA_AGENT_TOKEN || '';
const ENDPOINT = process.env.LASA_SERVER_URL || 'http://localhost:5000';

if (!API_KEY) {
  console.error('❌ LASA_AGENT_TOKEN environment variable is required!');
  console.error('   Set it via: LASA_AGENT_TOKEN=your_token_here node simulator.js');
  process.exit(1);
}
const LOG_FILE = path.join(__dirname, 'test-access.log');



// Ensure log file exists and is empty
fs.writeFileSync(LOG_FILE, '');

console.log("🚀 Starting LASA Simulator...");
console.log(`📝 Writing simulated traffic to ${LOG_FILE}...`);

// Initialize the Agent
lasaAgent({
    apiKey: API_KEY,
    logFilePath: LOG_FILE,
    endpoint: ENDPOINT
});

// A pool of fake data to make the traffic look real or suspicious!
const ips = ['192.168.1.10', '203.0.113.42', '10.0.0.5', '172.16.254.1', '198.51.100.14'];
const methods = ['GET', 'POST', 'PUT'];
const endpoints = ['/api/users', '/login', '/admin/dashboard', '/wp-admin', '/.env', '/public/styles.css', '/api/data'];
const statuses = [200, 201, 401, 403, 404, 500];
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'curl/7.68.0',
    'python-requests/2.25.1', // Might trigger an alert!
    'MaliciousBot/1.0',       // Will definitely trigger an alert!
    'Nmap Scripting Engine'
];

function generateRandomLogLine() {
    const ip = ips[Math.floor(Math.random() * ips.length)];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const size = Math.floor(Math.random() * 5000) + 200;
    const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

    // Apache/Nginx combined format
    const now = new Date();
    // E.g. [16/Apr/2026:23:45:12 +0000]
    const day = now.getDate().toString().padStart(2, '0');
    const month = now.toLocaleString('en-US', { month: 'short' });
    const year = now.getFullYear();
    const time = now.toTimeString().split(' ')[0];
    const tz = "+0000";

    return `${ip} - - [${day}/${month}/${year}:${time} ${tz}] "${method} ${endpoint} HTTP/1.1" ${status} ${size} "-" "${ua}"\n`;
}

// Generate a new log entry every 2 to 5 seconds
function simulateTraffic() {
    const line = generateRandomLogLine();
    fs.appendFileSync(LOG_FILE, line);

    // Schedule next log
    const nextTimeout = Math.floor(Math.random() * 3000) + 2000;
    setTimeout(simulateTraffic, nextTimeout);
}

// Start simulation
simulateTraffic();
