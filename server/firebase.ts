import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!process.env.FIREBASE_PROJECT_ID || 
    !process.env.FIREBASE_PRIVATE_KEY || 
    !process.env.FIREBASE_CLIENT_EMAIL) {
  throw new Error("Missing Firebase admin configuration");
}

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

export const adminAuth = getAuth(app);
