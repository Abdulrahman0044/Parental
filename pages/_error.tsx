import React from "react";
import { NextPageContext } from "next";

interface ErrorProps {
  statusCode?: number;
}

function getErrorMessage(statusCode?: number) {
  if (statusCode === 404) {
    return "Sorry, the page you are looking for was not found.";
  }
  if (statusCode) {
    return `An error ${statusCode} occurred on server.`;
  }
  return "An error occurred on client.";
}

const Error = ({ statusCode }: ErrorProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-8">
      <img src="/logo.png" alt="Parental Logo" className="w-24 h-24 mb-6 opacity-70 select-none" draggable="false" />
      <h1 className="text-4xl font-bold mb-4">Oops!</h1>
      <p className="text-lg mb-6">{getErrorMessage(statusCode)}</p>
      <a href="/" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-full text-white font-semibold transition-colors">Go Home</a>
    </div>
  );
};

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error; 