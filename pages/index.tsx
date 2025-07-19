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
  const [credits, setCredits] = useState(50);
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
    if (!inputValue.trim() || credits <= 0) return;
    
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
    setInputValue("");
    setCredits(prev => prev - 1);
    setIsLoading(true);

    // Save user message to database
    if (sessionId) {
      try {
        await insertMessage({
          session_id: sessionId,
          sender: 'user',
          content: inputValue
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
    if (e.key === "Enter" && e.ctrlKey) {
      // Insert new line on Ctrl+Enter
      setInputValue(prev => prev + "\n");
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Submit on Enter (without Shift)
      e.preventDefault();
      handleSubmit(e);
    }
    // Text will automatically wrap when reaching edge due to textarea behavior
  };

  const filteredSessions = sessions.filter(session => 
    session.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    new Date(session.started_at).toLocaleDateString().includes(searchTerm)
  );
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <button 
          onClick={() => signIn()}
          className="px-6 py-3 bg-blue-600 text-white rounded-none hover:bg-blue-700 transition-colors"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar - Desktop */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-30 flex flex-col w-64 border-r border-gray-800 bg-gray-950 transition-transform duration-300 ease-in-out h-full`}>
        <div className="p-4">
          <button 
            onClick={createNewSession}
            className="w-full py-2 px-4 bg-blue-600 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <PlusIcon /> New Chat
          </button>
        </div>
        
        <div className="p-4 border-t border-gray-800">
          <input 
            type="text" 
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm text-gray-500 mb-2">Recent Sessions</h3>
          <div className="space-y-2">
            {filteredSessions.length === 0 ? (
              <div className="text-center text-gray-600 py-8">
                No sessions yet
              </div>
            ) : (
              filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left p-3 rounded-md hover:bg-gray-800 transition-colors ${
                    currentSessionId === session.id ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <div className="text-sm font-medium text-gray-200 truncate">
                    Session {session.id.slice(-8)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(session.started_at).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-800">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-gray-800 rounded-md transition-colors"
          >
            <MenuIcon />
          </button>
          
          <h1 className="text-xl font-semibold">Parental</h1>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm">
              <span className="bg-gray-800 px-3 py-1 rounded-full">
                {credits}/50 credits
              </span>
            </div>
            <button 
              onClick={() => signOut()}
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
            >
              {session.user?.name?.charAt(0)}
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="text-center max-w-md">
                <h2 className="text-2xl font-semibold mb-2">How can I help?</h2>
                <p className="text-gray-400">
                  Ask me anything about relationships, parenting, or family matters.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-3xl mx-auto">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-lg ${
                    msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-800'
                  }`}>
                    <ReactMarkdown className="prose prose-invert">
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Enhanced Input Area */}
        <div className="p-4 border-t border-gray-800 bg-gray-950">
          <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Parental..."
                rows={1}
                className="flex-1 p-6 text-xl bg-gray-800 text-white placeholder-gray-400 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{ minHeight: '60px', maxHeight: '160px' }}
                disabled={isLoading || credits <= 0}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="p-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-full transition-colors flex items-center justify-center"
                title="Send message"
              >
                <ArrowUpIcon />
              </button>
            </div>
            <div className="flex justify-center mt-2 text-sm text-gray-500">
              {credits} credits remaining
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Icon components
function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12h16M4 6h16M4 18h16" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}