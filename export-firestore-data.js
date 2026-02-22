require('dotenv').config();
// This script exports data from specified Firestore collections to JSON files.
// It requires a Firebase Admin SDK service account key.

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
// Collections to export. Note: `batches` and `transactions` were requested but don't exist
// in the defined backend schema, so they are commented out. Added payment collections.
const COLLECTIONS_TO_EXPORT = [
  'users',
  'companies',
  'shipments',
  'governorates',
  'courier_payments',
  'company_payments',
  // 'batches', 
  // 'transactions',
];
const EXPORT_DIR = 'firestore-export';
const BATCH_SIZE = 500; // Number of documents to fetch per batch to avoid quota issues.

// --- Helper Functions ---

/**
 * Fetches all documents from a collection in batches and recursively fetches subcollections.
 * @param {import('firebase-admin/firestore').CollectionReference} collectionRef - The reference to the collection.
 * @returns {Promise<Object[]>} - A promise that resolves to an array of document data.
 */
async function getCollectionData(collectionRef) {
  console.log(`   - Fetching documents from: ${collectionRef.path}`);
  const allData = [];
  let lastVisible = null;
  let page = 1;

  while (true) {
    const query = lastVisible
      ? collectionRef.orderBy(require('firebase-admin').firestore.FieldPath.documentId()).startAfter(lastVisible).limit(BATCH_SIZE)
      : collectionRef.orderBy(require('firebase-admin').firestore.FieldPath.documentId()).limit(BATCH_SIZE);
      
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      break; // No more documents to fetch
    }

    console.log(`     - Processing page ${page} (${snapshot.size} documents)...`);
    
    for (const doc of snapshot.docs) {
      const docData = doc.data();
      
      // Convert Timestamps to ISO strings for consistent JSON output
      for (const key in docData) {
          if (docData[key] && docData[key].toDate) { // Check if it's a Firestore Timestamp
              docData[key] = docData[key].toDate().toISOString();
          }
      }
      
      const subcollections = await doc.ref.listCollections();
      if (subcollections.length > 0) {
        docData._subcollections = {};
        for (const subcollection of subcollections) {
          console.log(`       - Found subcollection: ${subcollection.id} in doc ${doc.id}`);
          docData._subcollections[subcollection.id] = await getCollectionData(subcollection); // Recursive call for subcollections
        }
      }

      allData.push({ id: doc.id, ...docData });
    }

    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    page++;
  }
  
  return allData;
}

/**
 * Main function to run the export process.
 */
async function exportFirestoreData() {
  console.log('--- Starting Firestore Data Export ---');

  // 1. Check for Service Account Key from environment variable
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountString) {
    console.error('\n[ERROR] FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.');
    console.error('Please ensure the key is correctly set in your .env file.');
    return;
  }
  const serviceAccount = JSON.parse(serviceAccountString);

  // 2. Initialize Firebase Admin SDK
  try {
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('\n[ERROR] Failed to initialize Firebase Admin SDK.', error.message);
    if(error.code === 'app/duplicate-app') {
        console.error('This might happen during hot-reloading. The script will try to continue.');
    } else {
        return;
    }
  }
  
  const db = getFirestore();

  // 3. Create Export Directory
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR);
    console.log(`Created export directory: ./${EXPORT_DIR}`);
  }

  // 4. Loop through collections and export data
  for (const collectionName of COLLECTIONS_TO_EXPORT) {
    try {
      console.log(`\n[INFO] Exporting collection: "${collectionName}"...`);
      const collectionRef = db.collection(collectionName);
      const collectionData = await getCollectionData(collectionRef);
      
      const filePath = path.join(EXPORT_DIR, `export_${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(collectionData, null, 2));

      console.log(`[SUCCESS] Successfully exported ${collectionData.length} documents to ${filePath}`);
    } catch (error) {
      console.error(`\n[ERROR] Failed to export collection "${collectionName}":`, error.message);
       if (error.code === 8 || error.code === 'RESOURCE_EXHAUSTED') {
         console.error('[ADVICE] You have exceeded your Firestore read quota. Please wait for it to reset (usually daily) or upgrade your Firebase plan.');
       }
    }
  }

  console.log('\n--- Firestore Data Export Complete ---');
}

// Run the script
exportFirestoreData();
