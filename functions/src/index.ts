
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { z } from "zod";

admin.initializeApp();
const db = admin.firestore();

/**
 * A callable function to get aggregated dashboard statistics for an admin.
 */
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


/**
 * A callable function for a courier to update a shipment's status.
 * This centralizes logic and security checks.
 */
const updateShipmentStatusSchema = z.object({
    shipmentId: z.string(),
    status: z.string(),
    reason: z.string().optional(),
    collectedAmount: z.number().optional(),
});
export const updateShipmentStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "You must be authenticated to update a shipment.");
    }
    const { uid: courierId, token } = context.auth;
    const validation = updateShipmentStatusSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", "The data provided is invalid.");
    }

    const { shipmentId, status, reason, collectedAmount } = validation.data;

    const shipmentRef = db.collection('shipments').doc(shipmentId);

    try {
        return await db.runTransaction(async (transaction) => {
            const shipmentDoc = await transaction.get(shipmentRef);
            if (!shipmentDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Shipment not found.");
            }
            const shipmentData = shipmentDoc.data()!;

            // Security Check: Ensure the caller is the assigned courier
            if (shipmentData.assignedCourierId !== courierId) {
                throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
            }

            // Fetch necessary data for commission calculation
            const [courierDoc, companyDoc, statusesSnapshot] = await Promise.all([
                db.collection('users').doc(courierId).get(),
                db.collection('companies').doc(shipmentData.companyId).get(),
                db.collection('shipment_statuses').get()
            ]);
            
            if (!courierDoc.exists() || !companyDoc.exists()) {
                throw new functions.https.HttpsError("failed-precondition", "Courier or company data is missing.");
            }

            const courierData = courierDoc.data()!;
            const companyData = companyDoc.data()!;
            
            // Correctly find the status config using the document ID
            const statusConfigDoc = statusesSnapshot.docs.find(doc => doc.id === status);
            
            if (!statusConfigDoc) {
                 throw new functions.https.HttpsError("invalid-argument", "Invalid status provided.");
            }
            const statusConfig = statusConfigDoc.data();
            
            const courierCommissionRate = courierData.commissionRate || 0;
            const companyGovernorateCommission = companyData.governorateCommissions?.[shipmentData.governorateId] || 0;
            
            // --- Commission Calculation Logic ---
            const updatePayload: any = { paidAmount: 0, courierCommission: 0, companyCommission: 0, collectedAmount: 0 };
            
            let amountForCalc = 0;
            if (statusConfig.requiresFullCollection) {
                amountForCalc = shipmentData.totalAmount || 0;
            } else if (statusConfig.requiresPartialCollection) {
                amountForCalc = collectedAmount || 0;
            }
            
            updatePayload.paidAmount = amountForCalc;
            updatePayload.collectedAmount = amountForCalc;
            
            if (amountForCalc > 0 && statusConfig.affectsCompanyBalance) {
                updatePayload.companyCommission = companyGovernorateCommission;
            }
            
            if (statusConfig.affectsCourierBalance) {
                updatePayload.courierCommission = courierCommissionRate;
            }
            // --- End Commission Calculation Logic ---

            // Prepare the final update object for the shipment
            const finalShipmentUpdate = {
                ...updatePayload,
                status: status,
                reason: reason || "",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            
            // Prepare history entry
            const historyRef = shipmentRef.collection('history').doc();
            const historyEntry = {
                status: status,
                reason: reason || '',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: token.name || token.email,
                userId: courierId,
            };
            
            // Perform writes in the transaction
            transaction.update(shipmentRef, finalShipmentUpdate);
            transaction.set(historyRef, historyEntry);

            return { success: true, message: "Shipment updated successfully." };
        });

    } catch (error: any) {
        console.error("Error updating shipment status:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error; // Re-throw HttpsError
        }
        throw new functions.https.HttpsError("internal", "An internal error occurred while updating the shipment.");
    }
});
