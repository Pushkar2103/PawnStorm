import { useState } from 'react'
import FriendGameDialog from './FriendGameDialog'

const KingIcon = ({ color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5C7.03 5 3 9.03 3 14s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
    <path d="M12 2v3M21.17 4.83l-2.12 2.12M4.83 4.83l2.12 2.12" />
  </svg>
)

const UsersIcon = ({ color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M20 8v6M23 11h-6" />
  </svg>
)

const CpuIcon = ({ color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <rect x="9" y="9" width="6" height="6" />
    <line x1="9" y1="1" x2="9" y2="4" />
    <line x1="15" y1="1" x2="15" y2="4" />
    <line x1="9" y1="20" x2="9" y2="23" />
    <line x1="15" y1="20" x2="15" y2="23" />
    <line x1="20" y1="9" x2="23" y2="9" />
    <line x1="20" y1="14" x2="23" y2="14" />
    <line x1="1" y1="9" x2="4" y2="9" />
    <line x1="1" y1="14" x2="4" y2="14" />
  </svg>
)

const RepeatIcon = ({ color = 'currentColor' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)

const colorClasses: Record<string, { border: string; hoverBg: string }> = {
  blue: { border: 'hover:border-blue-500', hoverBg: 'group-hover:bg-blue-500/20' },
  purple: { border: 'hover:border-purple-500', hoverBg: 'group-hover:bg-purple-500/20' },
  pink: { border: 'hover:border-pink-500', hoverBg: 'group-hover:bg-pink-500/20' },
  lime: { border: 'hover:border-lime-500', hoverBg: 'group-hover:bg-lime-500/20' },
}

const HomePage = ({ onGameStart }: { onGameStart: (mode: string, roomId?: string|null, difficulty?: string) => void }) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)

  const menuOptions = [
    { title: 'Play Random Player', mode: 'random', icon: <KingIcon color="#3b82f6" />, color: 'blue' },
    { title: 'Play with a Friend', mode: 'friend', icon: <UsersIcon color="#a855f7" />, color: 'purple' },
    { title: 'Play with AI', mode: 'ai', icon: <CpuIcon color="#ec4899" />, color: 'pink' },
    { title: 'Pass and Play', mode: 'pass', icon: <RepeatIcon color="#84cc16" />, color: 'lime' },
  ]

  const handleMenuClick = (mode: string) => {
    if (mode === 'friend') {
      setDialogOpen(true)
    } else if (mode === 'ai') {
      setAiDialogOpen(true)
    } else {
      onGameStart(mode)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-gray-900 text-white">
      <header className="mb-10">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
          PawnStorm ♟️
        </h1>
        <p className="text-gray-400 mt-2 text-lg">The ultimate chess showdown</p>
      </header>

      <main className="w-full max-w-sm">
        <div className="grid grid-cols-1 gap-4">
          {menuOptions.map((opt) => {
            const { border, hoverBg } = colorClasses[opt.color]
            return (
              <button
                key={opt.mode}
                onClick={() => handleMenuClick(opt.mode)}
                className={`group flex items-center justify-between w-full p-5 bg-gray-800 rounded-xl border border-gray-700 hover:bg-gray-700 ${border} transition-all duration-300 transform hover:-translate-y-1`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 bg-gray-700 rounded-lg transition-colors duration-300 ${hoverBg}`}>
                    {opt.icon}
                  </div>
                  <span className="text-lg font-semibold text-white">{opt.title}</span>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 group-hover:text-white transition-transform duration-300 transform group-hover:translate-x-1">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            )
          })}
        </div>
      </main>

      {aiDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-80">
            <h2 className="text-xl font-bold mb-4">Select AI Difficulty</h2>
            <div className="space-y-2">
              {['easy', 'medium', 'hard'].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setAiDialogOpen(false)
                    onGameStart('ai', null, level)
                  }}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAiDialogOpen(false)}
              className="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <FriendGameDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onGameStart={onGameStart}
      />
    </div>
  )
}

export default HomePage
