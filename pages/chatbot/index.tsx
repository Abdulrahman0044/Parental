"use client";
import { useChat } from "ai/react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { messages, input, handleInputChange, handleSubmit } = useChat({ api: "/api/chatbot" });
  const [context, setContext] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // If this is the first message and context is empty, use the input as context
    if (messages.length === 0 && !context) {
      setContext(input);
    }
    // Submit the message with the current context
    await handleSubmit(e, { data: { context: context || input } });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col items-center mb-4">
          <img
            src="/logo.png"
            alt="Parental Logo"
            className="w-24 h-24 mb-2 select-none"
            draggable="false"
          />
          <div className="flex justify-between items-center w-full">
            <h1 className="text-2xl font-bold text-blue-600">Parental</h1>
            <button
              onClick={() => router.push("/api/auth/signout")}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
        <p className="text-gray-600 mb-4">
          Share your relationship or parenting challenges, and Parental will provide personalized advice.
        </p>
        <div className="flex flex-col h-96 overflow-y-auto bg-gray-50 p-4 rounded-md space-y-4 mb-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-3 rounded-lg max-w-[80%] ${
                m.role === "user" ? "bg-blue-100 self-end" : "bg-gray-200 self-start"
              }`}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          ))}
        </div>
        <form onSubmit={handleFormSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type your situation or message..."
            className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
} 