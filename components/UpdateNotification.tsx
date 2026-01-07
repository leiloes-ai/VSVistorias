import React from 'react';

interface UpdateNotificationProps {
  onUpdate: () => void;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onUpdate }) => {
  return (
    <div 
      role="alert"
      className="fixed bottom-4 left-4 z-[100] bg-white dark:bg-gray-800 p-4 rounded-lg shadow-2xl flex items-center gap-4 border border-gray-200 dark:border-gray-700 animate-fade-in-out"
    >
      <div className="flex-shrink-0">
        <svg className="w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h5M4 19v-5h5m11-4h-5V5M15 19h5v-5" />
        </svg>
      </div>
      <div className="flex-grow">
        <p className="font-bold text-gray-800 dark:text-white">Nova versão disponível!</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">Atualize o aplicativo para obter as últimas melhorias.</p>
      </div>
      <button 
        onClick={onUpdate}
        className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800 whitespace-nowrap"
      >
        Atualizar
      </button>
    </div>
  );
};

export default UpdateNotification;