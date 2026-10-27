import './src/lib/patch';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import * as dotenv from 'dotenv';
import { socketAuthMiddleware, AuthenticatedSocket } from './src/lib/socket/auth';
import { registerMatchHandlers } from './src/lib/socket/match-handler';
import { registerVetoHandlers } from './src/lib/socket/veto-handler';
import { ensureDatabaseRunning } from './src/lib/db-server';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  await ensureDatabaseRunning();
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[HTTP] Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
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

  server.listen(port, () => {
    console.log(`> Ascent Pracc Server ready on http://${hostname}:${port}`);
  });
});
