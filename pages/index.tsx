"use client";
import { useChat } from "ai/react";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Relationship advice",
  "Parenting tips",
  "How to resolve conflict",
  "How to talk to my child",
];

export default function Home() {
  const { data: session, status } = useSession();
  const { messages, input, handleInputChange, handleSubmit } = useChat({ api: "/api/chatbot" });
  const [context, setContext] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [hasChatted, setHasChatted] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <img
          src="/logo.png"
          alt="Parental Logo"
          className="w-20 h-20 select-none animate-pulse opacity-70"
          draggable="false"
        />
      </div>
    );
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (messages.length === 0 && !context) {
      setContext(inputValue);
    }
    setHasChatted(true);
    await handleSubmit(e, { data: { context: context || inputValue } });
    setInputValue("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    if (session) {
      setTimeout(() => {
        document.getElementById("chat-input")?.focus();
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between p-4">
      {/* Logo */}
      <div className="flex flex-col items-center justify-center flex-1">
        <img
          src="/logo.png"
          alt="Parental Logo"
          className="w-32 h-32 opacity-70 select-none"
          draggable="false"
          style={{ filter: "opacity(70%)" }}
        />
      </div>

      {/* Mode Buttons */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <div className="flex gap-2">
          <button className="bg-gray-800 text-gray-200 px-4 py-2 rounded-full hover:bg-gray-700 text-sm">
            Latest news
          </button>
          <button className="bg-gray-800 text-gray-200 px-4 py-2 rounded-full hover:bg-gray-700 text-sm">
            Create images
          </button>
          <button className="bg-gray-800 text-gray-200 px-4 py-2 rounded-full hover:bg-gray-700 text-sm">
            Cartoon style
          </button>
        </div>
        <div className="flex gap-2">
          <button className="bg-gray-800 text-gray-200 px-4 py-2 rounded-full hover:bg-gray-700 text-sm">
            DeepSearch
          </button>
          <button className="bg-gray-800 text-gray-200 px-4 py-2 rounded-full hover:bg-gray-700 text-sm">
            Think
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="w-full max-w-2xl flex-1 flex flex-col justify-end mx-auto">
        {/* Suggestions (only if not chatted yet) */}
        {!hasChatted && (
          <div className="flex flex-wrap gap-2 justify-center mb-6 px-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestionClick(s)}
                className="bg-gray-800 text-gray-200 px-4 py-2 rounded-full hover:bg-blue-700 hover:text-white transition-colors text-sm shadow"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {/* Chat history (only after chatting) */}
        {hasChatted && (
          <div className="flex flex-col h-96 overflow-y-auto bg-gray-900 p-4 rounded-md space-y-4 mb-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-lg max-w-[80%] ${
                  m.role === "user" ? "bg-blue-900 text-white self-end" : "bg-gray-700 text-gray-100 self-start"
                }`}
              >
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleFormSubmit}
        className="w-full max-w-2xl mx-auto flex items-center gap-2 bg-gray-950 px-4 py-3 border-t border-gray-800"
        style={{ position: "sticky", bottom: 0 }}
      >
        <input
          id="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything"
          className="flex-1 p-3 bg-gray-900 text-white border-none rounded-full focus:outline-none focus:ring-2 focus:ring-blue-700 placeholder-gray-400"
          disabled={!session}
        />
        {session ? (
          <button
            type="submit"
            className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-800 text-white text-xl transition-colors"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9"></polygon>
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => signIn()}
            className="w-32 h-12 flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-800 text-white text-base font-semibold transition-colors"
          >
            Sign in to chat
          </button>
        )}
      </form>
    </div>
  );
}