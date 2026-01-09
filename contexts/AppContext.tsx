import React, { createContext, useState, useEffect, ReactNode, useRef } from 'react';
import { User, Appointment, Settings, Theme, ThemePalette, Pendency, SettingCategory, TextPalette, FinancialTransaction, FinancialPage, FinancialAccount, ThirdParty } from '../types.ts';
import { db, auth } from '../firebaseConfig.ts';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, query, where, writeBatch, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail, updatePassword as fbUpdatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { Page } from '../App.tsx';

// Define the shape of our context
export interface AppContextType {
  theme: Theme; toggleTheme: () => void; setTheme: (theme: Theme) => void;
  themePalette: ThemePalette; setThemePalette: (palette: ThemePalette) => void;
  textPalette: TextPalette; setTextPalette: (palette: TextPalette) => void;
  user: User | null; users: User[]; appointments: Appointment[]; pendencies: Pendency[];
  financials: FinancialTransaction[]; accounts: FinancialAccount[]; thirdParties: ThirdParty[];
  settings: Settings; logo: string | null; updateLogo: (logo: string | null) => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  loading: boolean; isOnline: boolean; notification: string | null; clearNotification: () => void;
  triggerNotification: (message?: string) => void; pageNotifications: Record<Page, boolean>; clearPageNotification: (page: Page) => void;
  installPromptEvent: any | null; triggerInstallPrompt: () => void; isUpdateAvailable: boolean; updateApp: () => void; isStandalone: boolean;
  repairPWA: () => Promise<{ success: boolean; message: string }>;
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void; sendPasswordReset: (email: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updatePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
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
  deleteUser: (userId: string) => Promise<void>;
}

// Create context
export const AppContext = createContext<AppContextType>({} as AppContextType);

// Create provider
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [themePalette, setThemePaletteState] = useState<ThemePalette>('blue');
  const [textPalette, setTextPaletteState] = useState<TextPalette>('gray');
  
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pendencies, setPendencies] = useState<Pendency[]>([]);
  const [financials, setFinancials] = useState<FinancialTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([]);
  
  const [settings, setSettings] = useState<Settings>({
    appName: 'GestorPRO',
    logoUrl: null,
    requesters: [],
    demands: [],
    inspectionTypes: [],
    patios: [],
    statuses: [],
    financialCategories: [],
    services: [],
    masterPassword: '123mudar'
  });
  const [logo, setLogo] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notification, setNotification] = useState<string | null>(null);
  const [pageNotifications, setPageNotifications] = useState<Record<Page, boolean>>({} as Record<Page, boolean>);
  
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  const [activeFinancialPage, setActiveFinancialPage] = useState<FinancialPage>('Dashboard');
  
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(window.matchMedia('(display-mode: standalone)').matches);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const savedPalette = localStorage.getItem('themePalette') as ThemePalette;
    const savedText = localStorage.getItem('textPalette') as TextPalette;
    if (savedTheme) setThemeState(savedTheme);
    if (savedPalette) setThemePaletteState(savedPalette);
    if (savedText) setTextPaletteState(savedText);
    
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };
  
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const setThemePalette = (p: ThemePalette) => {
    setThemePaletteState(p);
    localStorage.setItem('themePalette', p);
  };

  const setTextPalette = (p: TextPalette) => {
    setTextPaletteState(p);
    localStorage.setItem('textPalette', p);
  };

  // Notification management
  const triggerNotification = (message: string = 'Ação concluída com sucesso.') => setNotification(message);
  const clearNotification = () => setNotification(null);
  const clearPageNotification = (page: Page) => setPageNotifications(prev => ({ ...prev, [page]: false }));

  // Auth and data sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUser({ id: docSnap.id, ...docSnap.data() } as User);
          } else {
            // Default user doc if it doesn't exist (initial state for first admin)
            const defaultUser: User = { 
                id: fbUser.uid, 
                name: fbUser.displayName || 'Usuário', 
                email: fbUser.email || '', 
                roles: ['master'], 
                permissions: { dashboard: 'edit', appointments: 'edit', pendencies: 'edit', newRequests: 'edit', reports: 'edit', users: 'edit', settings: 'edit', financial: 'edit' } 
            };
            setUser(defaultUser);
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });
    
    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snapshot) => {
      setAppointments(snapshot.docs.map((doc, index) => ({ id: index, stringId: doc.id, ...doc.data() } as Appointment)));
    });

    const unsubPendencies = onSnapshot(collection(db, 'pendencies'), (snapshot) => {
      setPendencies(snapshot.docs.map((doc, index) => ({ id: index, stringId: doc.id, ...doc.data() } as Pendency)));
    });

    const unsubFinancials = onSnapshot(collection(db, 'financials'), (snapshot) => {
      setFinancials(snapshot.docs.map((doc, index) => ({ id: index, stringId: doc.id, ...doc.data() } as FinancialTransaction)));
    });

    const unsubAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      setAccounts(snapshot.docs.map((doc, index) => ({ id: index, stringId: doc.id, ...doc.data() } as FinancialAccount)));
    });

    const unsubThirdParties = onSnapshot(collection(db, 'thirdParties'), (snapshot) => {
      setThirdParties(snapshot.docs.map((doc, index) => ({ id: index, stringId: doc.id, ...doc.data() } as ThirdParty)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Settings;
        setSettings(data);
        setLogo(data.logoUrl);
      }
    });

    return () => {
      unsubUsers(); unsubAppointments(); unsubPendencies(); unsubFinancials();
      unsubAccounts(); unsubThirdParties(); unsubSettings();
    };
  }, [user]);

  // App Environment / PWA
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    });
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'UPDATE_AVAILABLE') {
          setIsUpdateAvailable(true);
        }
      });
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerInstallPrompt = () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      installPromptEvent.userChoice.then(() => setInstallPromptEvent(null));
    }
  };

  const updateApp = () => window.location.reload();
  
  const repairPWA = async () => {
     try {
       if ('serviceWorker' in navigator) {
         const registrations = await navigator.serviceWorker.getRegistrations();
         for(let registration of registrations) { await registration.unregister(); }
       }
       if ('caches' in window) {
         const keys = await caches.keys();
         for(let key of keys) { await caches.delete(key); }
       }
       localStorage.clear();
       return { success: true, message: "PWA reparado. O sistema será reiniciado." };
     } catch (e: any) {
       return { success: false, message: "Erro ao reparar: " + e.message };
     }
  };

  // Auth Functions
  const login = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      return { success: true, message: 'Sucesso' };
    } catch (e: any) {
      return { success: false, message: 'Erro ao entrar: ' + e.message };
    }
  };

  const logout = () => signOut(auth);

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'E-mail de recuperação enviado.' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const updatePassword = async (oldPass: string, newPass: string) => {
    if (!auth.currentUser || !auth.currentUser.email) return { success: false, message: 'Usuário não autenticado.' };
    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPass);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await fbUpdatePassword(auth.currentUser, newPass);
        if (user) {
            await updateDoc(doc(db, 'users', user.id), { forcePasswordChange: false });
        }
        return { success: true, message: 'Senha atualizada com sucesso!' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  };

  // CRUD Functions
  const addAppointment = async (app: Omit<Appointment, 'id' | 'stringId'>) => {
    await addDoc(collection(db, 'appointments'), app);
    triggerNotification('Vistoria agendada com sucesso!');
  };
  const updateAppointment = async (app: Appointment) => {
    const { id, stringId, ...data } = app;
    await updateDoc(doc(db, 'appointments', stringId!), data);
    triggerNotification('Vistoria atualizada!');
  };
  const deleteAppointment = async (stringId: string) => {
    await deleteDoc(doc(db, 'appointments', stringId));
    triggerNotification('Agendamento removido.');
  };
  const batchAddAppointments = async (apps: Omit<Appointment, 'id' | 'stringId'>[]) => {
    const batch = writeBatch(db);
    apps.forEach(app => {
      const docRef = doc(collection(db, 'appointments'));
      batch.set(docRef, app);
    });
    await batch.commit();
    triggerNotification(`${apps.length} agendamentos criados.`);
  };
  const batchDeleteAppointments = async (stringIds: string[]) => {
    const batch = writeBatch(db);
    stringIds.forEach(id => batch.delete(doc(db, 'appointments', id)));
    await batch.commit();
    triggerNotification(`${stringIds.length} agendamentos removidos.`);
  };
  const addMessageToAppointment = async (appointmentStringId: string, messageText: string) => {
    if (!user) return;
    const message = { authorId: user.id, authorName: user.name, text: messageText, timestamp: Date.now() };
    await updateDoc(doc(db, 'appointments', appointmentStringId), { messages: arrayUnion(message) });
  };

  const addPendency = async (p: Omit<Pendency, 'id' | 'stringId'>) => {
    await addDoc(collection(db, 'pendencies'), p);
    triggerNotification('Pendência registrada.');
  };
  const updatePendency = async (p: Pendency) => {
    const { id, stringId, ...data } = p;
    await updateDoc(doc(db, 'pendencies', stringId!), data);
    triggerNotification('Pendência atualizada.');
  };
  const deletePendency = async (stringId: string) => {
    await deleteDoc(doc(db, 'pendencies', stringId));
    triggerNotification('Pendência removida.');
  };

  const addFinancial = async (t: Omit<FinancialTransaction, 'id' | 'stringId'>) => {
    await addDoc(collection(db, 'financials'), t);
    triggerNotification('Transação financeira registrada.');
  };
  const updateFinancial = async (t: FinancialTransaction) => {
    const { id, stringId, ...data } = t;
    await updateDoc(doc(db, 'financials', stringId!), data);
    triggerNotification('Transação atualizada.');
  };
  const deleteFinancial = async (stringId: string) => {
    await deleteDoc(doc(db, 'financials', stringId));
    triggerNotification('Transação removida.');
  };

  const addAccount = async (acc: Omit<FinancialAccount, 'id' | 'stringId'>) => {
    await addDoc(collection(db, 'accounts'), acc);
    triggerNotification('Conta cadastrada.');
  };
  const updateAccount = async (acc: FinancialAccount) => {
    const { id, stringId, ...data } = acc;
    await updateDoc(doc(db, 'accounts', stringId!), data);
    triggerNotification('Conta atualizada.');
  };
  const deleteAccount = async (stringId: string) => {
    await deleteDoc(doc(db, 'accounts', stringId));
    triggerNotification('Conta removida.');
  };

  const addThirdParty = async (tp: Omit<ThirdParty, 'id' | 'stringId'>) => {
    await addDoc(collection(db, 'thirdParties'), tp);
    triggerNotification('Cliente/Fornecedor registrado.');
  };
  const updateThirdParty = async (tp: ThirdParty) => {
    const { id, stringId, ...data } = tp;
    await updateDoc(doc(db, 'thirdParties', stringId!), data);
    triggerNotification('Registro atualizado.');
  };
  const deleteThirdParty = async (stringId: string) => {
    await deleteDoc(doc(db, 'thirdParties', stringId));
    triggerNotification('Registro removido.');
  };

  const addUser = async (userData: Omit<User, 'id'>) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, userData.email, '123mudar');
      await setDoc(doc(db, 'users', credential.user.uid), { ...userData, forcePasswordChange: true });
      return { success: true, message: 'Usuário criado com sucesso. Você foi desconectado para segurança.' };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };
  const updateUser = async (u: User) => {
    const { id, ...data } = u;
    await updateDoc(doc(db, 'users', id), data);
    triggerNotification('Perfil de usuário atualizado.');
  };
  const updateUserPhoto = async (userId: string, photoURL: string) => {
    await updateDoc(doc(db, 'users', userId), { photoURL });
  };
  const deleteUser = async (userId: string) => {
    await deleteDoc(doc(db, 'users', userId));
    triggerNotification('Usuário removido do sistema.');
  };

  const updateLogo = async (newLogo: string | null) => {
    await updateDoc(doc(db, 'settings', 'general'), { logoUrl: newLogo });
    setLogo(newLogo);
  };
  const updateSettings = async (newSettings: Partial<Settings>) => {
    await setDoc(doc(db, 'settings', 'general'), newSettings, { merge: true });
    triggerNotification('Configurações salvas.');
  };

  const value: AppContextType = {
    theme, toggleTheme, setTheme, themePalette, setThemePalette, textPalette, setTextPalette,
    user, users, appointments, pendencies, financials, accounts, thirdParties, settings, logo, updateLogo, updateSettings,
    loading, isOnline, notification, clearNotification, triggerNotification, pageNotifications, clearPageNotification,
    installPromptEvent, triggerInstallPrompt, isUpdateAvailable, updateApp, isStandalone, repairPWA,
    login, logout, sendPasswordReset, resetPassword: sendPasswordReset, updatePassword,
    activePage, setActivePage, activeFinancialPage, setActiveFinancialPage,
    addAppointment, updateAppointment, deleteAppointment, batchAddAppointments, batchDeleteAppointments, addMessageToAppointment,
    addPendency, updatePendency, deletePendency,
    addFinancial, updateFinancial, deleteFinancial,
    addAccount, updateAccount, deleteAccount,
    addThirdParty, updateThirdParty, deleteThirdParty,
    addUser, updateUser, updateUserPhoto, deleteUser
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
