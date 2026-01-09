import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, Appointment, Settings, Theme, ThemePalette, Pendency, SettingCategory, TextPalette, FinancialTransaction, FinancialPage, FinancialAccount, ThirdParty } from '../types.ts';
import { db, auth } from '../firebaseConfig.ts';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, arrayUnion, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail, updatePassword as fbUpdatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { Page } from '../App.tsx';

interface AppContextType {
  theme: Theme; toggleTheme: () => void; setTheme: (theme: Theme) => void;
  themePalette: ThemePalette; setThemePalette: (palette: ThemePalette) => void;
  textPalette: TextPalette; setTextPalette: (palette: TextPalette) => void;
  user: User | null; users: User[]; appointments: Appointment[]; pendencies: Pendency[];
  financials: FinancialTransaction[]; accounts: FinancialAccount[]; thirdParties: ThirdParty[];
  settings: Settings; logo: string | null; updateLogo: (logo: string | null) => Promise<void>;
  loading: boolean; isOnline: boolean; notification: string | null; clearNotification: () => void;
  triggerNotification: (message?: string) => void; pageNotifications: Record<Page, boolean>; clearPageNotification: (page: Page) => void;
  installPromptEvent: Event | null; triggerInstallPrompt: () => void; isUpdateAvailable: boolean; updateApp: () => void; isStandalone: boolean;
  repairPWA: () => Promise<{ success: boolean; message: string }>;
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void; sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  activePage: Page; setActivePage: (page: Page) => void;
  activeFinancialPage: FinancialPage; setActiveFinancialPage: (page: FinancialPage) => void;
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

const initialSettings: Settings = {
    appName: 'GestorPRO', logoUrl: null, requesters: [], demands: [], inspectionTypes: [], patios: [], 
    statuses: [{ id: '1', name: 'Solicitado' }, { id: '2', name: 'Agendado' }, { id: '3', name: 'Em Andamento' }, { id: '4', name: 'Concluído' }, { id: '5', name: 'Pendente' }, { id: '6', name: 'Finalizado' }],
    financialCategories: [], services: [], enableSoundAlert: true, enableVibrationAlert: true, masterPassword: '002219',
};

const initialPageNotifications: Record<Page, boolean> = {
    'Dashboard': false, 'Agendamentos': false, 'Pendências': false, 'Novas Solicitações': false,
    'Relatórios': false, 'Usuários': false, 'Configurações': false, 'Meu Perfil': false, 'Financeiro': false
};

export const AppContext = createContext<AppContextType>({} as any);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
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
  
  const firestoreUnsubscribers = useRef<(() => void)[]>([]);
  
  useEffect(() => { document.documentElement.className = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.palette = themePalette; localStorage.setItem('themePalette', themePalette); }, [themePalette]);
  useEffect(() => { document.documentElement.dataset.textPalette = textPalette; localStorage.setItem('textPalette', textPalette); }, [textPalette]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const checkStandalone = () => {
        setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone);
    };
    checkStandalone();
    
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    const isSandbox = window.location.protocol === 'blob:';

    if (!isSandbox && isSecure && 'serviceWorker' in navigator) {
        // Registro limpo com type: module
        navigator.serviceWorker.register('/sw.js', { scope: '/', type: 'module' })
            .then(registration => {
                setSwRegistration(registration);
                console.info("PWA: Service Worker ativo.");
                registration.onupdatefound = () => {
                    const worker = registration.installing;
                    if (worker) worker.onstatechange = () => {
                        if (worker.state === 'installed' && navigator.serviceWorker.controller) setIsUpdateAvailable(true);
                    };
                };
            }).catch(err => {
                console.error("PWA: Falha crítica ao registrar SW:", err.message);
            });
    }

    const handlePrompt = (e: Event) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const repairPWA = async () => {
      console.info("Reparo de PWA: Limpando registros e caches...");
      try {
          if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                  await registration.unregister();
              }
              // Força o registro novamente com um pequeno cache-buster apenas no reparo
              const swUrl = `/sw.js?repair=${Date.now()}`;
              const newRegistration = await navigator.serviceWorker.register(swUrl, { scope: '/', type: 'module' });
              setSwRegistration(newRegistration);
          }
          if ('caches' in window) {
              const keys = await caches.keys();
              for (const key of keys) { await caches.delete(key); }
          }
          return { success: true, message: "PWA reparado! O sistema foi limpo e o registro do Service Worker foi reiniciado. Recarregue a página." };
      } catch (err: any) {
          return { success: false, message: `Erro no reparo: ${err.message}` };
      }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        firestoreUnsubscribers.current.forEach(u => u());
        firestoreUnsubscribers.current = [];
        if (firebaseUser) {
            setLoading(true);
            const userDocRef = doc(db, "users", firebaseUser.uid);
            firestoreUnsubscribers.current.push(onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) setUser({ id: doc.id, ...doc.data() } as User);
                setLoading(false);
            }));
            firestoreUnsubscribers.current.push(onSnapshot(doc(db, "settings", "default"), (doc) => {
                if (doc.exists()) setSettings({ ...initialSettings, ...doc.data(), id: doc.id });
            }));
        } else {
            setUser(null); setLoading(false);
        }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribers = [
        onSnapshot(collection(db, "users"), (s) => setUsers(s.docs.map(d => ({id: d.id, ...d.data()} as User)))),
        onSnapshot(collection(db, "appointments"), (s) => setAppointments(s.docs.map((d, i) => ({id: i, stringId: d.id, ...d.data()} as Appointment)))),
        onSnapshot(collection(db, "pendencies"), (s) => setPendencies(s.docs.map((d, i) => ({id: i, stringId: d.id, ...d.data()} as Pendency)))),
        onSnapshot(collection(db, "financials"), (s) => setFinancials(s.docs.map((d, i) => ({id: i, stringId: d.id, ...d.data()} as FinancialTransaction)))),
        onSnapshot(collection(db, "accounts"), (s) => setAccounts(s.docs.map((d, i) => ({id: i, stringId: d.id, ...d.data()} as FinancialAccount)))),
        onSnapshot(collection(db, "thirdParties"), (s) => setThirdParties(s.docs.map((d, i) => ({id: i, stringId: d.id, ...d.data()} as ThirdParty))))
    ];
    return () => unsubscribers.forEach(u => u());
  }, [user]);

  const login = async (e: string, p: string) => {
    try { await signInWithEmailAndPassword(auth, e, p); return { success: true, message: '' }; }
    catch (err) { return { success: false, message: 'Falha no login.' }; }
  };
  const logout = () => signOut(auth);
  const triggerInstallPrompt = async () => {
    if (installPromptEvent) {
        (installPromptEvent as any).prompt();
        setInstallPromptEvent(null);
    }
  };

  const addAppointment = async (a: any) => { await addDoc(collection(db, "appointments"), a); };
  const updateAppointment = async (a: Appointment) => { const {id, stringId, ...data} = a; await updateDoc(doc(db, "appointments", stringId!), data); };
  const deleteAppointment = async (id: string) => { await deleteDoc(doc(db, "appointments", id)); };
  const updateSettings = async (s: any) => { await setDoc(doc(db, "settings", "default"), s, { merge: true }); };

  return (
    <AppContext.Provider value={{ 
        theme, toggleTheme, setTheme, themePalette, setThemePalette, textPalette, setTextPalette,
        user, users, appointments, pendencies, financials, accounts, thirdParties, settings, logo: settings.logoUrl || null,
        loading, isOnline, notification, clearNotification: () => setNotification(null), triggerNotification: (m) => setNotification(m || "Atualizado"),
        pageNotifications, clearPageNotification: (p) => setPageNotifications(prev => ({...prev, [p]: false})),
        installPromptEvent, triggerInstallPrompt, isUpdateAvailable, updateApp: () => swRegistration?.waiting?.postMessage({type: 'SKIP_WAITING'}), isStandalone,
        repairPWA,
        login, logout, sendPasswordReset: async (e) => { try { await sendPasswordResetEmail(auth, e); return {success:true, message:'Email enviado'}; } catch(err) {return {success:false, message:'Erro'};} },
        activePage, setActivePage, activeFinancialPage: 'Dashboard', setActiveFinancialPage: () => {},
        addAppointment, updateAppointment, deleteAppointment, 
        batchAddAppointments: async (as) => { const b = writeBatch(db); as.forEach(a => b.set(doc(collection(db, "appointments")), a)); await b.commit(); },
        batchDeleteAppointments: async (ids) => { const b = writeBatch(db); ids.forEach(id => b.delete(doc(db, "appointments", id))); await b.commit(); },
        addMessageToAppointment: async (id, t) => { await updateDoc(doc(db, "appointments", id), { messages: arrayUnion({ authorId: user?.id, authorName: user?.name, text: t, timestamp: Date.now() }) }); },
        addPendency: async (p) => { await addDoc(collection(db, "pendencies"), p); },
        updatePendency: async (p) => { const {id, stringId, ...data} = p; await updateDoc(doc(db, "pendencies", stringId!), data); },
        deletePendency: async (id) => { await deleteDoc(doc(db, "pendencies", id)); },
        addFinancial: async (f) => { await addDoc(collection(db, "financials"), f); },
        updateFinancial: async (f) => { const {id, stringId, ...data} = f; await updateDoc(doc(db, "financials", stringId!), data); },
        deleteFinancial: async (id) => { await deleteDoc(doc(db, "financials", id)); },
        addAccount: async (a) => { await addDoc(collection(db, "accounts"), a); },
        updateAccount: async (a) => { const {id, stringId, ...data} = a; await updateDoc(doc(db, "accounts", stringId!), data); },
        deleteAccount: async (id) => { await deleteDoc(doc(db, "accounts", id)); },
        addThirdParty: async (tp) => { await addDoc(collection(db, "thirdParties"), tp); },
        updateThirdParty: async (tp) => { const {id, stringId, ...data} = tp; await updateDoc(doc(db, "thirdParties", stringId!), data); },
        deleteThirdParty: async (id) => { await deleteDoc(doc(db, "thirdParties", id)); },
        addUser: async (u) => { try { const res = await createUserWithEmailAndPassword(auth, u.email, '123mudar'); await setDoc(doc(db, "users", res.user.uid), {...u, forcePasswordChange:true}); return {success:true, message:'Criado'}; } catch(e){return {success:false, message:'Erro'};} },
        updateUser: async (u) => { const {id, ...data} = u; await updateDoc(doc(db, "users", id), data); },
        updateUserPhoto: async (id, url) => { await updateDoc(doc(db, "users", url), { photoURL: url }); },
        deleteUser: async (id) => { await deleteDoc(doc(db, "users", id)); },
        updatePassword: async (o, n) => { try { await fbUpdatePassword(auth.currentUser!, n); return {success:true, message:'OK'}; } catch(e){return {success:false, message:'Erro'};} },
        resetPassword: async (e) => { try { await sendPasswordResetEmail(auth, e); return {success:true, message:'OK'}; } catch(e){return {success:false, message:'Erro'};} },
        updateSettings, updateLogo: async (l) => updateSettings({logoUrl: l})
    }}>
      {children}
    </AppContext.Provider>
  );
};