
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
    <header className="h-20 flex-shrink-0 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="md:hidden text-gray-600 dark:text-gray-300">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
          </button>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">{currentPage}</h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <p className="font-semibold text-gray-800 dark:text-white">{user?.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user ? user.roles.map(r => roleTranslations[r]).join(', ') : ''}</p>
        </div>
        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 ring-transparent focus:ring-primary-500 transition"
            >
                {user?.photoURL ? <img src={user.photoURL} alt="Foto do perfil" className="h-full w-full object-cover" /> : <UserIcon />}
            </button>
            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-40">
                    <button
                        onClick={logout}
                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <LogoutIcon />
                        <span className="ml-2">Sair</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;