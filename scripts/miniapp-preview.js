import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { databasePath } from '../src/system/paths.js';
import { initializeDatabase } from '../src/database/connection.js';
import { ChatbotEngine } from '../src/chatbot/engine.js';
import { handleChatbotApi } from '../src/chatbot/api.js';

const args = process.argv.slice(2);
const root = resolve('miniapp');
const port = Number(process.env.PORT) || Number(args[args.indexOf('--port') + 1]) || 3000;

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Initialize database schema so chatbot tables exist
try {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  initializeDatabase(databasePath);
} catch (err) {
  console.warn('[Server] Notice on database initialization:', err.message || err);
}

const chatbotEngine = new ChatbotEngine({
  databasePath,
  onSendWhatsApp: async () => true
});

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

async function parseBody(req) {
  let chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${port}`);

    // API routes for Chatbot
    if (u.pathname.startsWith('/api/chatbot/')) {
      const body = req.method === 'POST' ? await parseBody(req) : null;
      const handled = await handleChatbotApi({
        req,
        res,
        url: u,
        body,
        databasePath,
        chatbotEngine,
        manager: null
      });
      if (handled !== false) return;
    }

    // Default route
    if (u.pathname === '/') {
      const htmlPath = resolve(root, 'index.html');
      const body = await readFile(htmlPath);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(body);
    }

    // Static asset serving
    const filePath = resolve(root, decodeURIComponent(u.pathname.slice(1)));
    if (!filePath.startsWith(root + sep)) throw new Error('Forbidden');
    const body = await readFile(filePath);
    res.setHeader('Content-Type', mimeTypes[extname(filePath)] || 'text/plain');
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`WhatsApp Chatbot Web Portal & Live Panel running on port ${port}`);
});
