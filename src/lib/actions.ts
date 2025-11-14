'use server';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { z } from 'zod';

// Zod schema for input validation
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['company', 'courier']),
  companyName: z.string().optional(),
});


function getAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }
    // This initialization is simplified to avoid credential issues in the environment.
    // The actual user creation logic is moved to the client-side, authenticated as the admin user.
    return initializeApp();
}


export async function createUser(userData: z.infer<typeof createUserSchema>) {
  // This function is being deprecated in favor of a client-side implementation
  // to resolve credential issues in the execution environment.
  // The logic is now in the AdminDashboard component.
  console.warn("createUser server action is deprecated and should not be called.");
  return { success: false, error: 'This function is deprecated.' };
}
