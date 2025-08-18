import { Chess, Move } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import PassAndPlayPage from "./PassAndPlayPage";
import AiGamePage from "./AiGamePage";
import Chat from './Chat';
import type { Message } from './Chat';


interface GamePageProps {
  gameMode: string | null;
  roomId?: string | null;
  onExit: () => void;
}

const formatTime = (timeInSeconds: number): string => {
  if (timeInSeconds < 0) return "0:00";
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
};

interface TimerProps {
  time: number;
  isActive: boolean;
  playerName: string;
}

const Timer: React.FC<TimerProps> = ({ time, isActive, playerName }) => (
  <div className={`p-3 rounded-lg text-center w-48 ${isActive ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-200'}`}>
    <div className="text-sm font-bold">{playerName}</div>
    <div className="font-mono text-3xl font-semibold tracking-wider">{formatTime(time)}</div>
  </div>
);

const findKingSquare = (game: Chess): Square | null => {
    const board = game.board();
    const king = board.flat().find(p => p?.type === 'k' && p?.color === game.turn());
    return king ? king.square : null;
};

const GamePage: React.FC<GamePageProps> = ({ gameMode, roomId, onExit }) => {
  if (gameMode === "ai") {
    return <AiGamePage onExit={onExit} />;
  }
  if (gameMode === "pass") {
    return <PassAndPlayPage onExit={onExit} />;
  }

  const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL;
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState<string>(game.fen());
  const [status, setStatus] = useState("Initializing game...");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [moveFrom, setMoveFrom] = useState<Square | "">("");
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [checkmateSquare, setCheckmateSquare] = useState<Square | null>(null);
  const [timeControl, setTimeControl] = useState<number | null>(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("5");
  const [showTimeSelection, setShowTimeSelection] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const reconnectAttempt = useRef(0);
  const maxReconnectAttempts = 5;

  const updateGameStatus = useCallback(() => {
    if (game.isCheckmate()) {
      setStatus(`Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins.`);
      setIsGameOver(true);
      setCheckmateSquare(findKingSquare(game));
    } else if (game.isDraw()) {
      setStatus("It's a Draw!");
      setIsGameOver(true);
    } else {
      const turn = game.turn() === "w" ? "White" : "Black";
      let currentStatus = `${turn}'s turn`;
      if (game.inCheck()) {
        currentStatus += " - Check!";
        setCheckmateSquare(findKingSquare(game));
      }
      else  setCheckmateSquare(null);
      setStatus(currentStatus);
    }
  }, [game]);

  useEffect(() => {
    if (!gameStarted || isGameOver || timeControl === null) return;

    const timer = setInterval(() => {
      if (game.turn() === 'w') {
        setWhiteTime(t => {
          if (t <= 1) {
            clearInterval(timer);
            updateGameStatus();
            if (ws && playerColor === 'white') ws.send(JSON.stringify({ type: 'timeout' }));
            return 0;
          }
          return t - 1;
        });
      } else {
        setBlackTime(t => {
          if (t <= 1) {
            clearInterval(timer);
            updateGameStatus();
            if (ws && playerColor === 'black') ws.send(JSON.stringify({ type: 'timeout' }));
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, isGameOver, game, timeControl, updateGameStatus, ws, playerColor]);

  const connect = useCallback(() => {
    let clientId = sessionStorage.getItem("pawnstorm_client_id");
    if (!clientId) {
      clientId = crypto.randomUUID();
      sessionStorage.setItem("pawnstorm_client_id", clientId);
    }
    const base = WEBSOCKET_URL;
    let url: string | undefined;
    if (gameMode === "random") {
      url = `${base}/play-online?cid=${encodeURIComponent(clientId)}`;
    } else if (gameMode === "friend" && roomId != null) {
      url = `${base}/play-with-friend/${roomId}?cid=${encodeURIComponent(clientId)}`;
    }
    if (!url) return;

    const socket = new WebSocket(url);
    setWs(socket);

    socket.onopen = () => {
      reconnectAttempt.current = 0; // Reset on successful connection
      if (gameMode === "random") socket.send(JSON.stringify({ type: "queueRandom", clientId }));
      else if (gameMode === "friend" && roomId != null) socket.send(JSON.stringify({ type: "joinRoom", roomId, clientId }));
      if (gameStarted) {
        updateGameStatus(); // Restore status on reconnect
      } else {
        setStatus("Connected. Initializing game...");
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "waitingForOpponent": setStatus("Waiting for an opponent..."); break;
          case "waitingForFriend": setStatus(`Waiting for a friend. Share Room ID: ${roomId}`); break;
          case "matchFound": {
            const color: "white" | "black" = message.color;
            setPlayerColor(color);
            setBoardOrientation(color);
            if (message.isSetter === true || (message.isSetter === undefined && color === 'white')) {
              setShowTimeSelection(true);
              setStatus("Please select a time control.");
            } else {
              setStatus("Opponent is choosing the time control...");
            }
            break;
          }
          case "startGame": {
            const time = message.timeControl;
            setTimeControl(time);
            if (time !== null) {
              setWhiteTime(time);
              setBlackTime(time);
            }
            setShowTimeSelection(false);
            setGameStarted(true);
            updateGameStatus();
            break;
          }
          case "move":
            if (message.from && message.to) {
              const moveResult = game.move({ from: message.from, to: message.to, promotion: message.promotion });
              if (moveResult) {
                setFen(game.fen());
                updateGameStatus();
                setLastMove({ from: message.from, to: message.to });
              }
            }
            break;
          case "chatMessage":
            setMessages(prev => [...prev, { sender: "Opponent", text: message.text }]);
            break;
          case "gameOverOnTime":
            updateGameStatus();
            break;
          case "opponentDisconnected":
          case "friendLeft":
            setStatus("Opponent disconnected.");
            setIsGameOver(true);
            break;
        }
      } catch (error) {}
    };

    socket.onclose = () => {
      if (reconnectAttempt.current < maxReconnectAttempts) {
        const delay = Math.pow(2, reconnectAttempt.current) * 1000;
        setStatus(`Connection lost. Reconnecting in ${delay / 1000}s...`);
        setTimeout(() => {
          reconnectAttempt.current++;
          connect();
        }, delay);
      } else {
        setStatus("Connection lost. Please exit and try again.");
      }
    };

    socket.onerror = () => {
      setStatus("Connection error. Could not connect to the server.");
      socket.close(); // Trigger onclose for reconnection logic
    };

    return () => {
      socket?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WEBSOCKET_URL, gameMode, roomId, game, updateGameStatus]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);


  const handleSendMessage = (message: string) => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'chatMessage', text: message }));
      setMessages(prev => [...prev, { sender: 'You', text: message }]);
    }
  };

  const makeMove = useCallback(
    (move: { from: Square; to: Square; promotion?: string }) => {
      try {
        const result = game.move(move);
        if (result) {
          setFen(game.fen());
          updateGameStatus();
          setLastMove({ from: move.from, to: move.to });
          if (ws) ws.send(JSON.stringify({ type: "move", ...move }));
        }
        return result;
      } catch { return null; }
    },
    [game, updateGameStatus, ws]
  );

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    if (!gameStarted || isGameOver) return;
    setRightClickedSquares({});
    const isMyTurn = piece && piece.pieceType[0] === playerColor[0] && piece.pieceType[0] === game.turn();
    if (moveFrom) {
      const moves = game.moves({ square: moveFrom, verbose: true }) as Move[];
      const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);
      if (!foundMove) {
        setMoveFrom("");
        setOptionSquares({});
        if (isMyTurn) showValidMoves(square as Square);
        return;
      }
      if (foundMove.piece === "p" && (foundMove.to[1] === "8" || foundMove.to[1] === "1")) {
        setMoveTo(square as Square);
        setShowPromotionDialog(true);
        return;
      }
      const moveResult = makeMove({ from: moveFrom as Square, to: square as Square });
      if (moveResult) {
        setMoveFrom("");
        setOptionSquares({});
      }
    } else {
      if (isMyTurn) showValidMoves(square as Square);
    }
  }

  function showValidMoves(square: Square) {
    const moves = game.moves({ square, verbose: true }) as Move[];
    if (moves.length === 0) return;
    setMoveFrom(square);
    const newSquares: Record<string, React.CSSProperties> = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background: game.get(move.to)?.color && game.get(move.to)?.color !== game.get(square)?.color ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)" : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
    setOptionSquares(newSquares);
  }

  function onPieceDrop({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!gameStarted || isGameOver) return false;
    setMoveFrom("");
    setOptionSquares({});
    const isMyTurn = piece && piece.pieceType[0] === playerColor[0] && piece.pieceType[0] === game.turn();
    if (!isMyTurn) return false;
    const move = { from: sourceSquare as Square, to: targetSquare as Square };
    if (piece?.pieceType[1] === "P" && targetSquare !== null && (targetSquare[1] === "8" || targetSquare[1] === "1")) {
      setMoveFrom(sourceSquare as Square);
      setMoveTo(targetSquare as Square);
      setShowPromotionDialog(true);
      return false;
    }
    const moveResult = makeMove(move);
    return !!moveResult;
  }

  function onPromotionPieceSelect(piece: string) {
    let moveResult = null;
    if (piece) {
      moveResult = makeMove({ from: moveFrom as Square, to: moveTo as Square, promotion: piece.toLowerCase() });
    }
    setMoveFrom("");
    setMoveTo(null);
    setShowPromotionDialog(false);
    setOptionSquares({});
    return !!moveResult;
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = { ...optionSquares, ...rightClickedSquares };
    if (lastMove) {
        styles[lastMove.from] = { ...styles[lastMove.from], backgroundColor: 'rgba(204, 222, 0, 0.4)' };
        styles[lastMove.to] = { ...styles[lastMove.to], backgroundColor: 'rgba(204, 222, 0, 0.4)' };
    }
    if (checkmateSquare) {
        styles[checkmateSquare] = { ...styles[checkmateSquare], backgroundColor: 'rgba(255, 0, 0, 0.5)' };
    }
    return styles;
  }, [optionSquares, rightClickedSquares, lastMove, checkmateSquare]);

  const handleTimeSelection = () => {
    const timeInMinutes = selectedTime === "null" ? null : parseInt(selectedTime, 10);
    const timeInSeconds = timeInMinutes ? timeInMinutes * 60 : null;
    
    setTimeControl(timeInSeconds);
    if (timeInSeconds !== null) {
      setWhiteTime(timeInSeconds);
      setBlackTime(timeInSeconds);
    }
    setShowTimeSelection(false);
    setGameStarted(true);
    updateGameStatus();

    if (ws) {
      ws.send(JSON.stringify({ type: 'startGame', timeControl: timeInSeconds }));
    }
  };

  if (showTimeSelection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-900 text-white">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 w-full max-w-xs">
          <h2 className="text-3xl font-bold text-center mb-6">Choose Time Control</h2>
          <div className="flex flex-col gap-4">
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1">1 Minute</option>
              <option value="2">2 Minutes</option>
              <option value="5">5 Minutes</option>
              <option value="10">10 Minutes</option>
              <option value="null">No Time Limit</option>
            </select>
            <button onClick={handleTimeSelection} className="p-3 bg-green-600 hover:bg-green-700 rounded-lg transition font-bold">Start Game</button>
          </div>
           <button onClick={onExit} className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Back to Menu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full p-2 md:p-4 bg-gray-900 text-white">
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-start justify-center gap-6">

        <div className="w-full lg:w-2/3 order-1 flex flex-col items-center gap-4">
          <div className="w-full flex justify-center items-center gap-4">
            {timeControl !== null && <Timer time={playerColor === 'white' ? blackTime : whiteTime} isActive={game.turn() !== playerColor[0]} playerName="Opponent" />}
            {timeControl !== null && <Timer time={playerColor === 'white' ? whiteTime : blackTime} isActive={game.turn() === playerColor[0]} playerName="You" />}
          </div>
          <div className="w-full max-w-lg mx-auto relative">
            <Chessboard options={{ position: fen, onPieceDrop, onSquareClick, boardOrientation, squareStyle: { backgroundColor: "#a2d2ff" }, darkSquareStyle: { backgroundColor: "#0077b6" }, squareStyles }} />
            {showPromotionDialog && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex gap-3">
                  {["q", "r", "b", "n"].map((p) => <button key={p} onClick={() => onPromotionPieceSelect(p)} className="w-14 h-14 flex items-center justify-center bg-gray-200 text-black font-bold text-xl rounded hover:bg-gray-300 transition">{p.toUpperCase()}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-1/3 md:w-[35rem] xs-w-full order-2 flex flex-col gap-6 mx-auto">
          <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700 flex flex-col">
            <h2 className="text-2xl font-bold text-center mb-4 border-b border-gray-600 pb-2">Game Status</h2>
            <div className="bg-gray-700 rounded-md p-3 text-center mb-4">
              <p className={`text-lg font-semibold ${isGameOver ? "text-red-400" : "text-green-400"}`}>{status}</p>
            </div>
            <div className="text-center mt-auto pt-4">
              <button onClick={onExit} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Exit Game</button>
            </div>
          </div>
          <Chat messages={messages} onSendMessage={handleSendMessage} />
        </div>

      </div>
    </div>
  );
};

export default GamePage;
