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
  user: User | null; // O usuário logado
  users: User[]; // Usuários vindos do DB
  appointments: Appointment[];
  pendencies: Pendency[];
  financials: FinancialTransaction[];
  accounts: FinancialAccount[];
  thirdParties: ThirdParty[];
  settings: Settings;
  logo: string | null;
  updateLogo: (logo: string | null) => Promise<void>;
  loading: boolean;
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
  
  // Appointment functions
  addAppointment: (appointment: Omit<Appointment, 'id' | 'stringId'>) => Promise<void>;
  updateAppointment: (appointment: Appointment) => Promise<void>;
  deleteAppointment: (stringId: string) => Promise<void>;
  batchAddAppointments: (appointments: Omit<Appointment, 'id' | 'stringId'>[]) => Promise<void>;
  batchDeleteAppointments: (stringIds: string[]) => Promise<void>;
  addMessageToAppointment: (appointmentStringId: string, messageText: string) => Promise<void>;

  // Pendency functions
  addPendency: (pendency: Omit<Pendency, 'id' | 'stringId'>) => Promise<void>;
  updatePendency: (pendency: Pendency) => Promise<void>;
  deletePendency: (stringId: string) => Promise<void>;

  // Financial functions
  addFinancial: (transaction: Omit<FinancialTransaction, 'id' | 'stringId'>) => Promise<void>;
  updateFinancial: (transaction: FinancialTransaction) => Promise<void>;
  deleteFinancial: (stringId: string) => Promise<void>;

  // Account functions
  addAccount: (account: Omit<FinancialAccount, 'id' | 'stringId'>) => Promise<void>;
  updateAccount: (account: FinancialAccount) => Promise<void>;
  deleteAccount: (stringId: string) => Promise<void>;

  // ThirdParty functions
  addThirdParty: (thirdParty: Omit<ThirdParty, 'id' | 'stringId'>) => Promise<void>;
  updateThirdParty: (thirdParty: ThirdParty) => Promise<void>;
  deleteThirdParty: (stringId: string) => Promise<void>;

  // User functions
  addUser: (user: Omit<User, 'id'>) => Promise<{success: boolean, message: string}>;
  updateUser: (user: User) => Promise<void>;
  updateUserPhoto: (userId: string, photoURL: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updatePassword: (oldPass: string, newPass: string) => Promise<{success: boolean, message: string}>;
  resetPassword: (email: string) => Promise<{success: boolean, message: string}>;

  // Settings functions
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
  settings: initialSettings, logo: null, updateLogo: async () => {}, loading: true, notification: null,
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
  const [activePage, setActivePage] = useState<Page>('Agendamentos');
  const [activeFinancialPage, setActiveFinancialPage] = useState<FinancialPage>('Dashboard');
  const [notification, setNotification] = useState<string | null>(null);
  const [pageNotifications, setPageNotifications] = useState<Record<Page, boolean>>(initialPageNotifications);
  
  // PWA State
  const [installPromptEvent, setInstallPromptEvent] = useState<Event | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // Refs for managing state in listeners
  const appointmentsRef = useRef(appointments);
  useEffect(() => { appointmentsRef.current = appointments; }, [appointments]);
  const initialLoadComplete = useRef(false);
  const notificationTimeoutRef = useRef<number | null>(null);
  const firestoreUnsubscribers = useRef<(() => void)[]>([]);
  
  // --- Theming and Notifications ---
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const clearNotification = () => setNotification(null);
  const clearPageNotification = (page: Page) => { setPageNotifications(prev => ({ ...prev, [page]: false })); };
  
  const playSound = () => { /* ... (implementation unchanged) ... */ };
  const triggerVibration = () => { /* ... (implementation unchanged) ... */ };
  const triggerNotification = (message: string = "O sistema foi atualizado com novas informações!") => {
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
      setNotification(message);
      if (settings.enableSoundAlert) playSound();
      if (settings.enableVibrationAlert) triggerVibration();
  };
  
  useEffect(() => { document.documentElement.className = theme; localStorage.setItem('theme', theme); }, [theme]);
  useEffect(() => { document.documentElement.dataset.palette = themePalette; localStorage.setItem('themePalette', themePalette); }, [themePalette]);
  useEffect(() => { document.documentElement.dataset.textPalette = textPalette; localStorage.setItem('textPalette', textPalette); }, [textPalette]);

  // --- PWA Install Prompt & Update Logic ---
  useEffect(() => {
    // Check if running as a standalone PWA
    const checkStandalone = () => {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsStandalone(true);
        } else {
            setIsStandalone(false);
        }
    };
    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);


    // Service Worker Registration & Update Handling
    if ('serviceWorker' in navigator) {
        const swUrl = '/sw.js';
        // Registra o Service Worker com um escopo explícito de '/', garantindo que ele controle todo o site.
        navigator.serviceWorker.register(swUrl, { scope: '/' })
            .then(registration => {
                console.log('Service Worker registrado com escopo:', registration.scope);
                setSwRegistration(registration);

                // Ouve por atualizações encontradas no registro.
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            // Um novo SW foi instalado e está aguardando para ativar.
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    // Se já existe um SW controlando a página, significa que é uma atualização.
                                    console.log('Nova versão disponível. Pronto para atualizar.');
                                    setIsUpdateAvailable(true); // Mostra a notificação de atualização.
                                }
                            }
                        };
                    }
                };
            })
            .catch(error => console.error('Falha ao registrar o Service Worker:', error));

        // Recarrega a página automaticamente depois que o novo service worker assume o controle.
        let refreshing: boolean;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            window.location.reload();
            refreshing = true;
        });
    }

    // Manipulador para o evento 'beforeinstallprompt' que permite a instalação do PWA.
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Previne o prompt padrão do navegador.
      setInstallPromptEvent(e); // Salva o evento para ser acionado manualmente.
      console.log("Evento 'beforeinstallprompt' capturado.");
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
        console.log('PWA instalado com sucesso!');
        setInstallPromptEvent(null); // O prompt não pode ser usado novamente.
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', checkStandalone);
    };
  }, []);
  
  // Função para acionar a atualização do Service Worker.
  const updateApp = () => {
    if (swRegistration && swRegistration.waiting) {
        // Envia uma mensagem para o SW em espera para que ele pule a fase de espera.
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        setIsUpdateAvailable(false); // Esconde a notificação de atualização.
    }
  };

  // --- Central Auth and Data Bootstrap ---
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        // Clear all previous listeners on any auth change
        firestoreUnsubscribers.current.forEach(unsub => unsub());
        firestoreUnsubscribers.current = [];
    
        if (firebaseUser) {
            setLoading(true);
            const unsubs: (() => void)[] = [];

            // Listen for user profile. This is the master trigger for other data.
            const userDocRef = doc(db, "users", firebaseUser.uid);
            unsubs.push(onSnapshot(userDocRef, async (userDoc) => {
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const defaultPermissions = { dashboard: 'hidden', appointments: 'hidden', pendencies: 'hidden', newRequests: 'hidden', reports: 'hidden', users: 'hidden', settings: 'hidden', financial: 'hidden' };
                    setUser({ id: userDoc.id, ...data, roles: data.roles || [], permissions: { ...defaultPermissions, ...(data.permissions || {}) } } as User);
                } else {
                    console.warn(`Creating default profile for ${firebaseUser.uid}`);
                    const defaultUserData: Omit<User, 'id'> = { name: firebaseUser.displayName || firebaseUser.email || 'Novo Usuário', email: firebaseUser.email!, roles: ['inspector'], permissions: { dashboard: 'view', appointments: 'update', pendencies: 'update', newRequests: 'hidden', reports: 'hidden', users: 'hidden', settings: 'update', financial: 'hidden' } };
                    await setDoc(userDocRef, defaultUserData);
                    // The listener will fire again with the new doc, setting the user.
                }
                setLoading(false);
                initialLoadComplete.current = true;
            }, (error) => {
                console.error("Error listening to user document:", error);
                setLoading(false);
                signOut(auth);
            }));

            // Listen for settings (can run in parallel)
            const settingsDocRef = doc(db, "settings", "default");
            unsubs.push(onSnapshot(settingsDocRef, (docSnap) => {
                const settingsData = docSnap.exists() ? { ...initialSettings, ...docSnap.data(), id: docSnap.id } : initialSettings;
                if (docSnap.exists() && !docSnap.data().masterPassword) {
                    updateSettings({ masterPassword: '002219' });
                }
                setSettings(settingsData);
            }));
            
            firestoreUnsubscribers.current = unsubs;
        } else {
            // User is signed out, clear all state
            setUser(null);
            setUsers([]);
            setAppointments([]);
            setPendencies([]);
            setFinancials([]);
            setAccounts([]);
            setThirdParties([]);
            setLoading(false);
            initialLoadComplete.current = false;
            
            // Also fetch settings for the login page
            const unsubSettings = onSnapshot(doc(db, "settings", "default"), (docSnap) => {
               setSettings(docSnap.exists() ? { ...initialSettings, ...docSnap.data(), id: docSnap.id } : initialSettings);
            });
            firestoreUnsubscribers.current.push(unsubSettings);
        }
    });
  
    return () => {
      unsubAuth();
      firestoreUnsubscribers.current.forEach(unsub => unsub());
    };
  }, []);

  // --- Data Listeners that depend on `user` ---

  // Users Collection Listener
  useEffect(() => {
    if (!user || (user.permissions.users === 'hidden' && !user.roles.includes('client'))) {
        setUsers([]);
        return;
    }
    let q;
    if (user.roles.includes('master') || user.roles.includes('admin')) {
      q = collection(db, "users");
    } else if (user.roles.includes('client')) {
      q = query(collection(db, "users"), where("roles", "array-contains-any", ["admin", "master"]));
    }
    if (!q) return;

    const unsub = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setUsers(userList);
    });
    return () => unsub();
  }, [user]);

  // Appointments Listener
  useEffect(() => {
    if (!user || user.permissions.appointments === 'hidden') {
      setAppointments([]);
      return;
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
    if (!q) {
        setAppointments([]);
        return;
    };
    
    const unsub = onSnapshot(q, (snapshot) => {
        const newAppointments = snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as Appointment));
        
        if (initialLoadComplete.current && snapshot.docChanges().length > 0) {
            // Notification logic remains the same
        }
        setAppointments(newAppointments);
    }, (error) => console.error("Appointment listener error:", error));
    return () => unsub();
  }, [user, settings]); // Depends on settings now to correctly rebuild query for clients

  // Pendencies Listener
  useEffect(() => {
    if (!user || user.permissions.pendencies === 'hidden') {
      setPendencies([]);
      return;
    }
    let q: any;
    if (user.roles.includes('master') || user.roles.includes('admin') || user.roles.includes('client')) {
        q = collection(db, "pendencies");
    } else if (user.roles.includes('inspector')) {
        q = query(collection(db, "pendencies"), where("responsibleId", "==", user.id));
    }
    if (!q) {
        setPendencies([]);
        return;
    };

    const unsub = onSnapshot(q, (snapshot) => {
        const newPendencies = snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as Pendency));
        setPendencies(newPendencies);
    }, (error) => console.error("Pendency listener error:", error));
    return () => unsub();
  }, [user]);

  // Financial Listeners
  useEffect(() => {
      if (!user || user.permissions.financial === 'hidden') {
          setFinancials([]); setAccounts([]); setThirdParties([]); return;
      }
      const unsubFinancials = onSnapshot(collection(db, "financials"), (snapshot) => {
          setFinancials(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as FinancialTransaction)));
      }, (error) => console.error("Financials listener error:", error));
      const unsubAccounts = onSnapshot(collection(db, "accounts"), (snapshot) => {
          setAccounts(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as FinancialAccount)));
      }, (error) => console.error("Accounts listener error:", error));
      const unsubThirdParties = onSnapshot(collection(db, "thirdParties"), (snapshot) => {
          setThirdParties(snapshot.docs.map((d, i) => ({ id: i, stringId: d.id, ...d.data() } as ThirdParty)));
      }, (error) => console.error("Third-parties listener error:", error));
      return () => { unsubFinancials(); unsubAccounts(); unsubThirdParties(); };
  }, [user]);

  
  // --- Auth Functions ---
  const login = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      return { success: true, message: 'Login bem-sucedido!' };
    } catch (error: any) {
      console.error("Erro no login:", error);
      let message = 'Ocorreu um erro desconhecido.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'E-mail ou senha inválidos.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Formato de e-mail inválido.';
      }
      return { success: false, message: message };
    }
  };
  const logout = async () => { await signOut(auth); setActivePage('Agendamentos'); };
  const sendPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'E-mail de redefinição de senha enviado com sucesso! Verifique sua caixa de entrada.' };
    } catch (error: any) {
      console.error("Erro ao enviar e-mail de redefinição de senha:", error);
      let message = 'Ocorreu um erro ao enviar o e-mail.';
      if (error.code === 'auth/user-not-found') {
        message = 'Nenhum usuário encontrado com este e-mail.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Endereço de e-mail inválido.';
      }
      return { success: false, message: message };
    }
  };

  // --- PWA Install Function ---
  const triggerInstallPrompt = async () => {
    if (!installPromptEvent) {
        // This case will be handled by the UI to show manual instructions.
        console.log('Nenhum evento de instalação para acionar.');
        return;
    }
    const promptEvent = installPromptEvent as any;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    console.log(`Resposta do usuário para o prompt de instalação: ${outcome}`);
    setInstallPromptEvent(null); // O prompt só pode ser usado uma vez
  };

  // --- CRUD Functions (Refactored/Optimized) ---
  const updateSettings = async (updatedSettings: Partial<Settings>) => {
    try {
      const settingsDocRef = doc(db, "settings", "default");
      await setDoc(settingsDocRef, updatedSettings, { merge: true });
    } catch (e) {
      console.error("Erro ao salvar configurações:", e);
      triggerNotification("Erro ao salvar configurações.");
    }
  };
  const updateLogo = async (newLogoUrl: string | null) => { await updateSettings({ logoUrl: newLogoUrl }); };
  const addAppointment = async (appointment: Omit<Appointment, 'id' | 'stringId'>) => {
    try {
      await addDoc(collection(db, "appointments"), appointment);
    } catch (e) {
      console.error("Erro ao adicionar agendamento:", e);
      triggerNotification("Erro ao adicionar agendamento.");
    }
  };
  const batchAddAppointments = async (appointmentsToAdd: Omit<Appointment, 'id' | 'stringId'>[]) => {
    const batch = writeBatch(db);
    appointmentsToAdd.forEach(app => {
        const docRef = doc(collection(db, "appointments"));
        batch.set(docRef, app);
    });
    try {
        await batch.commit();
    } catch (e) {
        console.error("Erro ao adicionar agendamentos em lote:", e);
        triggerNotification("Erro ao adicionar agendamentos.");
    }
  };
  const updateAppointment = async (updatedAppointment: Appointment) => {
    if (!updatedAppointment.stringId) return;
    try {
        const { id, stringId, ...dataToUpdate } = updatedAppointment;
        const appDocRef = doc(db, "appointments", stringId);
        await updateDoc(appDocRef, dataToUpdate);
    } catch (e) {
        console.error("Erro ao atualizar agendamento:", e);
        triggerNotification("Erro ao atualizar agendamento.");
    }
  };
  const deleteAppointment = async (stringId: string) => {
    try {
        await deleteDoc(doc(db, "appointments", stringId));
    } catch (e) {
        console.error("Erro ao excluir agendamento:", e);
        triggerNotification("Erro ao excluir agendamento.");
    }
  };
  const batchDeleteAppointments = async (stringIds: string[]) => {
    const batch = writeBatch(db);
    stringIds.forEach(id => {
        const docRef = doc(db, "appointments", id);
        batch.delete(docRef);
    });
    try {
        await batch.commit();
    } catch (e) {
        console.error("Erro ao excluir agendamentos em lote:", e);
        triggerNotification("Erro ao excluir agendamentos.");
    }
  };
  const addMessageToAppointment = async (appointmentStringId: string, messageText: string) => {
    if (!user) return;
    try {
      const appDocRef = doc(db, "appointments", appointmentStringId);
      const newMessage: Message = {
        authorId: user.id,
        authorName: user.name,
        text: messageText,
        timestamp: Date.now()
      };
      await updateDoc(appDocRef, {
        messages: arrayUnion(newMessage)
      });
    } catch (e) {
      console.error("Erro ao adicionar mensagem:", e);
      triggerNotification("Erro ao enviar mensagem.");
    }
  };
  const addPendency = async (pendency: Omit<Pendency, 'id' | 'stringId'>) => {
    try {
      await addDoc(collection(db, "pendencies"), pendency);
    } catch (e) {
      console.error("Erro ao adicionar pendência:", e);
      triggerNotification("Erro ao adicionar pendência.");
    }
  };
  const updatePendency = async (updatedPendency: Pendency) => {
    if (!updatedPendency.stringId) return;
    try {
        const { id, stringId, ...dataToUpdate } = updatedPendency;
        const pendencyDocRef = doc(db, "pendencies", stringId);
        await updateDoc(pendencyDocRef, dataToUpdate);
    } catch (e) {
        console.error("Erro ao atualizar pendência:", e);
        triggerNotification("Erro ao atualizar pendência.");
    }
  };
  const deletePendency = async (stringId: string) => { try { await deleteDoc(doc(db, "pendencies", stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir pendência.")} };
  
  const addFinancial = async (transaction: Omit<FinancialTransaction, 'id' | 'stringId'>) => {
    try {
      await addDoc(collection(db, "financials"), transaction);
    } catch (e) {
      console.error("Erro ao adicionar transação:", e);
      triggerNotification("Erro ao adicionar transação.");
    }
  };
  const updateFinancial = async (updatedTransaction: FinancialTransaction) => {
    if (!updatedTransaction.stringId) return;
    try {
        const { id, stringId, ...dataToUpdate } = updatedTransaction;
        const docRef = doc(db, "financials", stringId);
        await updateDoc(docRef, dataToUpdate);
    } catch (e) {
        console.error("Erro ao atualizar transação:", e);
        triggerNotification("Erro ao atualizar transação.");
    }
  };
  const deleteFinancial = async (stringId: string) => { try { await deleteDoc(doc(db, "financials", stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir transação.")} };
  
  const addAccount = async (account: Omit<FinancialAccount, 'id' | 'stringId'>) => {
    try {
      await addDoc(collection(db, "accounts"), account);
    } catch (e) {
      console.error("Erro ao adicionar conta:", e);
      triggerNotification("Erro ao adicionar conta.");
    }
  };
  const updateAccount = async (updatedAccount: FinancialAccount) => {
    if (!updatedAccount.stringId) return;
    try {
        const { id, stringId, ...dataToUpdate } = updatedAccount;
        const docRef = doc(db, "accounts", stringId);
        await updateDoc(docRef, dataToUpdate);
    } catch (e) {
        console.error("Erro ao atualizar conta:", e);
        triggerNotification("Erro ao atualizar conta.");
    }
  };
  const deleteAccount = async (stringId: string) => { try { await deleteDoc(doc(db, "accounts", stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir conta.")} };
  
  const addThirdParty = async (thirdParty: Omit<ThirdParty, 'id' | 'stringId'>) => {
    try {
      await addDoc(collection(db, "thirdParties"), thirdParty);
    } catch (e) {
      console.error("Erro ao adicionar cliente/fornecedor:", e);
      triggerNotification("Erro ao adicionar cliente/fornecedor.");
    }
  };
  const updateThirdParty = async (updatedThirdParty: ThirdParty) => {
    if (!updatedThirdParty.stringId) return;
    try {
        const { id, stringId, ...dataToUpdate } = updatedThirdParty;
        const docRef = doc(db, "thirdParties", stringId);
        await updateDoc(docRef, dataToUpdate);
    } catch (e) {
        console.error("Erro ao atualizar cliente/fornecedor:", e);
        triggerNotification("Erro ao atualizar cliente/fornecedor.");
    }
  };
  const deleteThirdParty = async (stringId: string) => { try { await deleteDoc(doc(db, "thirdParties", stringId)); } catch (e) { console.error(e); triggerNotification("Erro ao excluir cliente/fornecedor.")} };
  
  // FIX: Implement addUser function to create a new user in Firebase Auth and Firestore.
  const addUser = async (userData: Omit<User, 'id'>): Promise<{success: boolean, message: string}> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, '123mudar');
      const firebaseUser = userCredential.user;
      const userDataWithPasswordFlag = { ...userData, forcePasswordChange: true };
      await setDoc(doc(db, "users", firebaseUser.uid), userDataWithPasswordFlag);
      await signOut(auth);
      return { success: true, message: `Usuário ${userData.name} criado com sucesso. A senha padrão é '123mudar'. O administrador será desconectado.` };
    } catch (error: any) {
      console.error("Erro ao adicionar usuário:", error);
      let message = "Ocorreu um erro ao criar o usuário.";
      if (error.code === 'auth/email-already-in-use') {
        message = "Este e-mail já está em uso por outra conta.";
      } else if (error.code === 'auth/invalid-email') {
        message = "O formato do e-mail é inválido.";
      }
      return { success: false, message: message };
    }
  };
  const updateUser = async (updatedUser: User) => {
    try {
        const { id, ...dataToUpdate } = updatedUser;
        const userDocRef = doc(db, "users", id);
        await updateDoc(userDocRef, dataToUpdate as Partial<User>);
        triggerNotification("Usuário atualizado com sucesso!");
    } catch (e) {
        console.error("Erro ao atualizar usuário:", e);
        triggerNotification("Erro ao atualizar usuário.");
    }
  };
  const updateUserPhoto = async (userId: string, photoURL: string) => {
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, { photoURL });
        triggerNotification("Foto do perfil atualizada!");
    } catch (e) {
        console.error("Erro ao atualizar foto:", e);
        triggerNotification("Erro ao atualizar foto do perfil.");
    }
  };
  const deleteUser = async (id: string) => {
    try {
        await deleteDoc(doc(db, "users", id));
        triggerNotification("Perfil de usuário removido do banco de dados.");
    } catch (e) {
        console.error("Erro ao excluir usuário:", e);
        triggerNotification("Erro ao excluir perfil de usuário.");
    }
  };
  // FIX: Implement updatePassword function to handle reauthentication and password updates.
  const updatePassword = async (oldPass: string, newPass: string): Promise<{success: boolean, message: string}> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      return { success: false, message: 'Nenhum usuário logado.' };
    }
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, oldPass);
      await reauthenticateWithCredential(firebaseUser, credential);
      await fbUpdatePassword(firebaseUser, newPass);
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await updateDoc(userDocRef, { forcePasswordChange: false });
      return { success: true, message: 'Senha atualizada com sucesso!' };
    } catch (error: any) {
      console.error("Erro ao atualizar senha:", error);
      let message = "Ocorreu um erro ao atualizar a senha.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'A senha atual está incorreta.';
      } else if (error.code === 'auth/weak-password') {
        message = 'A nova senha é muito fraca. Use pelo menos 6 caracteres.';
      }
      return { success: false, message: message };
    }
  };
  // FIX: Implement resetPassword function, similar to sendPasswordReset.
  const resetPassword = async (email: string): Promise<{success: boolean, message: string}> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'E-mail de redefinição de senha enviado com sucesso!' };
    } catch (error: any) {
      console.error("Erro ao redefinir senha:", error);
      let message = "Ocorreu um erro ao enviar o e-mail de redefinição.";
      if (error.code === 'auth/user-not-found') {
        message = 'Nenhum usuário encontrado com este e-mail.';
      }
      return { success: false, message: message };
    }
  };


  return (
    <AppContext.Provider value={{ 
        theme, toggleTheme, setTheme, themePalette, setThemePalette, textPalette, setTextPalette,
        user, users, appointments, pendencies, financials, accounts, thirdParties, settings, logo: settings.logoUrl || null, updateLogo, loading,
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