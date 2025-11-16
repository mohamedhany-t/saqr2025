
const admin = require('firebase-admin');
const fs = require('fs');

// --- إعدادات ---
const NUM_COMPANIES = 3; // Now shipping companies
const NUM_COURIERS = 10;
const NUM_SHIPMENTS = 50;
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
db.settings({ ignoreUndefinedProperties: true });


const EGYPTIAN_GOVERNORATES = [
    "القاهرة", "الجيزة", "الأسكندرية", "الدقهلية", "الشرقية", "المنوفية", "القليوبية", "البحيرة", 
    "الغربية", "بور سعيد", "دمياط", "الإسماعيلية", "السويس", "كفر الشيخ", "الفيوم", "بني سويف", 
    "مطروح", "شمال سيناء", "جنوب سيناء", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", 
    "البحر الأحمر", "الوادي الجديد"
];

const SHIPMENT_STATUSES = ["Pending", "In-Transit", "Delivered", "Cancelled", "Returned"];
const SHIPMENT_REASONS = ["لم يرد", "رفض الاستلام", "تأجيل", "عنوان خاطئ", "لا يوجد سبب"];


// --- دوال مساعدة ---

const log = (message, data) => console.log(`\x1b[32m✔\x1b[0m ${message}`, data || '');
const logError = (message, error) => console.error(`\x1b[31m✖\x1b[0m ${message}`, error);

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function createFirebaseUser(email, password, displayName) {
    try {
        const userRecord = await auth.createUser({ email, password, displayName });
        log('Successfully created new user in Auth:', { uid: userRecord.uid, email });
        return userRecord;
    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            log('User already exists in Auth, fetching:', { email });
            return auth.getUserByEmail(email);
        }
        logError(`Error creating user ${email}:`, error);
        throw error;
    }
}

// --- دوال إنشاء البيانات ---

async function seedGovernorates() {
    console.log('\n--- Seeding Governorates ---');
    const batch = db.batch();
    const collectionRef = db.collection('governorates');
    
    EGYPTIAN_GOVERNORATES.forEach(name => {
        const docRef = collectionRef.doc(); // Auto-generate ID
        batch.set(docRef, { id: docRef.id, name });
    });

    await batch.commit();
    log(`Seeded ${EGYPTIAN_GOVERNORATES.length} governorates.`);
    const snapshot = await collectionRef.get();
    return snapshot.docs.map(doc => doc.data());
}


async function seedShippingCompanies(count) {
    console.log(`\n--- Seeding ${count} Shipping Companies ---`);
    const batch = db.batch();
    const shippingCompanies = [];
    const companyNames = ['شركة البرق السريع', 'شركة الصقر للشحن', 'شركة وصلني إكسبريس', 'شركة النيل للنقل', 'شركة الأمانة السريعة'];

    for (let i = 0; i < count; i++) {
        const companyData = {
            id: `comp_${i+1}`,
            name: companyNames[i] || `شركة شحن وهمية ${i+1}`
        };
        shippingCompanies.push(companyData);
        const docRef = db.collection('companies').doc(companyData.id);
        batch.set(docRef, companyData);
    }
    await batch.commit();
    log(`Seeded ${shippingCompanies.length} shipping companies.`);
    return shippingCompanies;
}

async function seedAdminUsers() {
    console.log('\n--- Seeding Admin Users ---');
    try {
        const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
        log(`Found admin user: ${ADMIN_EMAIL}`);
        const batch = db.batch();
        const userRef = db.collection('users').doc(userRecord.uid);
        const roleRef = db.collection('roles_admin').doc(userRecord.uid);

        batch.set(userRef, {
            id: userRecord.uid,
            email: userRecord.email,
            name: userRecord.displayName || 'Admin',
            role: 'admin',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        batch.set(roleRef, { email: userRecord.email }, { merge: true });
        
        await batch.commit();
        log('Admin user documents created/updated successfully.');
        return [userRecord];
    } catch (error) {
        logError(`Could not find or create admin user ${ADMIN_EMAIL}. Make sure this user exists in Firebase Auth.`, error.message);
        return [];
    }
}


async function seedCouriers(count, shippingCompanies) {
    console.log(`\n--- Seeding ${count} Couriers ---`);
    const couriers = [];
    for (let i = 1; i <= count; i++) {
        const email = `courier${i}@alsaqr.com`;
        const name = `المندوب الوهمي ${i}`;
        const commissionRate = Math.floor(Math.random() * 20) + 10; // Random commission between 10 and 30
        
        const userRecord = await createFirebaseUser(email, 'password', name);
        const assignedShippingCompany = getRandomItem(shippingCompanies);
        const batch = db.batch();
        
        const courierRef = db.collection('couriers').doc(userRecord.uid);
        batch.set(courierRef, {
            id: userRecord.uid,
            name: name,
            deliveryCompanyId: assignedShippingCompany.id,
            commissionRate: commissionRate,
        });

        const userRef = db.collection('users').doc(userRecord.uid);
        batch.set(userRef, {
            id: userRecord.uid,
            email: email,
            name: name,
            role: 'courier',
            deliveryCompanyId: assignedShippingCompany.id,
            commissionRate: commissionRate,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        const roleRef = db.collection('roles_courier').doc(userRecord.uid);
        batch.set(roleRef, { email: email });
        
        await batch.commit();
        couriers.push({ id: userRecord.uid, name, deliveryCompanyId: assignedShippingCompany.id });
    }
    return couriers;
}

async function seedShipments(count, couriers, governorates) {
    console.log(`\n--- Seeding ${count} Shipments ---`);
    const batch = db.batch();
    const shipmentsRef = db.collection('shipments');

    for (let i = 0; i < count; i++) {
        const docRef = shipmentsRef.doc();
        const creationDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // within last 30 days
        const deliveryDate = new Date(creationDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
        const status = getRandomItem(SHIPMENT_STATUSES);
        const totalAmount = Math.floor(Math.random() * 1000) + 50;

        const courier = getRandomItem(couriers);
        const governorate = getRandomItem(governorates);

        batch.set(docRef, {
            id: docRef.id,
            shipmentCode: `SH-${creationDate.toISOString().slice(0, 10).replace(/-/g, '')}-${i}`,
            orderNumber: `ORD-${Date.now() + i}`,
            trackingNumber: `TRK-${Math.floor(Math.random() * 1e9)}`,
            recipientName: `المرسل إليه ${i + 1}`,
            recipientPhone: `010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
            governorateId: governorate.id,
            address: `شارع وهمي رقم ${i + 1}, ${governorate.name}`,
            deliveryDate: admin.firestore.Timestamp.fromDate(deliveryDate),
            status: status,
            reason: (status === 'Returned' || status === 'Cancelled') ? getRandomItem(SHIPMENT_REASONS) : '',
            totalAmount: totalAmount,
            paidAmount: status === 'Delivered' ? totalAmount : 0,
            assignedCompanyId: courier.deliveryCompanyId,
            assignedCourierId: courier.id,
            createdAt: admin.firestore.Timestamp.fromDate(creationDate),
            updatedAt: admin.firestore.Timestamp.fromDate(creationDate),
        });
    }

    await batch.commit();
    log(`Seeded ${count} shipments.`);
}


// --- تشغيل السكربت ---
async function main() {
    try {
        console.log("\x1b[34m%s\x1b[0m", "Starting database seeding process...");

        const governorates = await seedGovernorates();
        const shippingCompanies = await seedShippingCompanies(NUM_COMPANIES);
        await seedAdminUsers();
        const couriers = await seedCouriers(NUM_COURIERS, shippingCompanies);
        await seedShipments(NUM_SHIPMENTS, couriers, governorates);
        
        console.log("\n\x1b[32m%s\x1b[0m", "Database seeding completed successfully!");
        console.log("You can now log in with the following dummy accounts (password for all is 'password'):");
        for (let i = 1; i <= NUM_COURIERS; i++) console.log(`- Courier: courier${i}@alsaqr.com`);

    } catch (error) {
        logError("An error occurred during the seeding process:", error);
    }
}

main();
