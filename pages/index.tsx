"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import { upsertUser, createSession, insertMessage, getSessionsForUser, getMessagesForSession } from "../lib/supabaseUtils";

const SUGGESTIONS = [
  "Relationship advice",
  "Parenting tips",
  "How to resolve conflict",
  "How to talk to my child",
];

export default function Home() {
  const { data: session, status } = useSession();
  const [context, setContext] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [hasChatted, setHasChatted] = useState(false);
  const [messages, setMessages] = useState<{ id: string; role: "user" | "assistant"; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const chatId = useRef(0);

  // Upsert user in Supabase when session is available
  useEffect(() => {
    const worldcoin_id = session?.user?.name;
    const email = typeof session?.user?.email === 'string' ? session.user.email : undefined;
    if (worldcoin_id) {
      upsertUser({ worldcoin_id, email })
        .then((user) => setUserId(user.id))
        .catch(console.error);
    }
  }, [session]);

  // Fetch sessions when userId is available
  useEffect(() => {
    if (userId) {
      getSessionsForUser(userId)
        .then((data) => setSessions(data))
        .catch(console.error);
    }
  }, [userId, sessionId]);

  // Fetch messages when a session is selected
  useEffect(() => {
    if (selectedSessionId) {
      getMessagesForSession(selectedSessionId)
        .then((msgs) => {
          setMessages(
            msgs.map((m: any) => ({
              id: m.id,
              role: m.sender,
              content: m.content,
            }))
          );
          setHasChatted(true);
          setSessionId(selectedSessionId);
        })
        .catch(console.error);
    } else {
      setMessages([]);
      setHasChatted(false);
      setSessionId(null);
    }
  }, [selectedSessionId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isProfileDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest('.profile-dropdown')) {
          setIsProfileDropdownOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileDropdownOpen]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <img
          src="/logo.png"
          alt="Parental Logo"
          className="w-12 h-12 select-none animate-pulse opacity-40"
          draggable="false"
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center justify-center flex-1">
          <img
            src="/logo.png"
            alt="Parental Logo"
            className="w-32 h-32 opacity-70 select-none mb-8"
            draggable="false"
          />
          <button
            onClick={() => signIn()}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-full transition-colors shadow-lg"
          >
            Sign in with Worldcoin
          </button>
        </div>
      </div>
    );
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !inputValue.trim()) return;
    setHasChatted(true);
    setIsLoading(true);
    
    const userMsg = {
      id: `user-${chatId.current++}`,
      role: "user" as const,
      content: inputValue,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // Create session in Supabase if not already
    let currentSessionId = sessionId;
    if (!currentSessionId && userId) {
      try {
        const sessionRow = await createSession(userId);
        setSessionId(sessionRow.id);
        currentSessionId = sessionRow.id;
      } catch (err) {
        setIsLoading(false);
        return;
      }
    }

    // Store user message in Supabase
    if (currentSessionId) {
      insertMessage({ session_id: currentSessionId, sender: "user", content: userMsg.content }).catch(console.error);
    }

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })),
          context: context || userMsg.content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMsg = {
        id: `assistant-${chatId.current++}`,
        role: "assistant" as const,
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Store AI message in Supabase
      if (currentSessionId) {
        insertMessage({ session_id: currentSessionId, sender: "ai", content: assistantMsg.content }).catch(console.error);
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        { id: `error-${chatId.current++}`, role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setSelectedSessionId(null);
    setMessages([]);
    setHasChatted(false);
    setSessionId(null);
    setContext("");
    setIsSidebarOpen(false);
  };

  const handleSessionSelect = (session: any) => {
    setSelectedSessionId(session.id);
    setIsSidebarOpen(false);
  };

  const filteredSessions = sessions.filter(session => 
    session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    new Date(session.started_at).toLocaleDateString().includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-black flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-gray-900 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-700">
            <button
              onClick={handleNewChat}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-700">
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Session History */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-gray-400 text-sm font-medium mb-3">Recent Sessions</h3>
            <div className="space-y-2">
              {filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleSessionSelect(session)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedSessionId === session.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium truncate">
                    Session {session.id.slice(0, 8)}...
                  </div>
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(session.started_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
              {filteredSessions.length === 0 && (
                <div className="text-gray-500 text-sm text-center py-8">
                  {searchTerm ? 'No sessions found' : 'No sessions yet'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <h1 className="text-white text-xl font-semibold">Parental</h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            
            {/* Profile Dropdown */}
            <div className="relative profile-dropdown">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2 p-2 text-gray-400 hover:text-white transition-colors"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {session.user?.name?.charAt(0) || 'U'}
                </div>
              </button>

              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <div className="text-white font-medium">Profile</div>
                    <div className="text-gray-400 text-sm mt-1">
                      {session.user?.name || 'User'}
                    </div>
                    {session.user?.email && (
                      <div className="text-gray-400 text-sm">
                        {session.user.email}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {!hasChatted && (
            <div className="flex flex-col items-center justify-center flex-1">
              <img
                src="/logo.png"
                alt="Parental Logo"
                className="w-32 h-32 opacity-70 select-none mb-8"
                draggable="false"
              />
            </div>
          )}

          {/* Chat Messages */}
          {hasChatted && (
            <div className="w-full max-w-4xl flex-1 flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-6 p-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-100'
                      }`}
                    >
                      <ReactMarkdown className="prose prose-invert max-w-none">
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 text-gray-100 p-4 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="w-full max-w-4xl">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-4 bg-gray-900 p-4 rounded-2xl">
              <button
                type="button"
                className="p-3 text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask anything"
                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-lg"
                disabled={isLoading}
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  DeepSearch
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Think
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}