import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext.tsx';
import { UserIcon, LogoutIcon } from './Icons.tsx';
import { Role } from '../types.ts';

interface HeaderProps {
  currentPage: string;
  onMenuClick: () => void;
}

const roleTranslations: Record<Role, string> = {
  master: 'Master',
  admin: 'Administrador',
  inspector: 'Vistoriador',
  client: 'Cliente',
};

const Header: React.FC<HeaderProps> = ({ currentPage, onMenuClick }) => {
  const { user, logout } = useContext(AppContext);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-20 flex-shrink-0 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-between px-3 sm:px-6 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300 overflow-hidden relative z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button onClick={onMenuClick} className="md:hidden text-gray-600 dark:text-gray-300 flex-shrink-0 p-2 -ml-1">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
          </button>
          <h2 className="text-base sm:text-2xl font-bold text-gray-800 dark:text-white truncate pr-2">{currentPage}</h2>
      </div>
      
      <div className="flex items-center space-x-2 sm:space-x-4 ml-auto flex-shrink-0 min-w-0">
        {/* Informações do Usuário - Agora visíveis no mobile também */}
        <div className="text-right min-w-0 flex flex-col justify-center">
          <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white truncate max-w-[80px] xs:max-w-[120px] sm:max-w-[200px]">
            {user?.name}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 capitalize truncate max-w-[80px] xs:max-w-[120px] sm:max-w-[200px]">
            {user ? user.roles.map(r => roleTranslations[r]).join(', ') : ''}
          </p>
        </div>

        {/* Avatar e Dropdown de Logoff */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-primary-100 dark:border-primary-900/30 focus:ring-2 focus:ring-primary-500 transition active:scale-95"
            >
                {user?.photoURL ? <img src={user.photoURL} alt="Foto do perfil" className="h-full w-full object-cover" /> : <UserIcon />}
            </button>
            
            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-2xl py-1 ring-1 ring-black ring-opacity-5 z-40 border border-gray-100 dark:border-gray-700">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Minha Conta</p>
                        <p className="text-xs font-black text-gray-900 dark:text-white truncate">{user?.name}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full flex items-center px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <LogoutIcon />
                        <span className="ml-2 font-bold">Sair do Sistema</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;