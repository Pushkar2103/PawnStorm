import React, { useState, useEffect, useRef } from 'react';

export interface Message {
  sender: string;
  text: string;
}

interface ChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
}

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isCollapsed) {
      scrollToBottom();
    }
    if (messages.length > 0 && messages[messages.length - 1].sender === 'Opponent' && isCollapsed) {
      setHasNewMessage(true);
    }
  }, [messages, isCollapsed]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  const toggleCollapse = () => {
    if (isCollapsed) {
      setHasNewMessage(false);
    }
    setIsCollapsed(prev => !prev);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-700">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={toggleCollapse}
      >
        <div className="relative flex items-center gap-3">
          <h2 className="text-2xl font-bold">Chat</h2>
          {hasNewMessage && <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>}
        </div>
        <svg
          className={`w-6 h-6 text-white transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>

      <div
        className={`transition-all duration-500 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-[30rem] mt-4'}`}
      >
        <div className="flex flex-col h-80">
          <div className="flex-grow overflow-y-auto mb-4 bg-gray-700 rounded-md p-2 space-y-2">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-lg px-3 py-1 max-w-xs break-words ${msg.sender === 'You' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                  <span className="font-bold text-sm">{msg.sender}</span>
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-grow p-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition font-bold">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
