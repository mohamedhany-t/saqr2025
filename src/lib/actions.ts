'use server';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { z } from 'zod';
import "dotenv/config";


// This is a workaround to use service account credentials in a Vercel-like environment
function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  // Fallback for local development if serviceAccountKey.json exists
  try {
    return require('../../../serviceAccountKey.json');
  } catch (e) {
    console.error("Service account key not found. Please set FIREBASE_SERVICE_ACCOUNT env var or place serviceAccountKey.json in the root.");
    return null;
  }
}

// Zod schema for input validation
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});


function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      throw new Error("Firebase Admin SDK credentials not found.");
    }
    return initializeApp({
      credential: cert(serviceAccount)
    });
}


export async function createAuthUser(userData: z.infer<typeof createUserSchema>) {
    try {
        const adminApp = getAdminApp();
        const adminAuth = getAuth(adminApp);
        const userRecord = await adminAuth.createUser({
            email: userData.email,
            password: userData.password,
            displayName: userData.displayName,
        });
        return { success: true, uid: userRecord.uid };
    } catch (error: any) {
        console.error("Error creating auth user:", error);
        return { success: false, error: error.code || 'unknown_error' };
    }
}
