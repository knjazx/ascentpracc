import * as dotenv from 'dotenv';
dotenv.config();

import './src/lib/patch';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './src/lib/socket/auth';
import { registerMatchHandlers } from './src/lib/socket/match-handler';
import { registerVetoHandlers } from './src/lib/socket/veto-handler';
import { ensureDatabaseRunning } from './src/lib/db-server';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

// In Next.js, passing hostname: '0.0.0.0' corrupts request URLs with 0.0.0.0.
// In dev, 'localhost' is fine. In production behind a proxy (Render/Vercel),
// omitting hostname lets Next.js dynamically read the client's Host and X-Forwarded-Host.
const app = next(dev ? { dev, hostname: 'localhost', port } : { dev, port });
const handle = app.getRequestHandler();

let isNextReady = false;
let prepareError: Error | null = null;

// Start preparing Next.js engine asynchronously
const preparePromise = app
  .prepare()
  .then(async () => {
    if (dev && !process.env.RENDER) {
      await ensureDatabaseRunning();
    }
    isNextReady = true;
    console.log(`> Next.js engine initialized successfully (${dev ? 'development' : 'production'})`);
  })
  .catch((err) => {
    prepareError = err;
    console.error('> Failed to prepare Next.js engine:', err);
  });

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url!, true);
    const pathname = parsedUrl.pathname;

    // Instant health-check response for Render watchdog, UptimeRobot, and load balancers
    if (pathname === '/health' || pathname === '/api/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.end(JSON.stringify({ status: 'ok', ready: isNextReady, uptime: process.uptime() }));
      return;
    }

    // If Next.js is still preparing on a cold start, wait for it instead of dropping the request
    if (!isNextReady) {
      if (prepareError) {
        res.statusCode = 500;
        res.end(`Next.js initialization error: ${prepareError.message}`);
        return;
      }
      await preparePromise;
    }

    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error('[HTTP] Error handling request:', req.url, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
});

const io = new SocketIOServer(server, {
  path: '/socket.io',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Attach Socket.IO session verification middleware
io.use((socket, next) => {
  socketAuthMiddleware(socket, next);
});

io.on('connection', (socket) => {
  const authSocket = socket as AuthenticatedSocket;
  const user = authSocket.data.user;

  console.log(`[Socket.IO] Authenticated user connected: ${user?.nickname} (${socket.id})`);

  // Register Match Lobby & Chat event handlers
  registerMatchHandlers(io, authSocket);
  registerVetoHandlers(io, authSocket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] User disconnected: ${user?.nickname || socket.id} (${reason})`);
  });
});

(global as unknown as { io: SocketIOServer }).io = io;

// IMMEDIATELY bind to 0.0.0.0 so Render detects the service is ALIVE within milliseconds
server.listen(port, '0.0.0.0', () => {
  console.log(`> Ascent Pracc Server listening immediately on 0.0.0.0:${port}`);
});
