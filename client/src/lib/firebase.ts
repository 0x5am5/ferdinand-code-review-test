import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Verify all required Firebase config variables exist
if (!import.meta.env.VITE_FIREBASE_API_KEY || 
    !import.meta.env.VITE_FIREBASE_PROJECT_ID || 
    !import.meta.env.VITE_FIREBASE_APP_ID) {
  throw new Error("Missing Firebase configuration");
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure additional scopes for Google provider
googleProvider.addScope('profile');
googleProvider.addScope('email');

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