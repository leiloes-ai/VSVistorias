import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './contexts/AppContext.tsx';

// --- Global Debug Logger ---
// Intercepta todas as mensagens do console desde o início para depuração.
// As mensagens são armazenadas em um buffer global.
(window as any)._debugLogs = [];
const _originalConsole = { ...console };
const _logLevels: (keyof Console)[] = ['log', 'warn', 'error', 'info', 'debug'];

// Helper para evitar erros de referência circular no JSON.stringify
const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key: string, value: any) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "[Circular]";
            }
            seen.add(value);
        }
        return value;
    };
};

_logLevels.forEach(level => {
  const originalMethod = _originalConsole[level];
  if (typeof originalMethod === 'function') {
    (console as any)[level] = (...args: any[]) => {
      originalMethod.apply(console, args);
      try {
        const message = args.map(arg => {
          if (arg instanceof Error) {
            return `Error: ${arg.message}\n${arg.stack}`;
          }
          return typeof arg === 'object' ? JSON.stringify(arg, getCircularReplacer(), 2) : String(arg);
        }).join(' ');
        
        // Limita o buffer para evitar consumo excessivo de memória
        if ((window as any)._debugLogs.length > 200) {
            (window as any)._debugLogs.shift();
        }
        
        (window as any)._debugLogs.push({
          level,
          message,
          timestamp: new Date().toLocaleTimeString()
        });
      } catch (e) {
        _originalConsole.error("Erro ao registrar no buffer de debug global:", e);
      }
    };
  }
});
console.log("Logger de debug global inicializado.");


const rootElement = document.getElementById('root');
if (!rootElement) {
  // Este erro será capturado pelo terminal de debug.
  console.error("Erro Fatal: Não foi possível encontrar o elemento 'root' para montar a aplicação React.");
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);