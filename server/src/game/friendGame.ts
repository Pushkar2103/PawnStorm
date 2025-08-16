import { WebSocket } from 'ws';

const rooms = new Map<string, WebSocket>();

export const friendGame = (ws: WebSocket, roomId: string) => {
    const player1 = rooms.get(roomId);

    if (player1 && player1.readyState === WebSocket.OPEN) {

        const player2 = ws;
        
        rooms.delete(roomId);

        player1.send(JSON.stringify({ type: 'matchFound', opponent: 'player2', color: 'white' }));
        player2.send(JSON.stringify({ type: 'matchFound', opponent: 'player1', color: 'black' }));

        player1.on('message', message => {
            if (player2.readyState === WebSocket.OPEN) {
                player2.send(message);
            }
        });

        player2.on('message', message => {
            if (player1.readyState === WebSocket.OPEN) {
                player1.send(message);
            }
        });

    } else {
        rooms.set(roomId, ws);
        ws.send(JSON.stringify({ type: 'waitingForFriend', roomId }));

        ws.on('close', () => {
            if (rooms.get(roomId) === ws) {
                rooms.delete(roomId);
            }
        });
    }
};
