import { WebSocket } from 'ws';

type RoomState = {
  host: WebSocket;
  hostId: string;
};

const rooms = new Map<string, RoomState>();
const peers = new Map<WebSocket, WebSocket>();

function safeSend(ws: WebSocket, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function wirePeers(a: WebSocket, b: WebSocket) {
  peers.set(a, b);
  peers.set(b, a);

  const wire = (src: WebSocket, dst: WebSocket) => {
    src.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'move') {
          safeSend(dst, msg);
        }
      } catch {
        /* ignore */
      }
    });
    src.on('close', () => {
      peers.delete(src);
      const other = peers.get(dst);
      if (other === src) peers.delete(dst);
      safeSend(dst, { type: 'friendLeft' });
    });
  };

  wire(a, b);
  wire(b, a);
}

export const friendGame = (ws: WebSocket, roomId: string, clientId?: string) => {
  let joined = false;

  ws.on('message', (raw: Buffer) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg?.type === 'joinRoom' && msg.roomId === roomId) {
      const cid = String(msg.clientId || clientId || '');


      const existing = rooms.get(roomId);
      if (existing && existing.host.readyState === WebSocket.OPEN) {
        if (existing.hostId && existing.hostId === cid) {
          safeSend(ws, { type: 'waitingForFriend', roomId });
          return;
        }

        rooms.delete(roomId);
        safeSend(existing.host, { type: 'matchFound', color: 'white', roomId });
        safeSend(ws, { type: 'matchFound', color: 'black', roomId });
        wirePeers(existing.host, ws);
        joined = true;
        return;
      } else {
        rooms.set(roomId, { host: ws, hostId: cid });
        safeSend(ws, { type: 'waitingForFriend', roomId });
        joined = true;

        ws.on('close', () => {
          const r = rooms.get(roomId);
          if (r?.host === ws) rooms.delete(roomId);
        });
      }
    }
  });

  setTimeout(() => {
    if (!joined && ws.readyState === WebSocket.OPEN) {
      safeSend(ws, { type: 'info', message: 'Send {"type":"joinRoom","roomId":"...","clientId":"..."} to wait/join.' });
    }
  }, 2000);
};
