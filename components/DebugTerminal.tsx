import React, { useState, useEffect, useRef } from 'react';

interface Log {
  level: string;
  message: string;
  timestamp: string;
}

interface DebugTerminalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DebugTerminal: React.FC<DebugTerminalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const logsEndRef = useRef<null | HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      // Carrega os logs já capturados pelo logger global
      setLogs([...((window as any)._debugLogs || [])]);

      // Inicia a verificação de novos logs
      intervalRef.current = window.setInterval(() => {
        // `setLogs` com uma função para evitar dependência de 'logs' e loop de re-renderização
        setLogs(currentLogs => {
            const globalLogs = (window as any)._debugLogs || [];
            if (globalLogs.length !== currentLogs.length) {
                return [...globalLogs];
            }
            return currentLogs;
        });
      }, 500);

      // Limpa o intervalo quando o modal é fechado
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    // Rola para o final sempre que os logs são atualizados enquanto aberto
    if (isOpen) {
      scrollToBottom();
    }
  }, [logs, isOpen]);

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };
  
  const handleClearLogs = () => {
    if (Array.isArray((window as any)._debugLogs)) {
        (window as any)._debugLogs.length = 0; // Clear the global array
    }
    setLogs([]); // Clear the local state
    console.log("Logs do terminal de debug limpos.");
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-gray-900 text-white rounded-lg shadow-2xl flex flex-col font-mono text-sm">
        <header className="flex-shrink-0 flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
          <h2 className="font-bold">Terminal de Debug</h2>
          <div>
            <button onClick={handleClearLogs} className="px-3 py-1 bg-yellow-600 rounded-md hover:bg-yellow-700 text-xs mr-2">Limpar</button>
            <button onClick={onClose} className="px-3 py-1 bg-red-600 rounded-md hover:bg-red-700 text-xs">Fechar</button>
          </div>
        </header>
        <main className="flex-grow p-3 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-3 border-b border-gray-800 py-1">
              <span className="text-gray-500">{log.timestamp}</span>
              <span className={`font-bold ${getLogColor(log.level)}`}>[{log.level.toUpperCase()}]</span>
              <pre className={`whitespace-pre-wrap break-words ${getLogColor(log.level)}`}>{log.message}</pre>
            </div>
          ))}
          <div ref={logsEndRef} />
        </main>
      </div>
    </div>
  );
};

export default DebugTerminal;