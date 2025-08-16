import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';

import {onlineGame} from './game/onlineGame';
import {friendGame} from './game/friendGame';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
const server: http.Server = http.createServer(app);

app.use(cors());

const wss = new WebSocketServer({ server });

app.get('/', (req, res) => {
    res.send('Welcome to the Chess Server!');
});

wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    if (url.pathname === '/play-online') {
        onlineGame(ws);
    } else if (url.pathname.startsWith('/play-with-friend/')) {
        const roomId = url.pathname.split('/')[2];
        friendGame(ws, roomId);
    } else {
        ws.close();
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
