import React, { useContext, useState } from 'react';
import { AppContext } from '../contexts/AppContext.tsx';
import { InstallIcon } from './Icons.tsx';
import Modal from './Modal.tsx';

const InstallPWAButton: React.FC = () => {
    const { installPromptEvent, triggerInstallPrompt, isStandalone } = useContext(AppContext);
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

    const isSandbox = window.location.protocol === 'blob:';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (isStandalone) return null;

    const handleClick = () => {
        if (installPromptEvent) {
            triggerInstallPrompt();
        } else {
            setIsHelpModalOpen(true);
        }
    };

    return (
        <>
            <div className="fixed bottom-6 right-6 z-[90]">
                <button
                    onClick={handleClick}
                    className="group relative flex items-center justify-center w-14 h-14 bg-primary-600 text-white rounded-full shadow-2xl hover:bg-primary-700 transition-all transform active:scale-90 animate-bounce"
                    title="Instalar Aplicativo"
                >
                    <div className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-20"></div>
                    <InstallIcon />
                    <span className="absolute right-16 bg-gray-900 text-white text-[10px] font-black px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-gray-700 uppercase tracking-tighter">
                        Instalar no Celular
                    </span>
                </button>
            </div>

            <Modal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} title="Como Instalar o Aplicativo">
                <div className="space-y-6 text-gray-700 dark:text-gray-300">
                    {isSandbox ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded">
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase mb-2">Ambiente de Teste Detectado</p>
                            <p className="text-xs">No modo de visualização (Preview), a instalação automática é bloqueada por segurança. Para instalar, acesse o link oficial do sistema em produção.</p>
                        </div>
                    ) : isIOS ? (
                        <div className="space-y-4">
                            <p className="text-sm font-bold uppercase tracking-tighter">Instruções para iPhone/iPad:</p>
                            <ol className="list-decimal list-inside space-y-3 text-xs">
                                <li>Abra este site no navegador <strong className="text-primary-600">Safari</strong>.</li>
                                <li>Toque no ícone de <strong className="text-primary-600">Compartilhar</strong> (quadrado com uma seta para cima).</li>
                                <li>Role para baixo e toque em <strong className="text-primary-600">"Adicionar à Tela de Início"</strong>.</li>
                                <li>Toque em <strong className="text-primary-600">Adicionar</strong> no canto superior direito.</li>
                            </ol>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm font-bold uppercase tracking-tighter">Instalação Manual:</p>
                            <ol className="list-decimal list-inside space-y-3 text-xs">
                                <li>Toque nos <strong className="text-primary-600">3 pontinhos</strong> do navegador (canto superior direito).</li>
                                <li>Procure por <strong className="text-primary-600">"Instalar Aplicativo"</strong> ou <strong className="text-primary-600">"Adicionar à Tela Inicial"</strong>.</li>
                                <li>Confirme a instalação para ter acesso offline e mais velocidade.</li>
                            </ol>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => setIsHelpModalOpen(false)}
                        className="w-full py-3 bg-primary-600 text-white font-black text-xs rounded-xl uppercase tracking-widest"
                    >
                        Entendi
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default InstallPWAButton;