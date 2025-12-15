
require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { EGYPTIAN_GOVERNORATES } = require('./dist/lib/governorates');
const { mockUsers, mockShipments } = require('./dist/lib/placeholder-data');

// --- Configuration ---
let serviceAccount;
try {
    // This will be used for local development
    serviceAccount = require('../firebase-admin-sdk.json');
} catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
        console.warn("firebase-admin-sdk.json not found. This is expected in production environments. The script will likely fail if not run locally.");
    } else {
        throw e;
    }
}


// Initialize Firebase Admin SDK
let app;
try {
    const appConfig = serviceAccount ? { credential: cert(serviceAccount) } : {};
    app = initializeApp(appConfig);
} catch(e) {
    if (e.code === 'app/duplicate-app') {
        console.warn("Firebase app already initialized. This can happen during hot-reloads. The script will continue.");
    } else {
        throw e;
    }
}

const db = getFirestore();
const auth = getAuth();
const BATCH_SIZE = 400; // Firestore batch limit is 500 writes

// --- Helper Functions ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function batchCommit(batch, collectionName) {
  try {
    await batch.commit();
    console.log(`   - Batch committed successfully for ${collectionName}.`);
  } catch (error) {
    console.error(`   - Error committing batch for ${collectionName}:`, error);
    throw error;
  }
}

async function seedCollection(collectionName, data) {
    console.log(`[INFO] Seeding collection: "${collectionName}"...`);
    const collectionRef = db.collection(collectionName);
    let batch = db.batch();
    let count = 0;

    for (const item of data) {
        const docId = item.id;
        if (!docId) {
            console.warn(`   - Skipping item in ${collectionName} due to missing ID:`, item);
            continue;
        }
        
        let dataToSet = { ...item };
        delete dataToSet.id; // Don't store the ID as a field

        // Convert date strings/objects to Firestore Timestamps
        Object.keys(dataToSet).forEach(key => {
            if (dataToSet[key] instanceof Date) {
                dataToSet[key] = Timestamp.fromDate(dataToSet[key]);
            }
        });

        const docRef = collectionRef.doc(docId);
        batch.set(docRef, dataToSet);
        count++;

        if (count % BATCH_SIZE === 0) {
            await batchCommit(batch, collectionName);
            batch = db.batch();
            await delay(1000); // Delay to avoid hitting rate limits
        }
    }

    if (count % BATCH_SIZE !== 0) {
        await batchCommit(batch, collectionName);
    }
    console.log(`[SUCCESS] Seeded ${data.length} documents into "${collectionName}".`);
}

async function seedGovernorates() {
  console.log(`[INFO] Seeding collection: "governorates"...`);
  const collectionRef = db.collection("governorates");
  const batch = db.batch();
  for (const govName of EGYPTIAN_GOVERNORATES) {
    // Let Firestore generate the ID
    const docRef = collectionRef.doc();
    batch.set(docRef, { name: govName, id: docRef.id });
  }
  await batch.commit();
  console.log(`[SUCCESS] Seeded ${EGYPTIAN_GOVERNORATES.length} governorates.`);
}


async function createAuthUsers(users) {
    console.log(`[INFO] Creating authentication users...`);
    let createdCount = 0;
    for (const user of users) {
        try {
            await auth.createUser({
                uid: user.id,
                email: user.email,
                password: 'password123', // Use a standard password for all mock users
                displayName: user.name,
                photoURL: user.avatarUrl,
            });
             console.log(`   - Successfully created auth user: ${user.email}`);
             createdCount++;
        } catch (error) {
            if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
                console.warn(`   - Auth user already exists, updating display name: ${user.email}`);
                 try {
                    await auth.updateUser(user.id, { displayName: user.name });
                 } catch (updateError) {
                     console.error(`   - Failed to update existing auth user ${user.email}:`, updateError);
                 }
            } else {
                console.error(`   - Failed to create auth user ${user.email}:`, error);
            }
        }
    }
     console.log(`[SUCCESS] Created or verified ${createdCount} authentication users.`);
}


async function seedRoles(users) {
    console.log(`[INFO] Seeding roles...`);
    const roles = ['admin', 'company', 'courier'];
    for(const role of roles) {
        const roleCollectionName = `roles_${role}`;
        const usersInRole = users.filter(u => u.role === role);
        if(usersInRole.length > 0) {
             const collectionRef = db.collection(roleCollectionName);
             let batch = db.batch();
             let count = 0;
             for(const user of usersInRole) {
                const docRef = collectionRef.doc(user.id);
                batch.set(docRef, { email: user.email, name: user.name });
                count++;
                if (count % BATCH_SIZE === 0) {
                    await batchCommit(batch, roleCollectionName);
                    batch = db.batch();
                }
             }
             if (count % BATCH_SIZE !== 0) {
                await batchCommit(batch, roleCollectionName);
            }
            console.log(`   - Seeded ${usersInRole.length} users into "${roleCollectionName}".`);
        }
    }
     console.log(`[SUCCESS] Roles seeded.`);
}


async function seedCompaniesAndCouriers(users) {
     console.log(`[INFO] Seeding companies and couriers profiles...`);
     const companies = users.filter(u => u.role === 'company').map(u => ({ id: u.id, name: u.name }));
     const couriers = users.filter(u => u.role === 'courier').map(u => ({ id: u.id, name: u.name, commissionRate: 15 }));
     
     if (companies.length > 0) await seedCollection('companies', companies);
     if (couriers.length > 0) await seedCollection('couriers', couriers);
     console.log(`[SUCCESS] Company and courier profiles seeded.`);
}

async function main() {
    console.log("--- Starting Firestore Seeding Process ---");
    try {
        await createAuthUsers(mockUsers);
        await seedCollection('users', mockUsers);
        await seedGovernorates();
        
        // Fetch the newly created governorates to link them correctly
        const govSnapshot = await db.collection('governorates').get();
        const governorates = govSnapshot.docs.map(doc => doc.data());
        
        const companies = mockUsers.filter(u => u.role === 'company');
        const couriers = mockUsers.filter(u => u.role === 'courier');

        // Assign shipments to companies and couriers
        const shipmentsWithAssignments = mockShipments.map((shipment, i) => ({
            ...shipment,
            companyId: companies[i % companies.length].id,
            assignedCourierId: couriers[i % couriers.length].id,
            governorateId: governorates[i % governorates.length].id, // Use real governorate IDs
        }));

        await seedCollection('shipments', shipmentsWithAssignments);
        await seedRoles(mockUsers);
        await seedCompaniesAndCouriers(mockUsers);

        console.log("\n--- Firestore Seeding Complete! ---");
    } catch (error) {
        console.error("\n[FATAL ERROR] Seeding process failed:", error);
        process.exit(1);
    }
}

main();
