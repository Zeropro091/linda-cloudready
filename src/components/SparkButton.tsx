import React from 'react';
import { useAuth } from './AuthProvider';
import { X } from 'lucide-react';

export const SparkButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { role } = useAuth();
  if (!['admin', 'dev'].includes(role)) return null;
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-transform hover:scale-105 focus:outline-none"
    >
      <X size={24} className="animate-pulse" />
    </button>
  );
};
