import { Chess, Move } from "chess.js";
import type { Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import React, { useState, useMemo, useCallback, useEffect } from "react";

interface PassAndPlayPageProps {
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
  <div className={`p-3 rounded-lg text-center w-40 ${isActive ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-200'}`}>
    <div className="text-sm font-bold">{playerName}</div>
    <div className="font-mono text-3xl font-semibold tracking-wider">{formatTime(time)}</div>
  </div>
);

const findKingSquare = (game: Chess): Square | null => {
    const board = game.board();
    const king = board.flat().find(p => p?.type === 'k' && p?.color === game.turn());
    return king ? king.square : null;
};

const PassAndPlayPage: React.FC<PassAndPlayPageProps> = ({ onExit }) => {
  const game = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState<string>(game.fen());
  const [status, setStatus] = useState("Select a time control to begin.");
  const [isGameOver, setIsGameOver] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [moveFrom, setMoveFrom] = useState<Square | "">("");
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});
  const [autoFlip, setAutoFlip] = useState(true);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [checkmateSquare, setCheckmateSquare] = useState<Square | null>(null);
  const [timeControl, setTimeControl] = useState<number | null>(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string>("null");

  const updateGameStatus = useCallback((winnerOnTime: 'white' | 'black' | null = null) => {
    if (winnerOnTime) {
      setStatus(`${winnerOnTime === 'white' ? 'White' : 'Black'} wins on time!`);
      setIsGameOver(true);
      return;
    }

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
            updateGameStatus('black');
            return 0;
          }
          return t - 1;
        });
      } else {
        setBlackTime(t => {
          if (t <= 1) {
            clearInterval(timer);
            updateGameStatus('white');
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, isGameOver, game, timeControl, updateGameStatus]);

  const makeMove = useCallback(
    (move: { from: Square; to: Square; promotion?: string }) => {
      try {
        const result = game.move(move);
        if (result) {
          setFen(game.fen());
          updateGameStatus();
          setLastMove({ from: move.from, to: move.to });
          if (autoFlip) {
            setBoardOrientation(game.turn() === "w" ? "white" : "black");
          }
        }
        return result;
      } catch {
        return null;
      }
    },
    [game, updateGameStatus, autoFlip]
  );

  function onSquareClick({ piece, square }: SquareHandlerArgs) {
    if (isGameOver || !gameStarted) return;
    setRightClickedSquares({});
    const isMyTurn = piece && piece.pieceType[0] === game.turn();
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
    if (isGameOver || !gameStarted) return false;
    setMoveFrom("");
    setOptionSquares({});
    const move = { from: sourceSquare as Square, to: targetSquare as Square };
    const piece = game.get(sourceSquare as Square);
    if (piece?.type === "p" && targetSquare && sourceSquare && (targetSquare[1] === "8" || targetSquare[1] === "1")) {
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
        styles[lastMove.from] = { ...styles[lastMove.from], backgroundColor: 'rgba(204, 212, 0, 0.4)' };
        styles[lastMove.to] = { ...styles[lastMove.to], backgroundColor: 'rgba(204, 212, 0, 0.4)' };
    }
    if (checkmateSquare) {
        styles[checkmateSquare as Square] = { ...styles[checkmateSquare as Square], backgroundColor: 'rgba(255, 0, 0, 0.5)' };
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
    setGameStarted(true);
    setStatus("White's turn");
  };

  if (!gameStarted) {
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
    <div className="flex flex-col items-center justify-center min-h-screen w-full p-2 md:p-4 bg-gray-900 text-white relative">
      <div className="w-full max-w-4xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-4">
        {timeControl !== null && <Timer time={blackTime} isActive={game.turn() === 'b'} playerName="Black" />}
        <div className="w-full max-w-sm md:max-w-md lg:max-w-lg relative">
          <Chessboard options={{ position: fen, onPieceDrop, onSquareClick, boardOrientation, squareStyle: { backgroundColor: "#a2d2ff" }, darkSquareStyle: { backgroundColor: "#0077b6" }, squareStyles }} />
          {showPromotionDialog && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex gap-3">
                {["q", "r", "b", "n"].map((p) => <button key={p} onClick={() => onPromotionPieceSelect(p)} className="w-14 h-14 flex items-center justify-center bg-gray-200 text-black font-bold text-xl rounded hover:bg-gray-300 transition">{p.toUpperCase()}</button>)}
              </div>
            </div>
          )}
        </div>
         {timeControl !== null && <Timer time={whiteTime} isActive={game.turn() === 'w'} playerName="White" />}
        <div className="w-full max-w-sm md:max-w-md lg:w-80 bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700">
          <h2 className="text-2xl font-bold text-center mb-4 border-b border-gray-600 pb-2">Game Status</h2>
          <div className="bg-gray-700 rounded-md p-3 text-center mb-4"><p className={`text-lg font-semibold ${isGameOver ? "text-red-400" : "text-green-400"}`}>{status}</p></div>
          <div className="text-center mb-4"><button onClick={() => setAutoFlip(!autoFlip)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition">{autoFlip ? "Disable Auto Flip" : "Enable Auto Flip"}</button></div>
          <div className="text-center"><button onClick={onExit} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300">Exit Game</button></div>
        </div>
      </div>
    </div>
  );
};

export default PassAndPlayPage;
