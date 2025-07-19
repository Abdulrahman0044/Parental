"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";

export default function ChatUI() {
  const { data: session } = useSession();
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<{id: string, role: "user"|"assistant", content: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState(50);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    
    const userMsg = {
      id: Date.now().toString(),
      role: "user" as const,
      content: inputValue
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setCredits(prev => prev - 1);
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: "Here's some helpful advice about your relationship question..."
      };
      setMessages(prev => [...prev, aiMsg]);
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

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <button 
          onClick={() => signIn()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex flex-col w-64 border-r border-gray-800 bg-gray-950">
        <div className="p-4">
          <button className="w-full py-2 px-4 bg-blue-600 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors">
            <PlusIcon /> New Chat
          </button>
        </div>
        
        <div className="p-4 border-t border-gray-800">
          <input 
            type="text" 
            placeholder="Search sessions..." 
            className="w-full bg-gray-800 p-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm text-gray-500 mb-2">Recent Sessions</h3>
          <div className="text-center text-gray-600 py-8">
            No sessions yet
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-800">
          <button className="md:hidden p-2 hover:bg-gray-800 rounded-md transition-colors">
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