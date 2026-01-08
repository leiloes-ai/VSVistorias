import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './contexts/AppContext.tsx';

// --- Global Debug Logger ---
(window as any)._debugLogs = [];
const _originalConsole = { ...console };
const _logLevels: (keyof Console)[] = ['log', 'warn', 'error', 'info', 'debug'];

const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (key: string, value: any) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
        }
        return value;
    };
};

const pushToLog = (level: string, message: string) => {
    if ((window as any)._debugLogs.length > 500) (window as any)._debugLogs.shift();
    (window as any)._debugLogs.push({
        level,
        message,
        timestamp: new Date().toLocaleTimeString()
    });
};

_logLevels.forEach(level => {
  const originalMethod = _originalConsole[level];
  if (typeof originalMethod === 'function') {
    (console as any)[level] = (...args: any[]) => {
      originalMethod.apply(console, args);
      try {
        const message = args.map(arg => {
          if (arg instanceof Error) return `Error: ${arg.message}\n${arg.stack}`;
          if (typeof arg === 'string') return arg;
          return JSON.stringify(arg, getCircularReplacer(), 2);
        }).join(' ');
        pushToLog(level, message);
      } catch (e) {
        _originalConsole.error("Erro no logger:", e);
      }
    };
  }
});

// Listener para logs vindos do Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_LOG') {
            (console as any)[event.data.level](event.data.message);
        }
    });
}

window.onerror = (msg, url, lineNo, columnNo, error) => {
    console.error(`[Fatal] ${msg} @ ${url}:${lineNo}`, error);
    return false;
};

window.onunhandledrejection = (event) => {
    console.error(`[Promise Rejected] ${event.reason}`);
};

console.log("Terminal Iniciado. Monitorando ambiente...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);