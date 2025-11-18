
'use server';

import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { z } from 'zod';

// This is a workaround to use service account credentials in a Vercel-like environment
function getServiceAccount() {
  try {
    // This will work in local development
    return require('../../serviceAccountKey.json');
  } catch (e) {
    // In a Vercel/production environment, parse the environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", parseError);
        return null;
      }
    }
    console.error("Service account key not found. Please set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable or place serviceAccountKey.json in the root.");
    return null;
  }
}

// --- Zod Schemas for Input Validation ---
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
});

const updateUserPasswordSchema = z.object({
    uid: z.string().min(1),
    password: z.string().min(6),
});

const deleteUserSchema = z.object({
    uid: z.string().min(1),
});

// --- Reliable Admin App Initializer ---
let adminApp: App;

function getAdminApp(): App {
    if (adminApp) {
        return adminApp;
    }

    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      throw new Error("Firebase Admin SDK credentials not found or are invalid.");
    }
    
    // Use a unique app name to avoid conflicts
    const appName = `firebase-admin-app-${Date.now()}`;

    if (getApps().find(app => app.name === appName)) {
      return getApps().find(app => app.name === appName)!;
    }
    
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    }, appName);

    return adminApp;
}


export async function createAuthUser(userData: z.infer<typeof createUserSchema>) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
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


export async function updateAuthUserPassword(userData: z.infer<typeof updateUserPasswordSchema>) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
        await adminAuth.updateUser(userData.uid, {
            password: userData.password,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating user password:", error);
        return { success: false, error: error.code || 'unknown_error' };
    }
}

export async function deleteAuthUser(userData: z.infer<typeof deleteUserSchema>) {
    try {
        const app = getAdminApp();
        const adminAuth = getAuth(app);
        await adminAuth.deleteUser(userData.uid);
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, error: error.code || 'unknown_error' };
    }
}
