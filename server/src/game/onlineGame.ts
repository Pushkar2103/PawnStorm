import { WebSocket } from 'ws';

type WaitingEntry = {
  ws: WebSocket;
  clientId: string;
};

const waitingQueue: WaitingEntry[] = [];
const peers = new Map<WebSocket, WebSocket>();

function safeSend(ws: WebSocket, data: any) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function pairPlayers(a: WaitingEntry, b: WaitingEntry) {
  safeSend(a.ws, { type: 'matchFound', color: 'white' });
  safeSend(b.ws, { type: 'matchFound', color: 'black' });

  peers.set(a.ws, b.ws);
  peers.set(b.ws, a.ws);

  const wire = (src: WebSocket, dst: WebSocket) => {
    src.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === 'move' || msg?.type === 'chatMessage') {
          safeSend(dst, msg);
        }
        if (msg?.type === 'startGame') {
          const timeControl = msg.timeControl;

          safeSend(src, { type: 'startGame', timeControl });
          safeSend(dst, { type: 'startGame', timeControl });
        }
      } catch {
        
      }
    });

    src.on('close', () => {
      peers.delete(src);
      const other = peers.get(dst);
      if (other === src) peers.delete(dst);
      safeSend(dst, { type: 'opponentDisconnected' });
    });
  };

  wire(a.ws, b.ws);
  wire(b.ws, a.ws);
}

export const onlineGame = (ws: WebSocket, clientId?: string) => {
  let joined = false;

  ws.on('message', (raw: Buffer) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg?.type === 'queueRandom') {
      const cid = String(msg.clientId || clientId || '');

      while (waitingQueue.length > 0) {
        const candidate = waitingQueue.shift()!;
        if (candidate.ws.readyState !== WebSocket.OPEN) continue;

        if (candidate.clientId && cid && candidate.clientId === cid) {
          waitingQueue.push(candidate);
          break;
        }

        pairPlayers(candidate, { ws, clientId: cid });
        joined = true;
        return;
      }

      waitingQueue.push({ ws, clientId: cid });
      safeSend(ws, { type: 'waitingForOpponent' });
      joined = true;
    }
  });

  ws.on('close', () => {
    const idx = waitingQueue.findIndex((e) => e.ws === ws);
    if (idx >= 0) waitingQueue.splice(idx, 1);

    const peer = peers.get(ws);
    if (peer) {
      peers.delete(ws);
      peers.delete(peer);
      safeSend(peer, { type: 'opponentDisconnected' });
    }
  });

  setTimeout(() => {
    if (!joined && ws.readyState === WebSocket.OPEN) {
      safeSend(ws, { type: 'info', message: 'Send {"type":"queueRandom","clientId":"..."} to join the queue.' });
    }
  }, 2000);
};
