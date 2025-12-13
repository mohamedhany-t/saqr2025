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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleShipmentUpdate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
const cors_1 = __importDefault(require("cors"));
try {
    admin.initializeApp();
}
catch (e) {
    if (!/already exists/.test(e.message)) {
        console.error('Firebase admin initialization error', e);
    }
}
const db = admin.firestore();
const corsHandler = (0, cors_1.default)({ origin: true });
// This flexible schema now accepts all possible fields from both
// courier and admin roles, making them optional to avoid validation errors.
const updateShipmentStatusSchema = zod_1.z.object({
    shipmentId: zod_1.z.string(),
    status: zod_1.z.string(),
    reason: zod_1.z.string().optional(),
    collectedAmount: zod_1.z.number().optional(),
    // --- Fields for Courier's Price Change Request ---
    requestedAmount: zod_1.z.number().optional(),
    amountChangeReason: zod_1.z.string().optional(),
    // --- Optional fields that Admin OR COURIER can now send ---
    paidAmount: zod_1.z.number().optional(),
    courierCommission: zod_1.z.number().optional(),
    // --- Optional fields that only Admin can send ---
    recipientName: zod_1.z.string().optional(),
    recipientPhone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    totalAmount: zod_1.z.number().optional(),
    governorateId: zod_1.z.string().optional(),
    assignedCourierId: zod_1.z.string().optional(),
    companyId: zod_1.z.string().optional(),
    orderNumber: zod_1.z.string().optional(),
    companyCommission: zod_1.z.number().optional(),
    isWarehouseReturn: zod_1.z.boolean().optional(),
    isReturnedToCompany: zod_1.z.boolean().optional(),
    isArchivedForCourier: zod_1.z.boolean().optional(),
    isArchivedForCompany: zod_1.z.boolean().optional(),
    senderName: zod_1.z.string().optional(),
    isCustomReturn: zod_1.z.boolean().optional(),
});
exports.handleShipmentUpdate = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c;
        if (req.method !== 'POST') {
            res.status(405).send({ error: { message: 'Method Not Allowed' } });
            return;
        }
        let context = {};
        const idToken = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split('Bearer ')[1];
        if (idToken) {
            try {
                context.auth = await admin.auth().verifyIdToken(idToken);
            }
            catch (error) {
                console.error('Error verifying token:', error);
                res.status(401).send({ error: { status: 'UNAUTHENTICATED' } });
                return;
            }
        }
        if (!context.auth) {
            res.status(401).send({ error: { status: 'UNAUTHENTICATED' } });
            return;
        }
        const { uid: userId, name: userName, email: userEmail } = context.auth;
        const validation = updateShipmentStatusSchema.safeParse(req.body.data);
        if (!validation.success) {
            console.error("Validation failed:", validation.error.errors);
            res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'The data provided is invalid.' } });
            return;
        }
        const validatedData = validation.data;
        const shipmentId = validatedData.shipmentId;
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        try {
            const result = await db.runTransaction(async (transaction) => {
                var _a, _b, _c;
                const shipmentDoc = await transaction.get(shipmentRef);
                if (!shipmentDoc.exists) {
                    throw new functions.https.HttpsError("not-found", "Shipment not found.");
                }
                const shipmentData = shipmentDoc.data();
                // Allow admin to edit any shipment, but courier/company can only edit their own.
                const userRoleDoc = await db.collection('roles_admin').doc(userId).get();
                const isAdmin = userRoleDoc.exists;
                if (!isAdmin && shipmentData.assignedCourierId !== userId && shipmentData.companyId !== userId) {
                    throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
                }
                // Construct the final update object from validated, non-undefined data
                const finalShipmentUpdate = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                // Add all valid fields from the request to the update object
                for (const key in validatedData) {
                    if (Object.prototype.hasOwnProperty.call(validatedData, key) && validatedData[key] !== undefined && key !== 'shipmentId') {
                        finalShipmentUpdate[key] = validatedData[key];
                    }
                }
                // If isCustomReturn is true and the status is a "delivered" status, make the paidAmount negative.
                const isCustomReturn = shipmentData.isCustomReturn === true || validatedData.isCustomReturn === true;
                const statusConfigDoc = await db.collection('shipment_statuses').doc(validatedData.status).get();
                const isDeliveredStatus = statusConfigDoc.exists && ((_a = statusConfigDoc.data()) === null || _a === void 0 ? void 0 : _a.isDeliveredStatus) === true;
                if (isCustomReturn && isDeliveredStatus) {
                    const totalAmount = (_c = (_b = validatedData.totalAmount) !== null && _b !== void 0 ? _b : shipmentData.totalAmount) !== null && _c !== void 0 ? _c : 0;
                    finalShipmentUpdate.paidAmount = -Math.abs(totalAmount);
                    finalShipmentUpdate.collectedAmount = -Math.abs(totalAmount);
                }
                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: validatedData.status,
                    reason: validatedData.reason || validatedData.amountChangeReason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: userName || userEmail,
                    userId: userId,
                };
                transaction.update(shipmentRef, finalShipmentUpdate);
                transaction.set(historyRef, historyEntry);
                return { success: true, message: "Shipment updated successfully." };
            });
            res.status(200).send({ data: result });
        }
        catch (error) {
            console.error("Error updating shipment status:", error);
            const status = ((_b = error.httpErrorCode) === null || _b === void 0 ? void 0 : _b.canonicalName) || 'INTERNAL';
            res.status(((_c = error.httpErrorCode) === null || _c === void 0 ? void 0 : _c.code) || 500).send({ error: { status, message: error.message } });
        }
    });
});
//# sourceMappingURL=index.js.map