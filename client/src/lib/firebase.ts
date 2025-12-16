import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  getAuth,
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
let app: FirebaseApp;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
  } else {
    app = getApp();
    console.log("Using existing Firebase app instance");
  }
} catch (error: unknown) {
  console.error(
    "Firebase initialization error:",
    error instanceof Error ? error.message : "Unknown error"
  );
  app = getApps()[0] || initializeApp(firebaseConfig);
}

export const auth = getAuth(app);

// Set persistent auth state
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error(
    "Auth persistence error:",
    error instanceof Error ? error.message : "Unknown error"
  );
});

export const googleProvider = new GoogleAuthProvider();

// Configure additional scopes for Google provider
googleProvider.addScope("profile");
googleProvider.addScope("email");

// Set custom parameters for Google Auth
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Add persistent logging for debugging (only in browser environment)
const persistLog = (message: string) => {
  if (typeof document !== "undefined" && typeof window !== "undefined") {
    const logElement = document.createElement("div");
    logElement.textContent = message;
    logElement.style.display = "none";
    document.body.appendChild(logElement);
  }
  console.log(message);
};

if (typeof window !== "undefined") {
  persistLog(`Auth domain: ${firebaseConfig.authDomain}`);
  persistLog(`Current domain: ${window.location.hostname}`);
}
