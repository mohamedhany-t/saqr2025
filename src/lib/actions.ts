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


let adminApp: App;
if (!getApps().length) {
    adminApp = initializeApp();
} else {
    adminApp = getApps()[0];
}


export async function createUser(userData: z.infer<typeof createUserSchema>) {
  try {
    const validatedData = createUserSchema.parse(userData);
    const { name, email, password, role, companyName } = validatedData;
    
    const auth = getAuth(adminApp);
    const firestore = getFirestore(adminApp);

    // 1. Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });
    
    const uid = userRecord.uid;
    const batch = firestore.batch();

    // 2. Create user document in /users collection
    const userDocRef = firestore.collection('users').doc(uid);
    const userDocData: any = {
      id: uid,
      email,
      role,
      name,
      createdAt: new Date(),
    };

    // 3. Handle 'company' role specific logic
    if (role === 'company') {
      if (!companyName) {
        throw new Error("Company name is required for company role.");
      }
      const companyDocRef = firestore.collection('companies').doc(uid);
      batch.set(companyDocRef, { id: uid, name: companyName });
      
      userDocData.companyId = uid;
      userDocData.companyName = companyName;
    }

    batch.set(userDocRef, userDocData);

    // 4. Create role document in roles_* collection
    const roleCollectionPath = `roles_${role}`;
    const roleDocRef = firestore.collection(roleCollectionPath).doc(uid);
    batch.set(roleDocRef, { email, createdAt: new Date() });

    // 5. Commit the batch
    await batch.commit();

    return { success: true, message: `User ${name} created successfully with role ${role}.` };

  } catch (error: any) {
    console.error("Error creating user:", error);
    // Handle specific Firebase Admin SDK errors if needed
    if (error.code === 'auth/email-already-exists') {
        return { success: false, error: 'هذا البريد الإلكتروني مستخدم بالفعل.' };
    }
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}
