import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

import { onlineGame } from './game/onlineGame';
import { friendGame } from './game/friendGame';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
const server: http.Server = http.createServer(app);

app.use(cors());
app.use(express.json());

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const clientId = url.searchParams.get('cid') || '';

    if (url.pathname === '/play-online') {
      onlineGame(ws, clientId);
    } else if (url.pathname.startsWith('/play-with-friend/')) {
      const roomId = url.pathname.split('/')[2];
      friendGame(ws, roomId, clientId);
    } else {
      ws.close();
    }
  } catch {
    ws.close();
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
