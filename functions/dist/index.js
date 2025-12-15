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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
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
const updateShipmentStatusSchema = zod_1.z.object({
    shipmentId: zod_1.z.string(),
    // All other fields are optional because the logic will decide what to do
    status: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional(),
    collectedAmount: zod_1.z.coerce.number().optional(),
    requestedAmount: zod_1.z.coerce.number().optional(),
    amountChangeReason: zod_1.z.string().optional(),
    recipientName: zod_1.z.string().optional(),
    recipientPhone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    totalAmount: zod_1.z.coerce.number().optional(),
    governorateId: zod_1.z.string().optional(),
    assignedCourierId: zod_1.z.string().optional(),
    companyId: zod_1.z.string().optional(),
    orderNumber: zod_1.z.string().optional(),
    isWarehouseReturn: zod_1.z.boolean().optional(),
    isReturnedToCompany: zod_1.z.boolean().optional(),
    isArchivedForCourier: zod_1.z.boolean().optional(),
    isArchivedForCompany: zod_1.z.boolean().optional(),
    senderName: zod_1.z.string().optional(),
    isCustomReturn: zod_1.z.boolean().optional(),
    retryAttempt: zod_1.z.boolean().optional(),
    isLabelPrinted: zod_1.z.boolean().optional(),
    isUrgent: zod_1.z.boolean().optional(),
    isExchange: zod_1.z.boolean().optional(),
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
        const { shipmentId } = validatedData, updatePayload = __rest(validatedData, ["shipmentId"]);
        if (!shipmentId) {
            res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'Shipment ID is required.' } });
            return;
        }
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        try {
            const result = await db.runTransaction(async (transaction) => {
                var _a, _b, _c, _d, _e;
                const shipmentDoc = await transaction.get(shipmentRef);
                if (!shipmentDoc.exists) {
                    throw new functions.https.HttpsError("not-found", "Shipment not found.");
                }
                const shipmentData = shipmentDoc.data();
                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) {
                    throw new functions.https.HttpsError("permission-denied", "User profile not found.");
                }
                const userProfile = userDoc.data();
                if (userProfile.role !== 'admin' && shipmentData.assignedCourierId !== userId && shipmentData.companyId !== userId) {
                    throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
                }
                const finalUpdate = Object.assign(Object.assign({}, updatePayload), { updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                // If status is being changed, we need to recalculate financial fields
                if (updatePayload.status && updatePayload.status !== shipmentData.status) {
                    finalUpdate.retryAttempt = false; // Reset retry flag on any status update
                    const statusesSnap = await db.collection('shipment_statuses').get();
                    const statusConfigs = statusesSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
                    const newStatusConfig = statusConfigs.find(s => s.id === updatePayload.status);
                    if (newStatusConfig) {
                        let paidAmount = 0;
                        const totalAmount = (_b = (_a = finalUpdate.totalAmount) !== null && _a !== void 0 ? _a : shipmentData.totalAmount) !== null && _b !== void 0 ? _b : 0;
                        const collectedAmount = (_c = finalUpdate.collectedAmount) !== null && _c !== void 0 ? _c : 0;
                        if (newStatusConfig.requiresFullCollection) {
                            paidAmount = totalAmount;
                        }
                        else if (newStatusConfig.requiresPartialCollection) {
                            paidAmount = collectedAmount;
                        }
                        finalUpdate.paidAmount = paidAmount;
                        finalUpdate.collectedAmount = paidAmount; // Align collected with paid for consistency
                        // --- Start of Custom Return Logic ---
                        // This logic MUST come after initial paidAmount calculation but before commission calculation.
                        const isCustomReturn = (_d = finalUpdate.isCustomReturn) !== null && _d !== void 0 ? _d : shipmentData.isCustomReturn;
                        if (isCustomReturn && newStatusConfig.isDeliveredStatus) {
                            finalUpdate.paidAmount = -Math.abs(totalAmount);
                            finalUpdate.collectedAmount = -Math.abs(totalAmount);
                        }
                        // --- End of Custom Return Logic ---
                        // Handle courier commission
                        if (newStatusConfig.affectsCourierBalance) {
                            const courierProfileDoc = shipmentData.assignedCourierId ? await db.collection('couriers').doc(shipmentData.assignedCourierId).get() : null;
                            const commissionRate = (courierProfileDoc === null || courierProfileDoc === void 0 ? void 0 : courierProfileDoc.exists) ? courierProfileDoc.data().commissionRate || 0 : 0;
                            finalUpdate.courierCommission = commissionRate;
                        }
                        else {
                            finalUpdate.courierCommission = 0;
                        }
                        // Handle company commission
                        if (newStatusConfig.affectsCompanyBalance) {
                            const companyProfileDoc = await db.collection('companies').doc(shipmentData.companyId).get();
                            const governorateCommissions = ((_e = companyProfileDoc.data()) === null || _e === void 0 ? void 0 : _e.governorateCommissions) || {};
                            const commission = governorateCommissions[shipmentData.governorateId] || 0;
                            finalUpdate.companyCommission = commission;
                        }
                        else {
                            finalUpdate.companyCommission = 0;
                        }
                    }
                }
                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: finalUpdate.status || shipmentData.status,
                    reason: finalUpdate.reason || finalUpdate.amountChangeReason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: userName || userEmail,
                    userId: userId,
                };
                transaction.update(shipmentRef, finalUpdate);
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