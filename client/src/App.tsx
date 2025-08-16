import { useState } from "react";
import HomePage from "./components/HomePage";
import GamePage from "./components/GamePage";

export default function App() {
  const [page, setPage] = useState<"home" | "game">("home");
  const [gameSettings, setGameSettings] = useState<{ mode: string | null; roomId: string | null }>({
    mode: null,
    roomId: null,
  });

  const handleGameStart = (mode: string, roomId: string = "") => {
    setGameSettings({ mode, roomId });
    setPage("game");
  };

  const handleExit = () => {
    setGameSettings({ mode: null, roomId: null });
    setPage("home");
  };

  return (
    <div className="bg-gray-900 min-h-screen">
      {page === "home" && <HomePage onGameStart={handleGameStart} />}
      {page === "game" && (
        <GamePage
          gameMode={gameSettings.mode}
          roomId={gameSettings.roomId}
          onExit={handleExit}
        />
      )}
    </div>
  );
}
