import React, { useState, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext.tsx';
import { Settings as SettingsType, SettingCategory, ThemePalette, TextPalette, Theme } from '../types.ts';
import { AddIcon, DeleteIcon, EditIcon, ArrowUpIcon, ArrowDownIcon, InstallIcon, CheckCircleIcon, ClockIcon } from '../components/Icons.tsx';
import ConfirmationDialog from '../components/ConfirmationDialog.tsx';
import Modal from '../components/Modal.tsx';
import DebugTerminal from '../components/DebugTerminal.tsx';

type Tab = 'general' | 'layout' | 'appearance' | 'notifications' | 'application';
type SettingKey = 'requesters' | 'demands' | 'inspectionTypes' | 'patios' | 'statuses';

const categoryLabels: Record<SettingKey, string> = {
    requesters: 'Solicitantes',
    demands: 'Demandas',
    inspectionTypes: 'Tipos de Vistoria',
    patios: 'Pátios',
    statuses: 'Status dos Agendamentos',
};

const palettes: { id: ThemePalette; name: string; colors: string[] }[] = [
    { id: 'blue', name: 'Padrão (Azul)', colors: ['#3b82f6', '#1d4ed8'] },
    { id: 'green', name: 'Verde Esmeralda', colors: ['#10b981', '#047857'] },
    { id: 'purple', name: 'Roxo Imperial', colors: ['#8b5cf6', '#6d28d9'] },
    { id: 'orange', name: 'Laranja Âmbar', colors: ['#f59e0b', '#b45309'] },
    { id: 'pink', name: 'Rosa Vibrante', colors: ['#f43f5e', '#be123c'] },
    { id: 'red', name: 'Vermelho Rubi', colors: ['#ef4444', '#b91c1c'] },
    { id: 'navy', name: 'Azul Marinho', colors: ['#3f51b5', '#303f9f'] },
    { id: 'maroon', name: 'Vermelho Sangue', colors: ['#991b1b', '#800000'] },
];

const textPalettes: { id: TextPalette; name: string; color: string }[] = [
    { id: 'gray', name: 'Padrão (Cinza)', color: '#374151' },
    { id: 'slate', name: 'Frio (Ardósia)', color: '#334155' },
    { id: 'stone', name: 'Quente (Pedra)', color: '#44403c' },
];

const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void; disabled: boolean }> = ({ label, enabled, onChange, disabled }) => (
    <label className="flex items-center justify-between cursor-pointer">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`}/>
        </button>
    </label>
);

const Settings: React.FC = () => {
    const { 
        settings, updateSettings, appointments, user, logo, updateLogo,
        theme, setTheme, themePalette, setThemePalette, textPalette, setTextPalette,
        installPromptEvent, triggerInstallPrompt, isStandalone, isOnline
    } = useContext(AppContext);
    
    const isAdminOrMaster = user?.roles.includes('master') || user?.roles.includes('admin');
    
    // FIX: Defined missing 'canEdit' and 'canUpdate' variables based on user permissions for the settings module.
    const canEdit = user?.permissions.settings === 'edit';
    const canUpdate = user?.permissions.settings === 'edit' || user?.permissions.settings === 'update';
    
    const [activeTab, setActiveTab] = useState<Tab>(isAdminOrMaster ? 'general' : 'appearance');
    const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [currentKey, setCurrentKey] = useState<SettingKey | null>(null);
    const [currentItem, setCurrentItem] = useState<SettingCategory | null>(null);
    const [itemName, setItemName] = useState('');
    const [itemToDelete, setItemToDelete] = useState<{ key: SettingKey; item: SettingCategory } | null>(null);

    // PWA Health State
    const [swState, setSwState] = useState<'checking' | 'active' | 'none' | 'unsupported'>('checking');
    const [cacheInfo, setCacheInfo] = useState<string>('Verificando...');

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        if (activeTab === 'application') {
            checkPWAHealth();
        }
    }, [activeTab]);

    const checkPWAHealth = async () => {
        if (!('serviceWorker' in navigator)) {
            setSwState('unsupported');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.active) {
                setSwState('active');
            } else {
                setSwState('none');
            }

            if ('caches' in window) {
                const keys = await caches.keys();
                setCacheInfo(`${keys.length} versão(ões) em cache`);
            }
        } catch (e) {
            setSwState('none');
        }
    };

    if (!user || user?.permissions.settings === 'hidden') {
        return (
            <div className="text-center p-10 bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 rounded-r-lg">
                <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">Acesso Negado</h2>
                <p className="mt-2 text-yellow-700 dark:text-yellow-300">Você não tem permissão para visualizar esta página.</p>
            </div>
        );
    }
    
    const allTabs = [
        { id: 'general', label: 'Geral', condition: isAdminOrMaster },
        { id: 'layout', label: 'Identidade Visual', condition: isAdminOrMaster },
        { id: 'appearance', label: 'Aparência', condition: true },
        { id: 'notifications', label: 'Notificações', condition: true },
        { id: 'application', label: 'Aplicativo / Mobile', condition: true },
    ];
    const visibleTabs = allTabs.filter(tab => tab.condition);

    const handleSave = () => {
        const { id, ...settingsToSave } = localSettings;
        updateSettings(settingsToSave); 
        alert('Configurações salvas com sucesso!'); 
    };
    
    const openModal = (key: SettingKey, item: SettingCategory | null) => { setCurrentKey(key); setCurrentItem(item); setItemName(item ? item.name : ''); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setCurrentKey(null); setCurrentItem(null); setItemName(''); };
    
    const handleSaveItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentKey || !itemName.trim()) return;
        let updatedList: SettingCategory[];
        if (currentItem) {
            updatedList = (localSettings[currentKey] as SettingCategory[]).map(item => item.id === currentItem.id ? { ...item, name: itemName.trim() } : item);
        } else {
            const newItem: SettingCategory = { id: new Date().getTime().toString(), name: itemName.trim() };
            updatedList = [...localSettings[currentKey], newItem];
        }
        setLocalSettings(prev => ({ ...prev, [currentKey]: updatedList }));
        closeModal();
    };

    const openDeleteDialog = (key: SettingKey, item: SettingCategory) => { setItemToDelete({ key, item }); setIsConfirmOpen(true); };
    const closeDeleteDialog = () => { setIsConfirmOpen(false); setItemToDelete(null); };
    const confirmDelete = () => {
        if (!itemToDelete) return;
        const { key, item } = itemToDelete;
        const isInUse = appointments.some(app => {
            if (key === 'requesters') return app.requester === item.name;
            if (key === 'demands') return app.demand === item.name;
            if (key === 'inspectionTypes') return app.inspectionType === item.name;
            if (key === 'patios') return app.patio === item.name;
            if (key === 'statuses') return app.status === item.name;
            return false;
        });
        if (isInUse) {
            alert(`Não é possível remover "${item.name}" pois está sendo utilizado em um ou mais agendamentos.`);
            closeDeleteDialog();
            return;
        }
        const updatedList = (localSettings[key] as SettingCategory[]).filter(i => i.id !== item.id);
        setLocalSettings(prev => ({ ...prev, [key]: updatedList }));
        closeDeleteDialog();
    };

    const handleMoveItem = (key: SettingKey, index: number, direction: 'up' | 'down') => {
        const list = [...(localSettings[key] as SettingCategory[])];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= list.length) return;
        [list[index], list[newIndex]] = [list[newIndex], list[index]];
        setLocalSettings(prev => ({ ...prev, [key]: list }));
    };
    
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { alert("O arquivo é muito grande. O tamanho máximo é 2MB."); return; }
            const reader = new FileReader();
            reader.onloadend = () => { if (reader.result) updateLogo(reader.result as string); };
            reader.readAsDataURL(file);
        }
    };
    
    const renderGeneralSettings = () => (
        <div className="space-y-8">
            {(['requesters', 'demands', 'inspectionTypes', 'patios', 'statuses'] as SettingKey[]).map(key => (
                <div key={key}>
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{categoryLabels[key]}</h3>
                        <button onClick={() => openModal(key, null)} disabled={!canEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg shadow hover:bg-primary-700 disabled:bg-primary-300">
                            <AddIcon /> Adicionar
                        </button>
                    </div>
                    <div className="mt-4 border rounded-lg overflow-hidden dark:border-gray-700">
                        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                            {localSettings[key] && (localSettings[key] as SettingCategory[]).map((item, index) => (
                                <li key={item.id} className="px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <span className="text-gray-900 dark:text-gray-200">{item.name}</span>
                                    <div className="flex items-center gap-2">
                                        {key === 'statuses' && (
                                            <>
                                                <button onClick={() => handleMoveItem(key, index, 'up')} disabled={index === 0 || !canEdit} className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowUpIcon /></button>
                                                <button onClick={() => handleMoveItem(key, index, 'down')} disabled={index === (localSettings[key] as SettingCategory[]).length - 1 || !canEdit} className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"><ArrowDownIcon /></button>
                                            </>
                                        )}
                                        <button onClick={() => openModal(key, item)} disabled={!canEdit} className="p-1 text-primary-500 hover:text-primary-700 disabled:opacity-30"><EditIcon /></button>
                                        <button onClick={() => openDeleteDialog(key, item)} disabled={!canEdit} className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"><DeleteIcon /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderLayoutSettings = () => (
        <div className="space-y-6">
            <div>
                <label htmlFor="appName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome da Aplicação</label>
                <input type="text" id="appName" value={localSettings.appName} onChange={(e) => setLocalSettings(prev => ({ ...prev, appName: e.target.value }))} disabled={!canEdit} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Logo da Aplicação</label>
                <div className="mt-2 flex items-center gap-4">
                    <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
                        {logo ? <img src={logo} alt="Logo" className="object-contain h-full w-full" /> : <span className="text-xs text-gray-500">Sem Logo</span>}
                    </div>
                    <div>
                        <input type="file" ref={fileInputRef} onChange={handleLogoUpload} accept="image/png, image/jpeg, image/svg+xml" className="hidden" disabled={!canEdit} />
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!canEdit} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">Alterar Logo</button>
                        <button type="button" onClick={() => updateLogo(null)} disabled={!canEdit || !logo} className="ml-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">Remover Logo</button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAppearanceSettings = () => (
        <div className="space-y-8">
            <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Tema da Aplicação</h3>
                <div className="mt-3 flex gap-4">
                    <button onClick={() => setTheme('light')} disabled={!canUpdate} className={`px-4 py-2 rounded-lg disabled:opacity-50 ${theme === 'light' ? 'bg-primary-500 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-700'}`}>Claro</button>
                    <button onClick={() => setTheme('dark')} disabled={!canUpdate} className={`px-4 py-2 rounded-lg disabled:opacity-50 ${theme === 'dark' ? 'bg-primary-500 text-white shadow-lg' : 'bg-gray-200 dark:bg-gray-700'}`}>Escuro</button>
                </div>
            </div>
             <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Cor de Destaque</h3>
                <div className="mt-3 grid grid-cols-4 sm:grid-cols-8 gap-4">
                    {palettes.map(p => (
                        <button key={p.id} onClick={() => setThemePalette(p.id)} disabled={!canUpdate} className={`h-10 w-10 rounded-full border-2 transition-transform transform hover:scale-110 ${themePalette === p.id ? 'border-gray-900 dark:border-white scale-110 ring-2 ring-primary-400' : 'border-transparent'}`} style={{ backgroundColor: p.colors[0] }} title={p.name} />
                    ))}
                </div>
            </div>
        </div>
    );

    const renderNotificationsSettings = () => (
        <div className="space-y-6">
            <div>
                 <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Alertas do App</h3>
                 <div className="mt-4 space-y-3 max-w-md">
                     <ToggleSwitch label="Habilitar alerta sonoro" enabled={localSettings.enableSoundAlert ?? false} onChange={(enabled) => setLocalSettings(p => ({ ...p, enableSoundAlert: enabled }))} disabled={!canUpdate} />
                      <ToggleSwitch label="Habilitar vibração" enabled={localSettings.enableVibrationAlert ?? false} onChange={(enabled) => setLocalSettings(p => ({ ...p, enableVibrationAlert: enabled }))} disabled={!canUpdate} />
                 </div>
            </div>
            {isAdminOrMaster && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Console de Debug</h3>
                    <button onClick={() => setIsTerminalOpen(true)} className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 flex items-center gap-2 font-mono text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        Visualizar Logs do Sistema
                    </button>
                </div>
            )}
        </div>
    );
    
    const renderApplicationSettings = () => {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Painel de Instalação */}
                    <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800 p-6 rounded-2xl">
                        <div className="flex flex-col items-center text-center">
                            <div className="h-16 w-16 bg-primary-100 dark:bg-primary-800 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 mb-4">
                                <InstallIcon />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white uppercase tracking-tighter">Instalação</h3>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs uppercase font-black">
                                {isStandalone ? 'App rodando em modo nativo' : 'Adicione à sua tela inicial para acesso offline'}
                            </p>
                            
                            <div className="mt-6 w-full">
                                {isStandalone ? (
                                    <div className="flex flex-col items-center gap-2 text-green-600 dark:text-green-400 font-black p-4 bg-white dark:bg-gray-800/50 rounded-xl shadow-sm border border-green-100 dark:border-green-900/30 uppercase text-[10px] tracking-widest">
                                       <CheckCircleIcon />
                                       <span>Aplicativo Instalado</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={triggerInstallPrompt}
                                        disabled={!installPromptEvent}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 transition-all transform active:scale-95 font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        <InstallIcon />
                                        {installPromptEvent ? 'Instalar Agora' : 'PWA Indisponível'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Painel de Diagnóstico */}
                    <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-100 dark:border-gray-800 p-6 rounded-2xl">
                        <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest mb-4">Saúde do PWA</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                <span className="text-[10px] font-black text-gray-500 uppercase">Conexão</span>
                                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
                                    <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500 animate-pulse'}`}></div>
                                    {isOnline ? 'Online' : 'Offline'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                <span className="text-[10px] font-black text-gray-500 uppercase">Service Worker</span>
                                <span className={`text-[10px] font-black uppercase ${swState === 'active' ? 'text-green-500' : 'text-amber-500'}`}>
                                    {swState === 'active' ? 'Ativo & Rodando' : swState === 'checking' ? 'Verificando...' : 'Inativo'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                <span className="text-[10px] font-black text-gray-500 uppercase">Modo Offline</span>
                                <span className="text-[10px] font-black text-primary-500 uppercase">{cacheInfo}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700/50">
                                <span className="text-[10px] font-black text-gray-500 uppercase">Interface</span>
                                <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 uppercase">{isStandalone ? 'App Standalone' : 'Navegador Web'}</span>
                            </div>
                        </div>
                        
                        <button 
                            onClick={checkPWAHealth}
                            className="mt-4 w-full py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            Atualizar Diagnóstico
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-xl">
                    <div className="flex gap-3">
                        <div className="text-amber-600 flex-shrink-0"><ClockIcon /></div>
                        <div>
                            <p className="text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-tighter">Dica de Teste:</p>
                            <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-1">Para testar o modo offline, desative o Wi-Fi. Se o sistema continuar funcionando e exibindo os dados, o PWA está operando corretamente através do Cache Storage.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 dark:text-white tracking-tighter">Configurações</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 font-medium">Painel de controle de preferências do sistema.</p>
                </div>
                {canUpdate && activeTab !== 'application' && (
                    <button onClick={handleSave} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 transition-all font-black text-xs uppercase tracking-widest w-full sm:w-auto">
                        Salvar Alterações
                    </button>
                )}
            </div>
            
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto no-scrollbar">
                <nav className="-mb-px flex space-x-6 min-w-max pb-1">
                    {visibleTabs.map(tab => (
                       <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`py-3 px-1 border-b-2 font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                           {tab.label}
                       </button>
                    ))}
                </nav>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700/50">
                {activeTab === 'general' && renderGeneralSettings()}
                {activeTab === 'layout' && renderLayoutSettings()}
                {activeTab === 'appearance' && renderAppearanceSettings()}
                {activeTab === 'notifications' && renderNotificationsSettings()}
                {activeTab === 'application' && renderApplicationSettings()}
            </div>

            {isAdminOrMaster && <DebugTerminal isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />}

            <Modal isOpen={isModalOpen} onClose={closeModal} title={currentItem ? 'Editar Registro' : 'Novo Registro'}>
                <form onSubmit={handleSaveItem}>
                    <div>
                        <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome</label>
                        <input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} required autoFocus className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-md font-bold">Salvar</button>
                    </div>
                </form>
            </Modal>

            <ConfirmationDialog isOpen={isConfirmOpen} onClose={closeDeleteDialog} onConfirm={confirmDelete} title="Confirmar Exclusão" message={`Tem certeza que deseja remover "${itemToDelete?.item.name}"? Esta ação não pode ser desfeita.`} />
        </>
    );
};

export default Settings;