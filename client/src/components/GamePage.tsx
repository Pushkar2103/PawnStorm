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

const GamePage: React.FC<GamePageProps> = ({ gameMode, roomId, onExit }) => {
  const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL as string;

  const game = useMemo(() => new Chess(), []);

  const [fen, setFen] = useState<string>(game.fen());
  const [status, setStatus] = useState("Initializing game...");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    "white"
  );
  const [isGameStarted, setIsGameStarted] = useState(false);

  const [moveFrom, setMoveFrom] = useState<Square | "">("");
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [optionSquares, setOptionSquares] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [rightClickedSquares, setRightClickedSquares] = useState<
    Record<string, React.CSSProperties>
  >({});

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
      if (game.inCheck()) {
        currentStatus += " - Check!";
      }
      setStatus(currentStatus);
    }
  }, [game]);

  // --- WebSocket setup ---
  useEffect(() => {
    if (gameMode === "pass" || gameMode === "ai") {
      setStatus("White's turn");
      setBoardOrientation("white");
      setIsGameStarted(true);
      return;
    }

    let socket: WebSocket | undefined;
    if (gameMode === "random") {
      socket = new WebSocket(`${WEBSOCKET_URL}/play-online`);
    } else if (gameMode === "friend" && roomId!=null) {
      socket = new WebSocket(`${WEBSOCKET_URL}/play-with-friend/${roomId}`);
    }

    if (socket) {
      setWs(socket);
      socket.onopen = () => console.log("WebSocket connected");
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("WebSocket message:", message);
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
            default:
              console.log("Unknown message type:", message.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
          setStatus("An error occurred. Please check the console.");
        }
      };
      socket.onclose = () =>
        setStatus("Connection lost. Please exit and try again.");
      socket.onerror = () =>
        setStatus("Connection error. Could not connect to the server.");
    }

    return () => {
      socket?.close();
    };
  }, [gameMode, roomId, game, updateGameStatus, WEBSOCKET_URL]);

  // --- AI Move ---
  const makeAiMove = useCallback(() => {
    if (game.isGameOver()) return;
    const possibleMoves = game.moves();
    const randomMove =
      possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    game.move(randomMove);
    setFen(game.fen());
    updateGameStatus();
  }, [game, updateGameStatus]);

  // --- Player Move ---
  const makeMove = useCallback(
    (move: { from: Square; to: Square; promotion?: string }) => {
      try {
        const result = game.move(move);
        if (result) {
          setFen(game.fen());
          updateGameStatus();

          if (ws) {
            ws.send(JSON.stringify({ type: "move", ...move }));
          }
          if (gameMode === "ai" && game.turn() === "b") {
            setTimeout(makeAiMove, 500);
          }
          if (gameMode === "pass") {
            setBoardOrientation(game.turn() === "w" ? "white" : "black");
          }
        }
        return result;
      } catch (e) {
        console.log("Invalid move:", e);
        return null;
      }
    },
    [game, updateGameStatus, ws, gameMode, makeAiMove]
  );

  // --- Square Click ---
  function onSquareClick({piece, square}:SquareHandlerArgs) {
    if (!isGameStarted || isGameOver) return;
    setRightClickedSquares({});

    const isMyTurn =
      gameMode === "pass" || gameMode === "ai"
        ? piece && piece.pieceType[0] === game.turn()
        : piece &&
          piece.pieceType[0] === playerColor[0] &&
          piece.pieceType[0] === game.turn();

    if (moveFrom) {
      const moves = game.moves({ square: moveFrom, verbose: true }) as Move[];
      const foundMove = moves.find(
        (m) => m.from === moveFrom && m.to === square
      );

      if (!foundMove) {
        setMoveFrom("");
        setOptionSquares({});
        if (isMyTurn) {
          showValidMoves(square as Square);
        }
        return;
      }

      // Pawn promotion
      if (
        foundMove.piece === "p" &&
        (foundMove.to[1] === "8" || foundMove.to[1] === "1")
      ) {
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

  // --- Show Valid Moves ---
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
          game.get(move.to)?.color &&
          game.get(move.to)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%",
      };
    });
    newSquares[square] = { background: "rgba(255, 255, 0, 0.4)" };
    setOptionSquares(newSquares);
  }

  // --- Piece Drop ---
  function onPieceDrop({piece, sourceSquare, targetSquare} : PieceDropHandlerArgs): boolean {
    if (!isGameStarted || isGameOver) return false;
    setMoveFrom("");
    setOptionSquares({});

    const isMyTurn = gameMode === "pass" || gameMode === "ai"
            ? piece && piece.pieceType[0] === game.turn()
            : piece &&
              piece.pieceType[0] === playerColor[0] &&
              piece.pieceType[0] === game.turn();

    if (!isMyTurn) {
      return false; // Invalid move if it's not the player's turn or piece.
    }

    const move = { from: sourceSquare as Square, to: targetSquare as Square };

    if (
      piece?.pieceType[1] === "P" && targetSquare!== null &&
      (targetSquare[1] === "8" || targetSquare[1] === "1") 
    ) {
      setMoveFrom(sourceSquare as Square);
      setMoveTo(targetSquare as Square);
      setShowPromotionDialog(true);
      return false;
    }

    const moveResult = makeMove(move);
    return !!moveResult;
  }

  // --- Promotion Dialog ---
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
              squareStyles: { ...optionSquares, ...rightClickedSquares }
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
          <h2 className="text-2xl font-bold text-center mb-4 border-b border-gray-600 pb-2">
            Game Status
          </h2>
          <div className="bg-gray-700 rounded-md p-3 text-center mb-4">
            <p
              className={`text-lg font-semibold ${
                isGameOver ? "text-red-400" : "text-green-400"
              }`}
            >
              {status}
            </p>
          </div>
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
