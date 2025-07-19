"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import { upsertUser, createSession, getSessionsForUser, getMessagesForSession, insertMessage } from "../lib/supabaseUtils";

export default function ChatUI() {
  const { data: session } = useSession();
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<{id: string, role: "user"|"assistant", content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize user and load sessions
  useEffect(() => {
    if (session?.user) {
      initializeUser();
    }
  }, [session]);

  const initializeUser = async () => {
    try {
      const userData = await upsertUser({
        worldcoin_id: session?.user?.id || '',
        email: session?.user?.email || undefined
      });
      setUser(userData);
      loadSessions(userData.id);
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  };

  const loadSessions = async (userId: string) => {
    try {
      const userSessions = await getSessionsForUser(userId);
      setSessions(userSessions);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const createNewSession = async () => {
    if (!user) return;
    
    try {
      const newSession = await createSession(user.id);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      setSessions(prev => [newSession, ...prev]);
      setSidebarOpen(false);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const sessionMessages = await getMessagesForSession(sessionId);
      const formattedMessages = sessionMessages.map(msg => ({
        id: msg.id,
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      setMessages(formattedMessages);
      setCurrentSessionId(sessionId);
      setSidebarOpen(false);
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    // Create new session if none exists
    let sessionId = currentSessionId;
    if (!sessionId && user) {
      const newSession = await createSession(user.id);
      sessionId = newSession.id;
      setCurrentSessionId(sessionId);
      setSessions(prev => [newSession, ...prev]);
    }
    
    const userMsg = {
      id: Date.now().toString(),
      role: "user" as const,
      content: inputValue
    };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);

    // Save user message to database
    if (sessionId) {
      try {
        await insertMessage({
          session_id: sessionId,
          sender: 'user',
          content: currentInput
        });
      } catch (error) {
        console.error('Error saving user message:', error);
      }
    }

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          })),
          data: { context: '' }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: ''
      };
      setMessages(prev => [...prev, aiMsg]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          aiContent += chunk;
          
          setMessages(prev => 
            prev.map(msg => 
              msg.id === aiMsg.id 
                ? { ...msg, content: aiContent }
                : msg
            )
          );
        }
      }

      // Save AI response to database
      if (sessionId && aiContent) {
        try {
          await insertMessage({
            session_id: sessionId,
            sender: 'ai',
            content: aiContent
          });
        } catch (error) {
          console.error('Error saving AI message:', error);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "Sorry, I'm having trouble responding right now. Please try again."
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const filteredSessions = sessions.filter(session => 
    session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    new Date(session.started_at).toLocaleDateString().includes(searchTerm)
  );

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-8">
            <img src="/logo.png" alt="Parental" className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Welcome to Parental</h1>
            <p className="text-gray-600">Sign in to start your conversation</p>
          </div>
          <button 
            onClick={() => signIn()}
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            Sign in with Worldcoin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative z-30 flex flex-col w-64 bg-gray-50 border-r border-gray-200 transition-transform duration-300 ease-in-out h-full`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New chat
          </button>
        </div>
        
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search chats"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {filteredSessions.length === 0 ? (
              <div className="text-center text-gray-500 py-8 text-sm">
                No conversations yet
              </div>
            ) : (
              filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors group ${
                    currentSessionId === session.id ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        Chat {session.id.slice(-8)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(session.started_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* User Menu */}
        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
              {session.user?.name?.charAt(0) || 'U'}
            </div>
            <span className="flex-1 text-left truncate">{session.user?.name || 'User'}</span>
            <LogoutIcon className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Parental</h1>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="text-center max-w-md">
                <img src="/logo.png" alt="Parental" className="w-12 h-12 mx-auto mb-4 opacity-60" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">What can I help with?</h2>
                <p className="text-gray-600">
                  Ask me anything about relationships, parenting, or family matters.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6">
              <div className="space-y-6">
                {messages.map(msg => (
                  <div key={msg.id} className="group">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        {msg.role === 'user' ? (
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {session.user?.name?.charAt(0) || 'U'}
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                            <img src="/logo.png" alt="AI" className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {msg.role === 'user' ? (session.user?.name || 'You') : 'Parental'}
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-800">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="group">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                          <img src="/logo.png" alt="AI" className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 mb-1">Parental</div>
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Parental..."
                rows={1}
                className="w-full pr-12 pl-4 py-3 text-gray-900 placeholder-gray-500 bg-gray-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ minHeight: '48px', maxHeight: '200px' }}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 bottom-2 p-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon components
function MenuIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function PlusIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function MessageIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SendIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function LogoutIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}