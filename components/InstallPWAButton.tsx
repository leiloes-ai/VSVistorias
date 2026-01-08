import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext.tsx';
import { InstallIcon } from './Icons.tsx';

const InstallPWAButton: React.FC = () => {
    const { installPromptEvent, triggerInstallPrompt, isStandalone } = useContext(AppContext);

    // Detecção de ambiente Sandbox para demonstração
    const isSandbox = window.location.protocol === 'blob:' || window.location.host === '';

    // Se já estiver instalado em modo Standalone, não mostra nada
    if (isStandalone) return null;

    // Se estiver no sandbox, mostramos o botão mesmo sem o evento, para que o usuário possa ver a UI
    const showButton = installPromptEvent || (isSandbox && !isStandalone);

    if (!showButton) return null;

    const handleClick = () => {
        if (isSandbox && !installPromptEvent) {
            alert("MODO DEMONSTRAÇÃO: No ambiente de Preview (Sandbox), o navegador bloqueia a instalação real. \n\nPara instalar de verdade, este app precisa estar publicado no Firebase/Produção com HTTPS.");
            return;
        }
        triggerInstallPrompt();
    };

    return (
        <div className="fixed bottom-6 right-6 z-[90] animate-bounce">
            <button
                onClick={handleClick}
                className="group relative flex items-center justify-center w-14 h-14 bg-primary-600 text-white rounded-full shadow-2xl hover:bg-primary-700 transition-all transform active:scale-90"
                title="Instalar Aplicativo"
            >
                <div className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-20"></div>
                <InstallIcon />
                
                {/* Tooltip opcional que aparece no hover */}
                <span className="absolute right-16 bg-gray-900 text-white text-xs font-bold px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-gray-700">
                    {isSandbox && !installPromptEvent ? 'Instalar (Simulação)' : 'Instalar no Celular'}
                </span>
            </button>
        </div>
    );
};

export default InstallPWAButton;