import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator, browserLocalPersistence, setPersistence } from "firebase/auth";

// Verify all required Firebase config variables exist
if (!import.meta.env.VITE_FIREBASE_API_KEY || 
    !import.meta.env.VITE_FIREBASE_PROJECT_ID || 
    !import.meta.env.VITE_FIREBASE_APP_ID) {
  throw new Error("Missing Firebase configuration");
}

// Get the current hostname
const currentHostname = window.location.hostname;

// Configure the authDomain based on environment
let authDomain;
if (currentHostname.includes("replit") || currentHostname.includes("janeway")) {
  // We're in Replit development environment
  authDomain = currentHostname;
  console.log("Using Replit domain for Firebase auth:", authDomain);
} else {
  // Use default Firebase domain in production
  authDomain = `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`;
  console.log("Using Firebase domain for auth:", authDomain);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Auth persistence error:", error);
  });

export const googleProvider = new GoogleAuthProvider();

// Configure additional scopes for Google provider
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Set custom parameters for Google Auth  
googleProvider.setCustomParameters({
  prompt: 'select_account'
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
  const logElement = document.createElement('div');
  logElement.textContent = message;
  logElement.style.display = 'none';
  document.body.appendChild(logElement);
  console.log(message);
};

persistLog(`Auth domain: ${firebaseConfig.authDomain}`);
persistLog(`Current domain: ${window.location.hostname}`);