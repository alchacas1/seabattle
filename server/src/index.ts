import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import { attachSocketHandlers } from './socket/handlers';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);

const io = new IOServer(server, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  attachSocketHandlers(io, socket as any);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`SeaBattle server listening on http://localhost:${PORT}`);
});
