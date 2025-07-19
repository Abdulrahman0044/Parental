import React from "react";

export default function Custom404() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8">
      <img src="/logo.png" alt="Parental Logo" className="w-24 h-24 mb-6 opacity-70 select-none" draggable="false" />
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
      <p className="text-lg mb-6">Sorry, the page you are looking for does not exist or has been moved.</p>
      <a href="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-full text-white font-semibold transition-colors">Go Home</a>
    </div>
  );
} 