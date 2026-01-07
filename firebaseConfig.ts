// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDwhB3e0cQiIYIcjQRqN2hCFviv5iVPNO4", // Restored key to fix login. Secure this in Google Cloud Console.
  authDomain: "appvsvistorias1.firebaseapp.com",
  projectId: "appvsvistorias1",
  storageBucket: "appvsvistorias1.firebasestorage.app",
  messagingSenderId: "987443685390",
  appId: "1:987443685390:web:2a222636b79429ef42f45f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use initializeFirestore with persistentLocalCache to enable offline persistence
// with multi-tab synchronization enabled.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export { db, auth };