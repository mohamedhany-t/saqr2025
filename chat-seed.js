
const admin = require('firebase-admin');
const fs = require('fs');

// --- إعدادات ---
const ADMIN_EMAIL = 'mhanyt21@gmail.com'; // Admin user from the app

// --- تحميل ملف الصلاحيات ---
let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
    console.error("\x1b[31m%s\x1b[0m", "Error: `serviceAccountKey.json` not found.");
    console.error("Please download it from your Firebase project settings and place it in the root directory.");
    process.exit(1);
}

// --- تهيئة Firebase Admin ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

// --- دوال مساعدة ---
const log = (message, data) => console.log(`\x1b[32m✔\x1b[0m ${message}`, data || '');
const logError = (message, error) => console.error(`\x1b[31m✖\x1b[0m ${message}`, error);

const createChatId = (uid1, uid2) => {
    if (!uid1 || !uid2) return null;
    return [uid1, uid2].sort().join('_');
};

async function getAdminUser() {
    try {
        const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
        return userRecord;
    } catch (error) {
        logError(`Could not find admin user ${ADMIN_EMAIL}. Make sure this user exists in Firebase Auth. Run 'npm run seed' first.`, error.message);
        return null;
    }
}

async function getCouriers() {
    const snapshot = await db.collection('couriers').get();
    if (snapshot.empty) {
        log('No couriers found in the database. Run `npm run seed` first.');
        return [];
    }
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

async function ensureAdminRole(adminUser) {
    if (!adminUser) return;
    
    log(`Ensuring admin role for ${adminUser.email}...`);
    const batch = db.batch();
    const userRef = db.collection('users').doc(adminUser.uid);
    const roleRef = db.collection('roles_admin').doc(adminUser.uid);
    
    // Set user document
    batch.set(userRef, {
        id: adminUser.uid,
        email: adminUser.email,
        name: adminUser.displayName || 'Admin',
        role: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // CRITICAL: Set data in the role document so exists() check in security rules passes.
    batch.set(roleRef, { 
        email: adminUser.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    log(`Admin role document for ${adminUser.email} created/verified.`);
}


async function seedChats(couriers, adminUser) {
    console.log(`\n--- Seeding Chats for ${couriers.length} Couriers ---`);
    if (!adminUser) {
        logError("Cannot seed chats without an admin user.");
        return;
    }
    
    // Delete all old chats before seeding
    log("Clearing all existing chats...");
    const oldChatsSnapshot = await db.collection('chats').limit(500).get();
    if (!oldChatsSnapshot.empty) {
        const deleteBatch = db.batch();
        for (const doc of oldChatsSnapshot.docs) {
             const messagesSnapshot = await doc.ref.collection('messages').get();
             if (!messagesSnapshot.empty) {
                messagesSnapshot.docs.forEach(msgDoc => deleteBatch.delete(msgDoc.ref));
             }
             deleteBatch.delete(doc.ref);
        }
        await deleteBatch.commit();
        log(`Deleted ${oldChatsSnapshot.size} old chats and their messages.`);
    }


    const now = admin.firestore.Timestamp.now();
    const lastMessageText = `مرحباً، هذه رسالة تلقائية من الإدارة.`;

    for (const courier of couriers) {
        const batch = db.batch();
        const chatId = createChatId(adminUser.uid, courier.id);

        if (!chatId) {
            logError(`Skipping chat for courier ${courier.name} due to missing user ID.`);
            continue;
        }
        
        const chatRef = db.collection('chats').doc(chatId);
        
        const participants = [adminUser.uid, courier.id];
        const participantInfo = {
            [adminUser.uid]: { name: adminUser.displayName || "Admin", role: "admin" },
            [courier.id]: { name: courier.name, role: "courier" }
        };

        batch.set(chatRef, {
            id: chatRef.id,
            participants: participants,
            participantInfo: participantInfo,
            lastMessage: lastMessageText,
            lastMessageAt: now,
            createdAt: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Messages subcollection
        const messagesCollectionRef = chatRef.collection('messages');
        const adminMessageRef = messagesCollectionRef.doc();
        batch.set(adminMessageRef, {
            id: adminMessageRef.id,
            text: `مرحباً ${courier.name}, كيف يمكنني مساعدتك؟`,
            senderId: adminUser.uid,
            senderName: adminUser.displayName || "الإدارة",
            createdAt: now,
            updatedAt: now,
        });
        
        await batch.commit();
        log(`Seeded chat for courier: ${courier.name} with static chat ID: ${chatRef.id}`);
    }
}


// --- تشغيل السكربت ---
async function main() {
    try {
        console.log("\x1b[34m%s\x1b[0m", "Starting chat seeding process with new structure...");

        const adminUser = await getAdminUser();
        const couriers = await getCouriers();
        
        if (adminUser) {
            await ensureAdminRole(adminUser);
        }

        if (adminUser && couriers.length > 0) {
            await seedChats(couriers, adminUser);
            console.log("\n\x1b[32m%s\x1b[0m", "Chat seeding completed successfully!");
        } else {
            logError("Could not seed chats. Admin user or couriers not found.");
        }

    } catch (error) {
        logError("An error occurred during the chat seeding process:", error);
    }
}

main();
