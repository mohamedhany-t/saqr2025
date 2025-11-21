

const admin = require('firebase-admin');
const fs = require('fs');

// --- إعدادات ---
const ADMIN_EMAIL = 'mhanyt21@gmail.com';
const ADMIN_PASSWORD = '123456'; 

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
db.settings({ ignoreUndefinedProperties: true });


const EGYPTIAN_GOVERNORATES = [
    "القاهرة", "الجيزة", "الأسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية", "البحيرة", 
    "الغربية", "بور سعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الفيوم", "بني سويف", 
    "مطروح", "شمال سيناء", "جنوب سيناء", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", 
    "البحر الأحمر", "الوادي الجديد"
];

const SHIPMENT_STATUSES = ["Pending", "In-Transit", "Delivered", "Partially Delivered", "Evasion", "Cancelled", "Returned", "Postponed", "Returned to Sender"];

// --- دوال مساعدة ---
const log = (message, data) => console.log(`\x1b[32m✔\x1b[0m ${message}`, data || '');
const logError = (message, error) => console.error(`\x1b[31m✖\x1b[0m ${message}`, error);

async function createOrUpdateFirebaseUser(email, password, displayName) {
    try {
        const userRecord = await auth.getUserByEmail(email);
        log('User already exists in Auth, updating display name & password:', { email });
        await auth.updateUser(userRecord.uid, { password: password, displayName: displayName });
        log(`Details for ${email} have been updated.`);
        return userRecord;
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            log('User not found, creating new user:', { email });
            const userRecord = await auth.createUser({ email, password, displayName });
            log('Successfully created new user in Auth:', { uid: userRecord.uid, email });
            return userRecord;
        }
        logError(`Error finding/creating user ${email}:`, error);
        throw error;
    }
}


async function clearCollection(collectionPath) {
    console.log(`\n--- Clearing collection: ${collectionPath} ---`);
    const collectionRef = db.collection(collectionPath);
    const snapshot = await collectionRef.limit(500).get();
    
    if (snapshot.empty) {
        log(`Collection ${collectionPath} is already empty.`);
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    log(`Cleared ${snapshot.size} documents from ${collectionPath}.`);

    if (snapshot.size === 500) {
        // Recurse if there are more documents to delete
        return clearCollection(collectionPath);
    }
}


// --- دوال إنشاء البيانات ---

async function seedGovernorates() {
    console.log('\n--- Seeding Governorates ---');
    const batch = db.batch();
    const collectionRef = db.collection('governorates');
    
    const snapshot = await collectionRef.get();
    const existingNames = new Set(snapshot.docs.map(doc => doc.data().name));

    let count = 0;
    EGYPTIAN_GOVERNORATES.forEach(name => {
        if (!existingNames.has(name)) {
            const docRef = collectionRef.doc(); 
            batch.set(docRef, { id: docRef.id, name });
            count++;
        }
    });
    
    if (count > 0) {
      await batch.commit();
      log(`Seeded ${count} new governorates.`);
    } else {
      log('Governorates are already up-to-date.');
    }
     return await db.collection('governorates').get().then(snap => snap.docs.map(doc => ({...doc.data(), id: doc.id})));
}

async function seedUsersAndRoles(governorates) {
    console.log('\n--- Seeding Users and Roles ---');
    
    const governorateCommissions = governorates.reduce((acc, gov) => {
        acc[gov.id] = 10 + Math.floor(Math.random() * 15); // Random commission between 10 and 25
        return acc;
    }, {});
    
    const usersToSeed = [
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, displayName: 'Admin', role: 'admin' },
        { email: 'company1@alsaqr.com', password: '123456', displayName: 'شركة النور', role: 'company', governorateCommissions },
        { email: 'company2@alsaqr.com', password: '123456', displayName: 'شركة الأمل', role: 'company', governorateCommissions },
        { email: 'courier1@alsaqr.com', password: '123456', displayName: 'أحمد محمود', role: 'courier', commissionRate: 15 },
        { email: 'courier2@alsaqr.com', password: '123456', displayName: 'سارة حسين', role: 'courier', commissionRate: 20 },
        { email: 'courier3@alsaqr.com', password: '123456', displayName: 'علي حسن', role: 'courier', commissionRate: 18 },
    ];

    const seededUsers = [];
    for (const userData of usersToSeed) {
        try {
            const userRecord = await createOrUpdateFirebaseUser(userData.email, userData.password, userData.displayName);
            
            const userDocRef = db.collection('users').doc(userRecord.uid);
            const roleDocRef = db.collection(`roles_${userData.role}`).doc(userRecord.uid);

            const userDocData = {
                id: userRecord.uid,
                email: userData.email,
                name: userData.displayName,
                role: userData.role,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const batch = db.batch();

            if (userData.role === 'courier') {
                userDocData.commissionRate = userData.commissionRate;
                const courierRef = db.collection('couriers').doc(userRecord.uid);
                batch.set(courierRef, { id: userRecord.uid, name: userData.displayName, commissionRate: userData.commissionRate }, { merge: true });
            }

            if (userData.role === 'company') {
                userDocData.companyId = userRecord.uid;
                const companyRef = db.collection('companies').doc(userRecord.uid);
                batch.set(companyRef, { id: userRecord.uid, name: userData.displayName, governorateCommissions: userData.governorateCommissions }, { merge: true });
            }
            
            batch.set(userDocRef, userDocData, { merge: true });
            batch.set(roleDocRef, { email: userData.email, createdAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            
            await batch.commit();
            seededUsers.push({ ...userDocData, uid: userRecord.uid });
            log(`Seeded user and roles for: ${userData.email}`);
        } catch (error) {
            logError(`Could not process user ${userData.email}.`, error.message);
        }
    }
    return seededUsers;
}


async function seedShipments(users, governorates, companies) {
    console.log('\n--- Seeding Shipments ---');
    const companyUsers = users.filter(u => u.role === 'company');
    const couriers = users.filter(u => u.role === 'courier');

    if (companyUsers.length === 0 || couriers.length === 0) {
        logError("Cannot seed shipments without companies and couriers.");
        return;
    }

    const batch = db.batch();
    const shipmentsCollection = db.collection('shipments');
    let count = 0;

    for (let i = 0; i < 25; i++) {
        const companyUser = companyUsers[i % companyUsers.length];
        const companyDetails = companies.find(c => c.id === companyUser.uid);
        const courier = couriers[i % couriers.length];
        const governorate = governorates[i % governorates.length];
        const status = SHIPMENT_STATUSES[i % SHIPMENT_STATUSES.length];
        
        const docRef = shipmentsCollection.doc();
        const totalAmount = 100 + (i * 15 % 500);
        let paidAmount = 0;
        let courierCommission = 0;
        let companyCommission = 0;
        let collectedAmount = 0;

        if (status === 'Delivered' || status === 'Evasion') {
            paidAmount = totalAmount;
            collectedAmount = totalAmount;
            courierCommission = courier.commissionRate || 0;
            companyCommission = companyDetails?.governorateCommissions?.[governorate.id] || 0;
        } else if (status === 'Partially Delivered') {
            paidAmount = totalAmount / 2;
            collectedAmount = totalAmount / 2;
            courierCommission = courier.commissionRate || 0;
            companyCommission = companyDetails?.governorateCommissions?.[governorate.id] || 0;
        }

        const shipmentData = {
            id: docRef.id,
            shipmentCode: `SH-20240729-${String(i).padStart(4, '0')}`,
            orderNumber: `ORD-${10000 + i}`,
            trackingNumber: `TRK-${100000 + i}`,
            senderName: `عميل فرعي ${i + 1}`,
            recipientName: `مستلم ${i + 1}`,
            recipientPhone: `01${String(100000000 + i * 12345).slice(0, 9)}`,
            governorateId: governorate.id,
            address: `شارع ${i + 1}، مبنى ${i % 100}`,
            deliveryDate: admin.firestore.Timestamp.fromDate(new Date()),
            status: status,
            totalAmount: totalAmount,
            paidAmount: paidAmount,
            collectedAmount: collectedAmount,
            courierCommission: courierCommission,
            companyCommission: companyCommission,
            companyId: companyUser.uid,
            assignedCourierId: courier.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            isArchived: false,
        };
        batch.set(docRef, shipmentData);
        count++;
    }
    await batch.commit();
    log(`Seeded ${count} shipments.`);
}

// --- تشغيل السكربت ---
async function main() {
    try {
        console.log("\x1b[34m%s\x1b[0m", "Starting database seeding process...");
        
        await clearCollection('shipments');
        
        const governorates = await seedGovernorates();
        const users = await seedUsersAndRoles(governorates);
        const companies = await db.collection('companies').get().then(snap => snap.docs.map(doc => ({...doc.data(), id: doc.id})));
        await seedShipments(users, governorates, companies);
        
        console.log("\n\x1b[32m%s\x1b[0m", "Database seeding completed successfully!");
        console.log("Mock data for users, companies, and shipments has been created.");

    } catch (error) {
        logError("An error occurred during the seeding process:", error);
    }
}

main();
