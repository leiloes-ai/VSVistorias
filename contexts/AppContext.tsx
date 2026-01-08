import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, Appointment, Settings, Theme, ThemePalette, Message, Pendency, SettingCategory, TextPalette, FinancialTransaction, FinancialPage, FinancialAccount, ThirdParty, FinancialCategory, Service } from '../types.ts';
import { db, auth } from '../firebaseConfig.ts';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, DocumentData, writeBatch, setDoc, arrayUnion, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail, updatePassword as fbUpdatePassword, EmailAuthProvider, reauthenticateWithCredential, User as FirebaseUser } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { Page } from '../App.tsx';

// --- App Context ---
interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  themePalette: ThemePalette;
  setThemePalette: (palette: ThemePalette) => void;
  textPalette: TextPalette;
  setTextPalette: (palette: TextPalette) => void;
  user: User | null; 
  users: User[]; 
  appointments: Appointment[];
  pendencies: Pendency[];
  financials: FinancialTransaction[];
  accounts: FinancialAccount[];
  thirdParties: ThirdParty[];
  settings: Settings;
  logo: string | null;
  updateLogo: (logo: string | null) => Promise<void>;
  loading: boolean;
  isOnline: boolean;
  notification: string | null;
  clearNotification: () => void;
  triggerNotification: (message?: string) => void;
  pageNotifications: Record<Page, boolean>;
  clearPageNotification: (page: Page) => void;
  installPromptEvent: Event | null;
  triggerInstallPrompt: () => void;
  isUpdateAvailable: boolean;
  updateApp: () => void;
  isStandalone: boolean;
  
  // Auth
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;

  // Navigation
  activePage: Page;
  setActivePage: (page: Page) => void;
  activeFinancialPage: FinancialPage;
  setActiveFinancialPage: (page: FinancialPage) => void;
  
  // CRUD Functions
  addAppointment: (appointment: Omit<Appointment, 'id' | 'stringId'>) => Promise<void>;
  updateAppointment: (appointment: Appointment) => Promise<void>;
  deleteAppointment: (stringId: string) => Promise<void>;
  batchAddAppointments: (appointments: Omit<Appointment, 'id' | 'stringId'>[]) => Promise<void>;
  batchDeleteAppointments: (stringIds: string[]) => Promise<void>;
  addMessageToAppointment: (appointmentStringId: string, messageText: string) => Promise<void>;
  addPendency: (pendency: Omit<Pendency, 'id' | 'stringId'>) => Promise<void>;
  updatePendency: (pendency: Pendency) => Promise<void>;
  deletePendency: (stringId: string) => Promise<void>;
  addFinancial: (transaction: Omit<FinancialTransaction, 'id' | 'stringId'>) => Promise<void>;
  updateFinancial: (transaction: FinancialTransaction) => Promise<void>;
  deleteFinancial: (stringId: string) => Promise<void>;
  addAccount: (account: Omit<FinancialAccount, 'id' | 'stringId'>) => Promise<void>;
  updateAccount: (account: FinancialAccount) => Promise<void>;
  deleteAccount: (stringId: string) => Promise<void>;
  addThirdParty: (thirdParty: Omit<ThirdParty, 'id' | 'stringId'>) => Promise<void>;
  updateThirdParty: (thirdParty: ThirdParty) => Promise<void>;
  deleteThirdParty: (stringId: string) => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<{success: boolean, message: string}>;
  updateUser: (user: User) => Promise<void>;
  updateUserPhoto: (userId: string, photoURL: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updatePassword: (oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>;
  resetPassword: (email: string) => Promise<{success: boolean, message: string}>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
}

const defaultStatuses: SettingCategory[] = [
    { id: '1', name: 'Solicitado' },
    { id: '2', name: 'Agendado' },
    { id: '3', name: 'Em Andamento' },
    { id: '4', name: 'Concluído' },
    { id: '5', name: 'Pendente' },
    { id: '6', name: 'Finalizado' },
];

const initialSettings: Settings = {
    appName: 'GestorPRO',
    logoUrl: null,
    requesters: [],
    demands: [],
    inspectionTypes: [],
    patios: [],
    statuses: defaultStatuses,
    financialCategories: [],
    services: [],
    enableSoundAlert: true,
    enableVibrationAlert: true,
    masterPassword: '002219',
};

const initialPageNotifications: Record<Page, boolean> = {
    'Dashboard': false, 'Agendamentos': false, 'Pendências': false, 'Novas Solicitações': false,
    'Relatórios': false, 'Usuários': false, 'Configurações': false, 'Meu Perfil': false, 'Financeiro': false
};

export const AppContext = createContext<AppContextType>({
  theme: 'light', toggleTheme: () => {}, setTheme: () => {}, themePalette: 'blue', setThemePalette: () => {},
  textPalette: 'gray', setTextPalette: () => {}, user: null, users: [], appointments: [], pendencies: [], financials: [], accounts: [], thirdParties: [],
  settings: initialSettings, logo: null, updateLogo: async () => {}, loading: true, isOnline: true, notification: null,
  clearNotification: () => {}, triggerNotification: () => {}, pageNotifications: initialPageNotifications, clearPageNotification: () => {},
  installPromptEvent: null, triggerInstallPrompt: () => {}, isUpdateAvailable: false, updateApp: () => {}, isStandalone: false,
  login: async () => ({ success: false, message: 'Função de login não implementada.' }), logout: () => {},
  sendPasswordReset: async () => ({ success: false, message: 'Não implementado' }),
  activePage: 'Agendamentos', setActivePage: () => {}, activeFinancialPage: 'Dashboard', setActiveFinancialPage: () => {},
  addAppointment: async () => Promise.resolve(),
  updateAppointment: async () => Promise.resolve(), deleteAppointment: async () => Promise.resolve(),
  batchAddAppointments: async () => Promise.resolve(), batchDeleteAppointments: async () => Promise.resolve(), addMessageToAppointment: async () => Promise.resolve(),
  addPendency: async () => Promise.resolve(), updatePendency: async () => Promise.resolve(),
  deletePendency: async () => Promise.resolve(), 
  addFinancial: async () => Promise.resolve(), updateFinancial: async () => Promise.resolve(), deleteFinancial: async () => Promise.resolve(),
  addAccount: async () => Promise.resolve(), updateAccount: async () => Promise.resolve(), deleteAccount: async () => Promise.resolve(),
  addThirdParty: async () => Promise.resolve(), updateThirdParty: async () => Promise.resolve(), deleteThirdParty: async () => Promise.resolve(),
  addUser: async () => ({success: false, message: 'Não implementado'}),
  updateUser: async () => Promise.resolve(), updateUserPhoto: async () => Promise.resolve(),
  deleteUser: async () => Promise.resolve(), updatePassword: async () => ({success: false, message: 'Não implementado'}),
  resetPassword: async () => ({success: false, message: 'Não implementado'}), updateSettings: async () => Promise.resolve(),
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [themePalette, setThemePalette] = useState<ThemePalette>(() => (localStorage.getItem('themePalette') as ThemePalette) || 'blue');
  const [textPalette, setTextPalette] = useState<TextPalette>(() => (localStorage.getItem('textPalette') as TextPalette) || 'gray');
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendencies, setPendencies] = useState<Pendency[]>([]);
  const [financials, setFinancials] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activePage, setActivePage] = useState<Page>('Agendamentos');
  const [activeFinancialPage, setActiveFinancialPage] = useState<FinancialPage>('Dashboard');
  const [notification, setNotification] = useState<string | null>(null);
  const [pageNotifications, setPageNotifications] = useState<Record<Page, boolean>>(initialPageNotifications);
  
  const [installPromptEvent, setInstallPromptEvent] = useState<Event | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  const appointmentsRef = useRef(appointments);
  useEffect(() => { appointmentsRef.current = appointments; }, [appointments]);
  const initialLoadComplete = useRef(false);
  const notificationTimeoutRef = useRef<number | null>(null);
  const firestoreUnsubscribers = useRef<(() => void)[]>([]);
  
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const clearNotification = () => setNotification(null);
  const clearPageNotification = (page: Page) => { setPageNotifications(prev => ({ ...prev, [page]: false })); };
  
  const triggerNotification = (message: string = "O sistema foi atualizado com novas informações!") => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      setNotification(message);
  };
  
  useEffect(() => { document.documentElement.className = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.palette = themePalette; localStorage.setItem('themePalette', themePalette); }, [themePalette]);
  useEffect(() => { document.documentElement.dataset.textPalette = textPalette; localStorage.setItem('textPalette', textPalette); }, [textPalette]);

  // Monitoramento de Conectividade
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); console.info("Sistema: Conectado à internet."); };
    const handleOffline = () => { setIsOnline(false); console.warn("Sistema: Modo offline ativado."); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const checkStandalone = () => {
        const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone || false;
        setIsStandalone(standalone);
        console.log(`PWA Diagnostic: Modo Standalone = ${standalone}`);
    };
    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    const performPWADiagnosis = async () => {
        const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
        const host = window.location.host;
        const isSandbox = window.location.protocol === 'blob:' || !host;
        
        console.log("PWA Diagnostic: Iniciando análise de ambiente...");
        console.log(`PWA Diagnostic: Protocolo = ${window.location.protocol}`);
        console.log(`PWA Diagnostic: Host = ${host || 'Sandbox'}`);
        
        if (isSandbox) { console.warn("PWA Diagnostic: Ambiente de sandbox detectado. O PWA não pode ser instalado aqui."); return false; }
        if (!isSecure) { console.warn("PWA Diagnostic: Site não seguro (faltando HTTPS). O PWA requer HTTPS para funcionar."); return false; }
        if (!('serviceWorker' in navigator)) { console.warn("PWA Diagnostic: Navegador não suporta Service Workers."); return false; }

        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            console.log(`PWA Diagnostic: ${regs.length} Service Workers encontrados.`);
        } catch (e) {
            console.error("PWA Diagnostic: Erro ao verificar registros de SW.");
            return false;
        }

        return true;
    };

    const registerSW = async () => {
        const canRegister = await performPWADiagnosis();
        if (!canRegister) return;

        navigator.serviceWorker.register('/sw.js', { scope: '/', type: 'module' })
            .then(registration => {
                setSwRegistration(registration);
                console.info("PWA Diagnostic: Service Worker registrado com sucesso.");
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.info("PWA Diagnostic: Nova versão disponível!");
                                setIsUpdateAvailable(true);
                            }
                        };
                    }
                };
            })
            .catch(error => {
                console.error('PWA Diagnostic: Falha crítica no registro:', error.message);
            });
    };

    if (document.readyState === 'complete') {
        registerSW();
    } else {
        window.addEventListener('load', registerSW);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      console.info("PWA Diagnostic: Evento 'beforeinstallprompt' recebido! O aplicativo pode ser instalado agora.");
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
      window.removeEventListener('load', registerSW);
    };
  }, []);
  
  const updateApp = () => {
    if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        setIsUpdateAvailable(false);
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        firestoreUnsubscribers.current.forEach(unsub => unsub());
        firestoreUnsubscribers.current = [];
    
        if (firebaseUser) {
            setLoading(true);
            const unsubs: (() => void)[] = [];

            const userDocRef = doc(db, "users", firebaseUser.uid);
            unsubs.push(onSnapshot(userDocRef, async (userDoc) => {
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const defaultPermissions = { dashboard: 'hidden', appointments: 'hidden', pendencies: 'hidden', newRequests: 'hidden', reports: 'hidden', users: 'hidden', settings: 'hidden', financial: 'hidden' };
                    setUser({ id: userDoc.id, ...data, roles: data.roles || [], permissions: { ...defaultPermissions, ...(data.permissions || {}) } } as User);
                } else {
                    const defaultUserData: Omit<User, 'id'> = { name: firebaseUser.displayName || firebaseUser.email || 'Novo Usuário', email: firebaseUser.email!, roles: ['inspector'], permissions: { dashboard: 'view', appointments: 'update', pendencies: 'update', newRequests: 'hidden', reports: 'hidden', users: 'hidden', settings: 'update', financial: 'hidden' } };
                    await setDoc(userDocRef, defaultUserData);
                }
                setLoading(false);
                initialLoadComplete.current = true;
            }, (error) => {
                console.error("Erro ao ouvir perfil do usuário:", error);
                setLoading(false);
                signOut(auth);
            }));

            const settingsDocRef = doc(db, "settings", "default");
            unsubs.push(onSnapshot(settingsDocRef, (docSnap) => {
                const settingsData = docSnap.exists() ? { ...initialSettings, ...docSnap.data(), id: docSnap.id } : initialSettings;
                setSettings(settingsData);
            }));
            
            firestoreUnsubscribers.current = unsubs;
        } else {
            setUser(null);
            setUsers([]);
            setAppointments([]);
            setPendencies([]);
            setFinancials([]);
            setAccounts([]);
            setThirdParties([]);
            setLoading(false);
            initialLoadComplete.current = false;
        }
    });
  
    return () => {
      unsubAuth();
      firestoreUnsubscribers.current.forEach(unsub => unsub());
    };
  }, []);

  useEffect(() => {
    if (!user || (user.permissions.users === 'hidden' && !user.roles.includes('client'))) {
        setUsers([]); return;
    }
    let q;
    if (user.roles.includes('master') || user.roles.includes('admin')) {
      q = collection(db, "users");
    } else if (user.roles.includes('client')) {
      q = query(collection(db, "users"), where("roles", "array-contains-any", ["admin", "master"]));
    }
    if (!q) return;
    const unsub = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || user.permissions.appointments === 'hidden') {
      setAppointments([]); return;
    }
    let q: any;
    if (user.roles.includes('master') || user.roles.includes('admin')) {
        q = collection(db, "appointments");
    } else if (user.roles.includes('inspector')) {
        q = query(collection(db, "appointments"), where("inspectorId", "==", user.id));
    } else if (user.roles.includes('client') && user.requesterId) {
        const clientRequester = settings.requesters.find(r => r.id === user.requesterId);
        if (clientRequester) {
            q = query(collection(db, "appointments"), where("requester", "==", clientRequester.name));
        }
    }
    if (!q) { setAppointments([]); return; };
    const unsub = onSnapshot(q, (snapshot) => {
        setAppointments(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as Appointment)));
    });
    return () => unsub();
  }, [user, settings]);

  useEffect(() => {
    if (!user || user.permissions.pendencies === 'hidden') {
      setPendencies([]); return;
    }
    let q: any;
    if (user.roles.includes('master') || user.roles.includes('admin') || user.roles.includes('client')) {
        q = collection(db, "pendencies");
    } else if (user.roles.includes('inspector')) {
        q = query(collection(db, "pendencies"), where("responsibleId", "==", user.id));
    }
    if (!q) { setPendencies([]); return; };
    const unsub = onSnapshot(q, (snapshot) => {
        setPendencies(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as Pendency)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
      if (!user || user.permissions.financial === 'hidden') {
          setFinancials([]); setAccounts([]); setThirdParties([]); return;
      }
      const unsubs = [
          onSnapshot(collection(db, "financials"), (snapshot) => setFinancials(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as FinancialTransaction)))),
          onSnapshot(collection(db, "accounts"), (snapshot) => setAccounts(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as FinancialAccount)))),
          onSnapshot(collection(db, "thirdParties"), (snapshot) => setThirdParties(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as ThirdParty))))
      ];
      return () => unsubs.forEach(u => u());
  }, [user]);

  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      return { success: true, message: 'Login bem-sucedido!' };
    } catch (error: any) {
      return { success: false, message: 'E-mail ou senha inválidos.' };
    }
  };
  const logout = async () => { await signOut(auth); setActivePage('Agendamentos'); };
  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'E-mail de redefinição enviado!' };
    } catch (error: any) {
      return { success: false, message: 'Erro ao enviar e-mail.' };
    }
  };

  const triggerInstallPrompt = async () => {
    if (!installPromptEvent) {
        console.warn("PWA Diagnostic: Tentativa de instalação sem evento capturado. O botão não deveria estar visível.");
        return;
    }
    const promptEvent = installPromptEvent as any;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    console.info(`PWA Diagnostic: Escolha do usuário para instalação = ${outcome}`);
    setInstallPromptEvent(null);
  };

  const updateSettings = async (updatedSettings: Partial<Settings>) => {
    await setDoc(doc(db, "settings", "default"), updatedSettings, { merge: true });
  };
  const updateLogo = async (newLogoUrl: string | null) => { await updateSettings({ logoUrl: newLogoUrl }); };
  const addAppointment = async (appointment: Omit<Appointment, 'id' | 'stringId'>) => { await addDoc(collection(db, "appointments"), appointment); };
  const batchAddAppointments = async (appointmentsToAdd: Omit<Appointment, 'id' | 'stringId'>[]) => {
    const batch = writeBatch(db);
    appointmentsToAdd.forEach(app => batch.set(doc(collection(db, "appointments")), app));
    await batch.commit();
  };
  const updateAppointment = async (updatedAppointment: Appointment) => {
    if (!updatedAppointment.stringId) return;
    const { id, stringId, ...dataToUpdate } = updatedAppointment;
    await updateDoc(doc(db, "appointments", stringId), dataToUpdate);
  };
  const deleteAppointment = async (stringId: string) => { await deleteDoc(doc(db, "appointments", stringId)); };
  const batchDeleteAppointments = async (stringIds: string[]) => {
    const batch = writeBatch(db);
    stringIds.forEach(id => batch.delete(doc(db, "appointments", id)));
    await batch.commit();
  };
  const addMessageToAppointment = async (appointmentStringId: string, messageText: string) => {
    if (!user) return;
    const newMessage: Message = { authorId: user.id, authorName: user.name, text: messageText, timestamp: Date.now() };
    await updateDoc(doc(db, "appointments", appointmentStringId), { messages: arrayUnion(newMessage) });
  };
  const addPendency = async (pendency: Omit<Pendency, 'id' | 'stringId'>) => { await addDoc(collection(db, "pendencies"), pendency); };
  const updatePendency = async (updatedPendency: Pendency) => {
    if (!updatedPendency.stringId) return;
    const { id, stringId, ...dataToUpdate } = updatedPendency;
    await updateDoc(doc(db, "pendencies", stringId), dataToUpdate);
  };
  const deletePendency = async (stringId: string) => { await deleteDoc(doc(db, "pendencies", stringId)); };
  
  const addFinancial = async (transaction: Omit<FinancialTransaction, 'id' | 'stringId'>) => { await addDoc(collection(db, "financials"), transaction); };
  const updateFinancial = async (updatedTransaction: FinancialTransaction) => {
    if (!updatedTransaction.stringId) return;
    const { id, stringId, ...dataToUpdate } = updatedTransaction;
    await updateDoc(doc(db, "financials", stringId), dataToUpdate);
  };
  const deleteFinancial = async (stringId: string) => { await deleteDoc(doc(db, "financials", stringId)); };
  const addAccount = async (account: Omit<FinancialAccount, 'id' | 'stringId'>) => { await addDoc(collection(db, "accounts"), account); };
  const updateAccount = async (updatedAccount: FinancialAccount) => {
    if (!updatedAccount.stringId) return;
    const { id, stringId, ...dataToUpdate } = updatedAccount;
    await updateDoc(doc(db, "accounts", stringId), dataToUpdate);
  };
  const deleteAccount = async (stringId: string) => { await deleteDoc(doc(db, "accounts", stringId)); };
  const addThirdParty = async (thirdParty: Omit<ThirdParty, 'id' | 'stringId'>) => { await addDoc(collection(db, "thirdParties"), thirdParty); };
  const updateThirdParty = async (updatedThirdParty: ThirdParty) => {
    if (!updatedThirdParty.stringId) return;
    const { id, stringId, ...dataToUpdate } = updatedThirdParty;
    await updateDoc(doc(db, "thirdParties", stringId), dataToUpdate);
  };
  const deleteThirdParty = async (stringId: string) => { await deleteDoc(doc(db, "thirdParties", stringId)); };
  
  const addUser = async (userData: Omit<User, 'id'>) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, '123mudar');
      await setDoc(doc(db, "users", userCredential.user.uid), { ...userData, forcePasswordChange: true });
      await signOut(auth);
      return { success: true, message: `Usuário ${userData.name} criado com sucesso. A senha padrão é '123mudar'. O administrador será desconectado.` };
    } catch (error: any) {
      return { success: false, message: "Erro ao criar o usuário." };
    }
  };
  const updateUser = async (updatedUser: User) => {
    const { id, ...dataToUpdate } = updatedUser;
    await updateDoc(doc(db, "users", id), dataToUpdate as Partial<User>);
  };
  const updateUserPhoto = async (userId: string, photoURL: string) => { await updateDoc(doc(db, "users", userId), { photoURL }); };
  const deleteUser = async (id: string) => { await deleteDoc(doc(db, "users", id)); };
  const updatePassword = async (oldPass: string, newPass: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser?.email) return { success: false, message: 'Nenhum usuário logado.' };
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, oldPass);
      await reauthenticateWithCredential(firebaseUser, credential);
      await fbUpdatePassword(firebaseUser, newPass);
      await updateDoc(doc(db, "users", firebaseUser.uid), { forcePasswordChange: false });
      return { success: true, message: 'Senha atualizada com sucesso!' };
    } catch (error: any) {
      return { success: false, message: 'A senha atual está incorreta ou a nova é muito fraca.' };
    }
  };
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'E-mail de redefinição enviado!' };
    } catch (error: any) {
      return { success: false, message: 'Erro ao enviar e-mail.' };
    }
  };

  return (
    <AppContext.Provider value={{ 
        theme, toggleTheme, setTheme, themePalette, setThemePalette, textPalette, setTextPalette,
        user, users, appointments, pendencies, financials, accounts, thirdParties, settings, logo: settings.logoUrl || null, updateLogo, loading, isOnline,
        notification, clearNotification, triggerNotification, pageNotifications, clearPageNotification,
        installPromptEvent, triggerInstallPrompt, isUpdateAvailable, updateApp, isStandalone,
        login, logout, sendPasswordReset,
        activePage, setActivePage, activeFinancialPage, setActiveFinancialPage,
        addAppointment, updateAppointment, deleteAppointment, batchAddAppointments, batchDeleteAppointments, addMessageToAppointment,
        addPendency, updatePendency, deletePendency,
        addFinancial, updateFinancial, deleteFinancial,
        addAccount, updateAccount, deleteAccount,
        addThirdParty, updateThirdParty, deleteThirdParty,
        addUser, updateUser, updateUserPhoto, deleteUser, updatePassword, resetPassword,
        updateSettings
    }}>
      {children}
    </AppContext.Provider>
  );
};