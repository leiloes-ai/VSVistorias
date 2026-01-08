import React, { useState, useContext, useEffect } from 'react';
import Sidebar from './components/Sidebar.tsx';
import Header from './components/Header.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Appointments from './pages/Appointments.tsx';
import Pendent from './pages/Pendent.tsx';
import NewRequests from './pages/NewRequests.tsx';
import Users from './pages/Users.tsx';
import Settings from './pages/Settings.tsx';
import Profile from './pages/Profile.tsx';
import Reports from './pages/Reports.tsx';
import Financial from './pages/Financial.tsx';
import Notification from './components/Notification.tsx';
import { AppContext } from './contexts/AppContext.tsx';
import LoginPage from './pages/LoginPage.tsx';
import ForcePasswordChangeModal from './components/ForcePasswordChangeModal.tsx';
import UpdateNotification from './components/UpdateNotification.tsx';
import InstallPWAButton from './components/InstallPWAButton.tsx';


export type Page = 'Dashboard' | 'Agendamentos' | 'Pendências' | 'Novas Solicitações' | 'Relatórios' | 'Usuários' | 'Configurações' | 'Meu Perfil' | 'Financeiro';

const App: React.FC = () => {
  const { user, activePage, notification, clearNotification, loading, isUpdateAvailable, updateApp } = useContext(AppContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isForcePasswordChangeOpen, setIsForcePasswordChangeOpen] = useState(false);

  useEffect(() => {
    if (user && user.forcePasswordChange) {
      setIsForcePasswordChangeOpen(true);
    } else {
      setIsForcePasswordChangeOpen(false);
    }
  }, [user]);

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Agendamentos':
        return <Appointments />;
      case 'Pendências':
        return <Pendent />;
      case 'Novas Solicitações':
        return <NewRequests />;
      case 'Relatórios':
        return <Reports />;
      case 'Financeiro':
        return <Financial />;
      case 'Usuários':
        return <Users />;
      case 'Meu Perfil':
        return <Profile />;
      case 'Configurações':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Carregando sistema...</h2>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Por favor, aguarde.</p>
          </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="relative flex h-screen bg-gray-100 dark:bg-gray-900 font-sans overflow-hidden">
      {isForcePasswordChangeOpen && <ForcePasswordChangeModal onClose={() => setIsForcePasswordChangeOpen(false)} />}
      
      {notification && <Notification message={notification} onClose={clearNotification} />}
      {isUpdateAvailable && <UpdateNotification onUpdate={updateApp} />}
      
      <InstallPWAButton />
      
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header currentPage={activePage} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;