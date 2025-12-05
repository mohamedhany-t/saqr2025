
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";
import cors from "cors";

try {
    admin.initializeApp();
} catch (e) {
    if (!/already exists/.test((e as Error).message)) {
        console.error('Firebase admin initialization error', e);
    }
}

const db = admin.firestore();
const corsHandler = cors({ origin: true });

// Define the shape of the status configuration for type safety
interface ShipmentStatusConfig {
  id: string;
  label: string;
  affectsCourierBalance: boolean;
  affectsCompanyBalance: boolean;
  enabled: boolean;
  requiresFullCollection: boolean;
  requiresPartialCollection: boolean;
}

export const getDashboardStats = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const adminDoc = await db.collection("roles_admin").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "The function must be called by an admin user.");
  }
  
  try {
    const shipmentsSnapshot = await db.collection("shipments").get();
    let totalRevenue = 0;
    let inTransit = 0;
    let delivered = 0;
    let returned = 0;
    const totalShipments = shipmentsSnapshot.size;

    shipmentsSnapshot.forEach((doc) => {
      const shipment = doc.data();
      if (shipment.paidAmount) {
        totalRevenue += shipment.paidAmount;
      }
      switch (shipment.status) {
        case "In-Transit": inTransit++; break;
        case "Delivered": delivered++; break;
        case "Returned":
        case "Cancelled":
        case "Refused (Unpaid)":
        case "Evasion (Phone)":
        case "Partially Delivered":
        case "Evasion (Delivery Attempt)":
        case "Refused (Paid)": returned++; break;
        default: break;
      }
    });

    return { totalRevenue, inTransit, delivered, returned, totalShipments };
  } catch (error) {
    console.error("Error calculating dashboard stats:", error);
    throw new functions.https.HttpsError("internal", "Failed to calculate dashboard statistics.");
  }
});

const updateShipmentStatusSchema = z.object({
    shipmentId: z.string(),
    status: z.string(),
    reason: z.string().optional(),
    collectedAmount: z.number().optional(),
});

export const handleShipmentUpdate = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).send({ error: { message: 'Method Not Allowed' } });
            return;
        }

        let context: any = {};
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (idToken) {
            try {
                context.auth = await admin.auth().verifyIdToken(idToken);
            } catch (error) {
                console.error('Error verifying token:', error);
                res.status(401).send({ error: { status: 'UNAUTHENTICATED' } });
                return;
            }
        }
        
        if (!context.auth) {
            res.status(401).send({ error: { status: 'UNAUTHENTICATED' } });
            return;
        }
        
        const { uid: courierId, name: courierName, email: courierEmail } = context.auth;
        const validation = updateShipmentStatusSchema.safeParse(req.body);

        if (!validation.success) {
            console.error("Validation failed:", validation.error);
            res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'The data provided is invalid.' } });
            return;
        }

        const { shipmentId, status, reason, collectedAmount } = validation.data;
        const shipmentRef = db.collection('shipments').doc(shipmentId);

        try {
            const result = await db.runTransaction(async (transaction) => {
                const shipmentDoc = await transaction.get(shipmentRef);
                if (!shipmentDoc.exists) {
                     throw new functions.https.HttpsError("not-found", "Shipment not found.");
                }
                const shipmentData = shipmentDoc.data()!;
                if (shipmentData.assignedCourierId !== courierId) {
                     throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
                }

                // Fetch necessary data for calculation
                const courierDoc = await transaction.get(db.collection('users').doc(courierId));
                const companyDoc = await transaction.get(db.collection('companies').doc(shipmentData.companyId));
                const statusConfigsSnapshot = await transaction.get(db.collection('shipment_statuses'));

                if (!courierDoc.exists || !companyDoc.exists) {
                    throw new functions.https.HttpsError("failed-precondition", "Courier or Company data not found.");
                }
                
                const courierData = courierDoc.data()!;
                const companyData = companyDoc.data()!;
                const statusConfigs: ShipmentStatusConfig[] = statusConfigsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ShipmentStatusConfig));
                
                // Perform calculations
                const statusConfig = statusConfigs.find(s => s.id === status);
                if (!statusConfig) {
                    throw new functions.https.HttpsError("failed-precondition", `Status configuration for "${status}" not found.`);
                }
                
                let paidAmount = 0;
                let finalCollectedAmount = collectedAmount || 0;
                let courierCommission = 0;
                let companyCommission = 0;
                
                if (statusConfig.requiresFullCollection) {
                    paidAmount = shipmentData.totalAmount || 0;
                    finalCollectedAmount = shipmentData.totalAmount || 0;
                } else if (statusConfig.requiresPartialCollection) {
                    paidAmount = finalCollectedAmount;
                }

                if (statusConfig.affectsCourierBalance) {
                    courierCommission = courierData.commissionRate || 0;
                }
                
                if (paidAmount > 0 && statusConfig.affectsCompanyBalance) {
                    const govId = shipmentData.governorateId;
                    if(govId && companyData.governorateCommissions?.[govId]) {
                        companyCommission = companyData.governorateCommissions[govId];
                    }
                }
                
                const financialUpdate = {
                    paidAmount,
                    collectedAmount: finalCollectedAmount,
                    courierCommission,
                    companyCommission,
                };
                
                const finalShipmentUpdate = {
                    ...financialUpdate,
                    status: status,
                    reason: reason || "",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                
                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: status,
                    reason: reason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: courierName || courierEmail,
                    userId: courierId,
                };

                transaction.update(shipmentRef, finalShipmentUpdate);
                transaction.set(historyRef, historyEntry);

                return { success: true, message: "Shipment updated successfully." };
            });
            res.status(200).send({ data: result });
        } catch (error: any) {
            console.error("Error updating shipment status:", error);
            const status = error.httpErrorCode?.canonicalName || 'INTERNAL';
            res.status(error.httpErrorCode?.code || 500).send({ error: { status, message: error.message } });
        }
    });
});
