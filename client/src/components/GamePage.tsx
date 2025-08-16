import { Chess, Move } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import React, { useState, useEffect, useMemo, useCallback } from "react";

interface GamePageProps {
  gameMode: string | null;
  roomId?: string | null;
  onExit: () => void;
}

function evaluateBoard(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? -9999 : 9999;
  }
  if (game.isDraw()) {
    return 0;
  }

  let score = 0;
  const board = game.board();
  const pieceValues: Record<string, number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000,
  };

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const value = pieceValues[piece.type];
        score += piece.color === "w" ? value : -value;
      }
    }
  }

  return score;
}


function minimax(game: Chess, depth: number, isMax: boolean, alpha: number, beta: number): number {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game);
  }
  const moves = game.moves({ verbose: true });
  if (isMax) {
    let maxEval = -Infinity;
    for (const move of moves) {
      game.move(move);
      const evalScore = minimax(game, depth - 1, false, alpha, beta);
      game.undo();
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      game.move(move);
      const evalScore = minimax(game, depth - 1, true, alpha, beta);
      game.undo();
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

const GamePage: React.FC<GamePageProps> = ({ gameMode, roomId, onExit }) => {
  const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL as string;
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState<string>(game.fen());
  const [status, setStatus] = useState("Initializing game...");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [moveFrom, setMoveFrom] = useState<Square | "">("");
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});
  const [aiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [autoFlip, setAutoFlip] = useState(true);

  const updateGameStatus = useCallback(() => {
    if (game.isCheckmate()) {
      setStatus(`Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins.`);
      setIsGameOver(true);
    } else if (game.isDraw()) {
      setStatus("It's a Draw!");
      setIsGameOver(true);
    } else {
      const turn = game.turn() === "w" ? "White" : "Black";
      let currentStatus = `${turn}'s turn`;
      if (game.inCheck()) currentStatus += " - Check!";
      setStatus(currentStatus);
    }
  }, [game]);

  useEffect(() => {
    if (gameMode === "pass" || gameMode === "ai") {
      setStatus("White's turn");
      setBoardOrientation("white");
      setIsGameStarted(true);
      return;
    }
    const didInit = (window as any).__pawnstorm_ws_init__ || { current: false };
    if (!("__pawnstorm_ws_init__" in window)) (window as any).__pawnstorm_ws_init__ = didInit;
    if (didInit.current) return;
    didInit.current = true;
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
      if (gameMode === "random") socket.send(JSON.stringify({ type: "queueRandom", clientId }));
      else if (gameMode === "friend" && roomId != null) socket.send(JSON.stringify({ type: "joinRoom", roomId, clientId }));
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case "waitingForOpponent":
            setStatus("Waiting for an opponent...");
            break;
          case "waitingForFriend":
            setStatus(`Waiting for a friend. Share Room ID: ${roomId}`);
            break;
          case "matchFound": {
            const color: "white" | "black" = message.color;
            setPlayerColor(color);
            setBoardOrientation(color);
            setStatus(`Match found! You are ${color}.`);
            setIsGameStarted(true);
            break;
          }
          case "move":
            if (message.from && message.to) {
              const moveResult = game.move({
                from: message.from,
                to: message.to,
                promotion: message.promotion,
              });
              if (moveResult) {
                setFen(game.fen());
                updateGameStatus();
              }
            }
            break;
          case "opponentDisconnected":
          case "friendLeft":
            setStatus("Opponent disconnected.");
            setIsGameOver(true);
            break;
        }
      } catch (error) {}
    };
    socket.onclose = () => setStatus("Connection lost. Please exit and try again.");
    socket.onerror = () => setStatus("Connection error. Could not connect to the server.");
    return () => {
      socket?.close();
      didInit.current = false;
    };
  }, [WEBSOCKET_URL, gameMode, roomId, game, updateGameStatus]);

  const makeAiMove = useCallback(() => {
    if (game.isGameOver()) return;
    let chosenMove: any;
    const moves = game.moves({ verbose: true });
    if (aiDifficulty === "easy") {
      chosenMove = moves[Math.floor(Math.random() * moves.length)];
    } else {
      const depth = aiDifficulty === "medium" ? 2 : 3;
      let bestEval = -Infinity;
      for (const move of moves) {
        game.move(move);
        const evalScore = minimax(game, depth - 1, false, -Infinity, Infinity);
        game.undo();
        if (evalScore > bestEval) {
          bestEval = evalScore;
          chosenMove = move;
        }
      }
    }
    if (chosenMove) {
      game.move(chosenMove);
      setFen(game.fen());
      updateGameStatus();
    }
  }, [game, updateGameStatus, aiDifficulty]);

  const makeMove = useCallback(
    (move: { from: Square; to: Square; promotion?: string }) => {
      try {
        const result = game.move(move);
        if (result) {
          setFen(game.fen());
          updateGameStatus();
          if (ws) ws.send(JSON.stringify({ type: "move", ...move }));
          if (gameMode === "ai" && game.turn() === "b") setTimeout(makeAiMove, 500);
          if (gameMode === "pass" && autoFlip) setBoardOrientation(game.turn() === "w" ? "white" : "black");
        }
        return result;
      } catch {
        return null;
      }
    },
    [game, updateGameStatus, ws, gameMode, makeAiMove, autoFlip]
  );

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    if (!isGameStarted || isGameOver) return;
    setRightClickedSquares({});
    const isMyTurn =
      gameMode === "pass" || gameMode === "ai"
        ? piece && piece.pieceType[0] === game.turn()
        : piece && piece.pieceType[0] === playerColor[0] && piece.pieceType[0] === game.turn();
    if (moveFrom) {
      const moves = game.moves({ square: moveFrom, verbose: true }) as Move[];
      const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);
      if (!foundMove) {
        setMoveFrom("");
        setOptionSquares({});
        if (isMyTurn) {
          showValidMoves(square as Square);
        }
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
      if (isMyTurn) {
        showValidMoves(square as Square);
      }
    }
  }

  function showValidMoves(square: Square) {
    const moves = game.moves({ square, verbose: true }) as Move[];
    if (moves.length === 0) {
      return;
    }
    setMoveFrom(square);
    const newSquares: Record<string, React.CSSProperties> = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to)?.color && game.get(move.to)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
    setOptionSquares(newSquares);
  }

  function onPieceDrop({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (!isGameStarted || isGameOver) return false;
    setMoveFrom("");
    setOptionSquares({});
    const isMyTurn =
      gameMode === "pass" || gameMode === "ai"
        ? piece && piece.pieceType[0] === game.turn()
        : piece && piece.pieceType[0] === playerColor[0] && piece.pieceType[0] === game.turn();
    if (!isMyTurn) {
      return false;
    }
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
      moveResult = makeMove({
        from: moveFrom as Square,
        to: moveTo as Square,
        promotion: piece.toLowerCase(),
      });
    }
    setMoveFrom("");
    setMoveTo(null);
    setShowPromotionDialog(false);
    setOptionSquares({});
    return !!moveResult;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-2 md:p-4 bg-gray-900 text-white relative">
      <div className="w-full max-w-4xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-4">
        <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative">
          <Chessboard
            options={{
              position: fen,
              onPieceDrop: onPieceDrop,
              onSquareClick: onSquareClick,
              boardOrientation: boardOrientation,
              squareStyle: { backgroundColor: "#f0d9b5" },
              darkSquareStyle: { backgroundColor: "#b58863" },
              squareStyles: { ...optionSquares, ...rightClickedSquares },
            }}
          />
          {showPromotionDialog && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex gap-3">
                {["q", "r", "b", "n"].map((piece) => (
                  <button
                    key={piece}
                    onClick={() => onPromotionPieceSelect(piece)}
                    className="w-14 h-14 flex items-center justify-center bg-gray-200 text-black font-bold text-xl rounded hover:bg-gray-300 transition"
                  >
                    {piece.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="w-full max-w-sm md:max-w-md lg:w-80 bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-center mb-4 border-b border-gray-600 pb-2">Game Status</h2>
          <div className="bg-gray-700 rounded-md p-3 text-center mb-4">
            <p className={`text-lg font-semibold ${isGameOver ? "text-red-400" : "text-green-400"}`}>{status}</p>
          </div>
          {gameMode === "pass" && (
            <div className="text-center mb-4">
              <button
                onClick={() => setAutoFlip(!autoFlip)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
              >
                {autoFlip ? "Disable Auto Flip" : "Enable Auto Flip"}
              </button>
            </div>
          )}
          <div className="text-center">
            <button
              onClick={onExit}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
            >
              Exit Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
