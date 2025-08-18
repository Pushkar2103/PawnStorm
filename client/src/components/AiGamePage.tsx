import { Chess, Move } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import React, { useState, useMemo, useCallback } from "react";

interface AiGamePageProps {
  onExit: () => void;
}

const findKingSquare = (game: Chess): Square | null => {
    const board = game.board();
    const king = board.flat().find(p => p?.type === 'k' && p?.color === game.turn());
    return king ? king.square : null;
};

const DIFFICULTY_LEVELS = {
  easy: 3,
  medium: 8,
  hard: 13,
};

const AiGamePage: React.FC<AiGamePageProps> = ({ onExit }) => {
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState<string>(game.fen());
  const [status, setStatus] = useState("Select your game options.");
  const [isGameOver, setIsGameOver] = useState(false);
  const [moveFrom, setMoveFrom] = useState<Square | "">("");
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [checkmateSquare, setCheckmateSquare] = useState<Square | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [selectedColor, setSelectedColor] = useState<'white' | 'black'>('white');

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
      } else {
        setCheckmateSquare(null);
      }
      setStatus(currentStatus);
    }
  }, [game]);

  const getAiMove = useCallback(async (currentFen: string) => {
    if (isGameOver) return;
    setStatus("Computer is thinking...");
    try {
      const depth = DIFFICULTY_LEVELS[difficulty];
      const response = await fetch(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(currentFen)}&depth=${depth}`);

      if (!response.ok) throw new Error("Failed to fetch AI move from API");

      const data = await response.json();
      
      if (data.success && data.bestmove) {
        const moveStr = data.bestmove.split(' ')[1];
        const from = moveStr.substring(0, 2) as Square;
        const to = moveStr.substring(2, 4) as Square;
        const promotion = moveStr.substring(4, 5) || undefined;

        const moveResult = game.move({ from, to, promotion });
        if (moveResult) {
          setFen(game.fen());
          setLastMove({ from, to });
          updateGameStatus();
        }
      } else {
          throw new Error(data.error || "API did not return a best move.");
      }
    } catch (error) {
      console.error("Error fetching AI move:", error);
      setStatus("Error getting computer's move.");
    }
  }, [difficulty, game, isGameOver, updateGameStatus]);

  const makeMove = useCallback(
    (move: { from: Square; to: Square; promotion?: string }) => {
      try {
        const result = game.move(move);
        if (result) {
          setFen(game.fen());
          updateGameStatus();
          setLastMove({ from: move.from, to: move.to });
          if (game.turn() !== playerColor[0]) {
            setTimeout(() => getAiMove(game.fen()), 500);
          }
        }
        return result;
      } catch {
        return null;
      }
    },
    [game, updateGameStatus, getAiMove, playerColor]
  );

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    if (isGameOver || game.turn() !== playerColor[0]) return;
    setRightClickedSquares({});
    if (moveFrom) {
      const moves = game.moves({ square: moveFrom, verbose: true }) as Move[];
      const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);
      if (!foundMove) {
        setMoveFrom("");
        setOptionSquares({});
        if (piece && piece.pieceType[0] === playerColor[0]) {
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
      if (piece && piece.pieceType[0] === playerColor[0]) {
        showValidMoves(square as Square);
      }
    }
  }

  function showValidMoves(square: Square) {
    const moves = game.moves({ square, verbose: true }) as Move[];
    if (moves.length === 0) return;

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

  function onPieceDrop({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean {
    if (isGameOver || game.turn() !== playerColor[0]) return false;
    setMoveFrom("");
    setOptionSquares({});
    
    const move = { from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' };
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

  const handleStartGame = (color: "white" | "black") => {
    setPlayerColor(color);
    setBoardOrientation(color);
    setGameStarted(true);
    updateGameStatus();
    
    if (color === 'black') {
      setTimeout(() => getAiMove(game.fen()), 500);
    }
  };

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = { ...optionSquares, ...rightClickedSquares };
    if (lastMove) {
        styles[lastMove.from] = { ...styles[lastMove.from], backgroundColor: 'rgba(204, 212, 0, 0.4)' };
        styles[lastMove.to] = { ...styles[lastMove.to], backgroundColor: 'rgba(204, 212, 0, 0.4)' };
    }
    if (checkmateSquare) {
        styles[checkmateSquare as Square] = { ...styles[checkmateSquare as Square], backgroundColor: 'rgba(255, 0, 0, 0.5)' };
    }
    return styles;
  }, [optionSquares, rightClickedSquares, lastMove, checkmateSquare]);

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full p-4 bg-gray-900 text-white">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 w-full max-w-md">
          <h2 className="text-3xl font-bold text-center mb-6">Play Against The Computer</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-center mb-3">Difficulty</h3>
            <div className="flex justify-center gap-3">
              {(Object.keys(DIFFICULTY_LEVELS) as Array<keyof typeof DIFFICULTY_LEVELS>).map(level => (
                <button 
                  key={level} 
                  onClick={() => setDifficulty(level)}
                  className={`px-4 py-2 rounded-lg transition font-semibold capitalize w-28 ${difficulty === level ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-center mb-3">Play As</h3>
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setSelectedColor('white')} 
                className={`px-4 py-2 rounded-lg transition font-semibold w-28 ${selectedColor === 'white' ? 'bg-white text-black ring-2 ring-blue-500' : 'bg-gray-200 text-black hover:bg-white'}`}
              >
                White
              </button>
              <button 
                onClick={() => setSelectedColor('black')} 
                className={`px-4 py-2 rounded-lg transition font-semibold w-28 text-white ${selectedColor === 'black' ? 'bg-gray-900 ring-2 ring-blue-500 border border-gray-400' : 'bg-gray-800 border border-gray-600 hover:bg-black'}`}
              >
                Black
              </button>
            </div>
          </div>
          
          <button 
            onClick={() => handleStartGame(selectedColor)} 
            className="w-full mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 text-lg"
          >
            Start Game
          </button>
          
          <button onClick={onExit} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Back to Menu</button>
        </div>
      </div>
    );
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
              squareStyles,
            }}
          />
          {showPromotionDialog && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex gap-3">
                {["q", "r", "b", "n"].map((p) => (
                  <button
                    key={p}
                    onClick={() => onPromotionPieceSelect(p)}
                    className="w-14 h-14 flex items-center justify-center bg-gray-200 text-black font-bold text-xl rounded hover:bg-gray-300 transition"
                  >
                    {p.toUpperCase()}
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

export default AiGamePage;
