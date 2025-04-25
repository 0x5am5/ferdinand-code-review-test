import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAl3HRwF-uMmQLvfybb9gHNqra2tJ0hb2U",
  authDomain: "gb--brand-guidelines.firebaseapp.com",
  projectId: "gb--brand-guidelines",
  storageBucket: "gb--brand-guidelines.firebasestorage.app",
  messagingSenderId: "6237066102",
  appId: "1:6237066102:web:431c0d0cf8efcde0b56057",
  measurementId: "G-S4D06LF550",
};

// Initialize Firebase - handling potential duplicate initialization
let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } else {
    app = getApp();
    console.log("Using existing Firebase app instance");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  app = getApps()[0] || initializeApp(firebaseConfig);
}

export const auth = getAuth(app);

// Set persistent auth state
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});

export const googleProvider = new GoogleAuthProvider();

// Configure additional scopes for Google provider
googleProvider.addScope("profile");
googleProvider.addScope("email");

// Set custom parameters for Google Auth
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Log the current domain for debugging
console.log("Current domain:", window.location.hostname);
console.log("Full domain with protocol:", window.location.origin);

// Log Firebase config for debugging
console.log("Firebase config (without sensitive data):", {
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
});

// Add persistent logging for debugging
const persistLog = (message: string) => {
  const logElement = document.createElement("div");
  logElement.textContent = message;
  logElement.style.display = "none";
  document.body.appendChild(logElement);
  console.log(message);
};

persistLog(`Auth domain: ${firebaseConfig.authDomain}`);
persistLog(`Current domain: ${window.location.hostname}`);
