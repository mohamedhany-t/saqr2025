"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateShipmentStatus = exports.getDashboardStats = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
admin.initializeApp();
const db = admin.firestore();
/**
 * A callable function to get aggregated dashboard statistics for an admin.
 */
exports.getDashboardStats = functions.https.onCall(async (data, context) => {
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
                case "In-Transit":
                    inTransit++;
                    break;
                case "Delivered":
                    delivered++;
                    break;
                case "Returned":
                case "Cancelled":
                case "Refused (Unpaid)":
                case "Evasion (Phone)":
                case "Partially Delivered":
                case "Evasion (Delivery Attempt)":
                case "Refused (Paid)":
                    returned++;
                    break;
                default: break;
            }
        });
        return { totalRevenue, inTransit, delivered, returned, totalShipments };
    }
    catch (error) {
        console.error("Error calculating dashboard stats:", error);
        throw new functions.https.HttpsError("internal", "Failed to calculate dashboard statistics.");
    }
});
/**
 * A callable function for a courier to update a shipment's status.
 * This centralizes logic and security checks.
 */
const updateShipmentStatusSchema = zod_1.z.object({
    shipmentId: zod_1.z.string(),
    status: zod_1.z.string(),
    reason: zod_1.z.string().optional(),
    collectedAmount: zod_1.z.number().optional(),
});
exports.updateShipmentStatus = functions.https.onCall(async (data, context) => {
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
            var _a;
            const shipmentDoc = await transaction.get(shipmentRef);
            if (!shipmentDoc.exists) {
                throw new functions.https.HttpsError("not-found", "Shipment not found.");
            }
            const shipmentData = shipmentDoc.data();
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
            if (!courierDoc.exists || !companyDoc.exists) {
                throw new functions.https.HttpsError("failed-precondition", "Courier or company data is missing.");
            }
            const courierData = courierDoc.data();
            const companyData = companyDoc.data();
            // Correctly find the status config using the document ID
            const statusConfigDoc = statusesSnapshot.docs.find(doc => doc.id === status);
            if (!statusConfigDoc) {
                throw new functions.https.HttpsError("invalid-argument", "Invalid status provided.");
            }
            const statusConfig = statusConfigDoc.data();
            const courierCommissionRate = courierData.commissionRate || 0;
            const companyGovernorateCommission = ((_a = companyData.governorateCommissions) === null || _a === void 0 ? void 0 : _a[shipmentData.governorateId]) || 0;
            // --- Commission Calculation Logic ---
            const updatePayload = { paidAmount: 0, courierCommission: 0, companyCommission: 0, collectedAmount: 0 };
            let amountForCalc = 0;
            if (statusConfig.requiresFullCollection) {
                amountForCalc = shipmentData.totalAmount || 0;
            }
            else if (statusConfig.requiresPartialCollection) {
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
            const finalShipmentUpdate = Object.assign(Object.assign({}, updatePayload), { status: status, reason: reason || "", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
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
    }
    catch (error) {
        console.error("Error updating shipment status:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error; // Re-throw HttpsError
        }
        throw new functions.https.HttpsError("internal", "An internal error occurred while updating the shipment.");
    }
});
//# sourceMappingURL=index.js.map