import { WebSocket } from 'ws';

let waitingPlayer: WebSocket | null = null;

export const onlineGame = (ws: WebSocket) => {

    if (waitingPlayer && waitingPlayer.readyState === WebSocket.OPEN) {

        const player1 = waitingPlayer;
        const player2 = ws;

        waitingPlayer = null;

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
        waitingPlayer = ws;
        ws.send(JSON.stringify({ type: 'waitingForOpponent' }));

        ws.on('close', () => {
            if (waitingPlayer === ws) {
                waitingPlayer = null;
            }
        });
    }
};
