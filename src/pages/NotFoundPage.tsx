// src/pages/NotFoundPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
      <p className="text-8xl font-black text-gray-100 select-none">404</p>
      <h1 className="text-3xl font-black mt-2 mb-3">Page Not Found</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="bg-black text-white font-bold text-sm px-6 py-3 rounded uppercase tracking-wider hover:bg-gray-800 transition-colors"
      >
        Back to Home
      </Link>
    </main>
  );
}
