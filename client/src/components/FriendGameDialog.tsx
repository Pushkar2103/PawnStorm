import { useState, useEffect, useRef } from 'react';

type FriendGameDialogProps = {
  open: boolean;
  onClose: () => void;
  onGameStart: (mode: 'friend', roomId: string) => void;
};

const FriendGameDialog = ({ open, onClose, onGameStart }: FriendGameDialogProps) => {
  const [joinRoomId, setJoinRoomId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const generateRoomId = () => Math.random().toString(36).substring(2, 10).toUpperCase();

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    onGameStart('friend', newRoomId);
    onClose();
  };

  const handleJoinRoom = () => {
    const trimmedId = joinRoomId.trim();
    if (trimmedId) {
      onGameStart('friend', trimmedId);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="friend-dialog-title"
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md border border-gray-700">
        <h2 id="friend-dialog-title" className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
          Play with a Friend
        </h2>
        <div className="flex flex-col space-y-4">
          <button
            onClick={handleCreateRoom}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
          >
            Create New Room
          </button>
          <div className="flex items-center text-gray-400">
            <hr className="w-full border-gray-600" />
            <span className="px-2 font-semibold">OR</span>
            <hr className="w-full border-gray-600" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Enter Room ID to Join"
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            className="w-full bg-gray-700 border-2 border-gray-600 text-white placeholder-gray-400 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleJoinRoom}
            disabled={!joinRoomId.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none"
          >
            Join Room
          </button>
        </div>
        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white font-semibold transition duration-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FriendGameDialog;
