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
  const chatId = useRef(0);

  // Upsert user in Supabase when session is available
  useEffect(() => {
    // NextAuth profile returns id as user.name, so use that as WorldCoin ID
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
  }, [userId, sessionId]); // refetch when new session is created

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
        })
        .catch(console.error);
    } else {
      setMessages([]);
      setHasChatted(false);
    }
  }, [selectedSessionId]);

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

    // Prepare payload
    const payload = {
      messages: [
        ...messages.map(({ role, content }) => ({ role, content })),
        { role: "user", content: inputValue },
      ],
      data: { context: context || inputValue },
    };
    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      let assistantMsg = { id: `assistant-${chatId.current++}`, role: "assistant" as const, content: "" };
      setMessages((prev) => [...prev, assistantMsg]);
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = new TextDecoder().decode(value);
          assistantMsg = { ...assistantMsg, content: assistantMsg.content + chunk };
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsg.id ? assistantMsg : msg
            )
          );
        }
      }
      // Store AI message in Supabase
      if (currentSessionId) {
        insertMessage({ session_id: currentSessionId, sender: "ai", content: assistantMsg.content }).catch(console.error);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: `error-${chatId.current++}`, role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
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

      {/* Session dropdown */}
      {sessions.length > 0 && (
        <div className="w-full max-w-2xl mx-auto mb-4">
          <label htmlFor="session-dropdown" className="block text-gray-300 mb-2 text-lg font-semibold">Previous Sessions</label>
          <select
            id="session-dropdown"
            className="w-full p-3 rounded-xl bg-gray-800 text-white text-lg mb-2"
            value={selectedSessionId || ''}
            onChange={e => {
              setSelectedSessionId(e.target.value || null);
            }}
          >
            <option value="">Start a new session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {session?.user?.name || 'User'} — {new Date(s.started_at).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chat area */}
      <div className="w-full max-w-2xl flex-1 flex flex-col justify-end mx-auto">
        {/* Chat history (only after chatting) */}
        {hasChatted && (
          <div className="flex flex-col h-96 overflow-y-auto bg-gray-900 p-6 rounded-3xl space-y-6 mb-6">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-6 rounded-3xl max-w-[90%] text-lg font-medium shadow-lg transition-all duration-200
                  ${m.role === "user" ? "bg-blue-900 text-white self-end" : "bg-gray-700 text-gray-100 self-start"}
                `}
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
        className="w-full max-w-2xl mx-auto flex items-center gap-4 bg-gray-950 px-6 py-5 border-t border-gray-800 rounded-2xl shadow-2xl mt-4 mb-8"
        style={{ position: "sticky", bottom: 0 }}
      >
        <input
          id="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask me about relationships..."
          className="flex-1 p-7 bg-gray-900 text-white border-none rounded-full focus:outline-none focus:ring-4 focus:ring-blue-700 placeholder-gray-400 text-xl shadow-inner min-h-[64px]"
          disabled={!session}
        />
        {session ? (
          <button
            type="submit"
            className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-800 text-white text-2xl transition-colors shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-700/30"
            title="Send"
          >
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9"></polygon>
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => signIn()}
            className="w-40 h-16 flex items-center justify-center rounded-full bg-blue-700 hover:bg-blue-800 text-white text-lg font-semibold transition-colors shadow-lg"
          >
            Sign in to chat
          </button>
        )}
      </form>
    </div>
  );
}