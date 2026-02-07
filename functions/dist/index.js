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
exports.executeCompanySettlement = exports.handleShipmentUpdate = void 0;
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
    isReturningToCompany: zod_1.z.boolean().optional(),
    isArchivedForCourier: zod_1.z.boolean().optional(),
    isArchivedForCompany: zod_1.z.boolean().optional(),
    senderName: zod_1.z.string().optional(),
    isCustomReturn: zod_1.z.boolean().optional(),
    retryAttempt: zod_1.z.boolean().optional(),
    isLabelPrinted: zod_1.z.boolean().optional(),
    isUrgent: zod_1.z.boolean().optional(),
    isExchange: zod_1.z.boolean().optional(),
    shipmentCode: zod_1.z.string().optional(),
    createdAt: zod_1.z.any().optional(),
    isPriceChangeDecision: zod_1.z.boolean().optional(),
});
const runtimeOpts = {
    timeoutSeconds: 540,
    memory: '256MB',
};
exports.handleShipmentUpdate = functions.runWith(runtimeOpts).https.onRequest((req, res) => {
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
                res.status(401).send({ error: { status: 'UNAUTHENTICATED', message: 'The function must be called with an authenticated user token.' } });
                return;
            }
        }
        if (!context.auth) {
            res.status(401).send({ error: { status: 'UNAUTHENTICATED', message: 'The function must be called with an authenticated user token.' } });
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
                var _a, _b, _c, _d;
                const shipmentDoc = await transaction.get(shipmentRef);
                const isCreating = !shipmentDoc.exists;
                const oldData = isCreating ? {} : shipmentDoc.data();
                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) {
                    throw new functions.https.HttpsError("permission-denied", "User profile not found.");
                }
                const userProfile = userDoc.data();
                let isAuthorized = false;
                if (userProfile.role === 'admin' || userProfile.role === 'customer-service') {
                    isAuthorized = true;
                }
                else if (isCreating) {
                    if (userProfile.role === 'company')
                        isAuthorized = true;
                }
                else {
                    if (userProfile.role === 'courier' && oldData.assignedCourierId === userId)
                        isAuthorized = true;
                    if (userProfile.role === 'company' && oldData.companyId === userId)
                        isAuthorized = true;
                }
                if (!isAuthorized) {
                    throw new functions.https.HttpsError("permission-denied", "You do not have permission to perform this action.");
                }
                let finalUpdateData = Object.assign({}, updatePayload);
                // --- TRACKING DATES LOGIC ---
                // 1. Assignment Date: Set if assignedCourierId is new or changed
                if (updatePayload.assignedCourierId !== undefined) {
                    const newCourierId = updatePayload.assignedCourierId;
                    const oldCourierId = oldData.assignedCourierId || null;
                    if (newCourierId !== oldCourierId) {
                        if (newCourierId) {
                            finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.serverTimestamp();
                        }
                        else {
                            finalUpdateData.deliveredToCourierAt = admin.firestore.FieldValue.delete();
                        }
                    }
                }
                // 2. Courier Archival Date: Set if isArchivedForCourier is toggled to true
                if (updatePayload.isArchivedForCourier !== undefined) {
                    const newArchived = updatePayload.isArchivedForCourier;
                    const oldArchived = oldData.isArchivedForCourier || false;
                    if (newArchived !== oldArchived) {
                        if (newArchived === true) {
                            finalUpdateData.courierArchivedAt = admin.firestore.FieldValue.serverTimestamp();
                        }
                        else {
                            finalUpdateData.courierArchivedAt = admin.firestore.FieldValue.delete();
                        }
                    }
                }
                // 3. Company Archival Date: Set if isArchivedForCompany is toggled to true
                if (updatePayload.isArchivedForCompany !== undefined) {
                    const newArchived = updatePayload.isArchivedForCompany;
                    const oldArchived = oldData.isArchivedForCompany || false;
                    if (newArchived !== oldArchived) {
                        if (newArchived === true) {
                            finalUpdateData.companyArchivedAt = admin.firestore.FieldValue.serverTimestamp();
                        }
                        else {
                            finalUpdateData.companyArchivedAt = admin.firestore.FieldValue.delete();
                        }
                    }
                }
                if (finalUpdateData.isPriceChangeDecision) {
                    finalUpdateData.requestedAmount = admin.firestore.FieldValue.delete();
                    finalUpdateData.amountChangeReason = admin.firestore.FieldValue.delete();
                    delete finalUpdateData.isPriceChangeDecision;
                }
                if (updatePayload.status && updatePayload.status !== oldData.status) {
                    finalUpdateData.retryAttempt = false;
                    const statusesSnap = await db.collection('shipment_statuses').get();
                    const statusConfigs = statusesSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
                    const newStatusConfig = statusConfigs.find(s => s.id === updatePayload.status);
                    if (newStatusConfig) {
                        let paidAmount = 0;
                        const totalAmount = (_b = (_a = finalUpdateData.totalAmount) !== null && _a !== void 0 ? _a : oldData.totalAmount) !== null && _b !== void 0 ? _b : 0;
                        const collectedAmount = (_c = finalUpdateData.collectedAmount) !== null && _c !== void 0 ? _c : 0;
                        if (newStatusConfig.requiresFullCollection)
                            paidAmount = totalAmount;
                        else if (newStatusConfig.requiresPartialCollection)
                            paidAmount = collectedAmount;
                        finalUpdateData.paidAmount = paidAmount;
                        finalUpdateData.collectedAmount = paidAmount;
                        const isCustomReturn = (_d = finalUpdateData.isCustomReturn) !== null && _d !== void 0 ? _d : oldData.isCustomReturn;
                        if (isCustomReturn && newStatusConfig.isDeliveredStatus) {
                            finalUpdateData.paidAmount = -Math.abs(totalAmount);
                            finalUpdateData.collectedAmount = -Math.abs(totalAmount);
                        }
                        if (newStatusConfig.affectsCourierBalance) {
                            const courierId = finalUpdateData.assignedCourierId || oldData.assignedCourierId;
                            if (courierId) {
                                const courierProfileDoc = await db.collection('couriers').doc(courierId).get();
                                const commissionRate = (courierProfileDoc === null || courierProfileDoc === void 0 ? void 0 : courierProfileDoc.exists) ? courierProfileDoc.data().commissionRate || 0 : 0;
                                finalUpdateData.courierCommission = commissionRate;
                            }
                        }
                        else {
                            finalUpdateData.courierCommission = 0;
                        }
                        if (newStatusConfig.affectsCompanyBalance) {
                            const companyId = finalUpdateData.companyId || oldData.companyId;
                            if (companyId) {
                                const companyProfileDoc = await db.collection('companies').doc(companyId).get();
                                const governorateCommissions = (companyProfileDoc === null || companyProfileDoc === void 0 ? void 0 : companyProfileDoc.exists) ? companyProfileDoc.data().governorateCommissions || {} : {};
                                const governorateId = finalUpdateData.governorateId || oldData.governorateId;
                                const commission = governorateCommissions[governorateId] || 0;
                                finalUpdateData.companyCommission = commission;
                            }
                        }
                        else {
                            finalUpdateData.companyCommission = 0;
                        }
                    }
                }
                // Audit Log
                const newData = Object.assign(Object.assign({}, oldData), finalUpdateData);
                const changes = [];
                const allKeys = new Set([...Object.keys(oldData), ...Object.keys(finalUpdateData)]);
                for (const key of allKeys) {
                    const oldValue = oldData[key];
                    const newValue = newData[key];
                    if (JSON.stringify(oldValue) !== JSON.stringify(newValue) && typeof oldValue !== 'object' && typeof newValue !== 'object') {
                        changes.push({ field: key, oldValue: oldValue !== null && oldValue !== void 0 ? oldValue : null, newValue: newValue !== null && newValue !== void 0 ? newValue : null });
                    }
                }
                if (changes.length > 0) {
                    const historyRef = shipmentRef.collection('history').doc();
                    const historyEntry = {
                        changes,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedBy: userName || userEmail,
                        userId: userId,
                    };
                    transaction.set(historyRef, historyEntry);
                }
                if (isCreating) {
                    const dataToSet = Object.assign({}, finalUpdateData);
                    if (!dataToSet.createdAt) {
                        dataToSet.createdAt = admin.firestore.FieldValue.serverTimestamp();
                    }
                    dataToSet.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                    transaction.set(shipmentRef, dataToSet);
                }
                else {
                    const dataToUpdate = Object.assign(Object.assign({}, finalUpdateData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                    transaction.update(shipmentRef, dataToUpdate);
                }
                return { success: true, message: isCreating ? "Shipment created successfully." : "Shipment updated successfully." };
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
const settlementSchema = zod_1.z.object({
    companyId: zod_1.z.string(),
    paymentAmount: zod_1.z.number(),
    shipmentIdsToArchive: zod_1.z.array(zod_1.z.string()),
    settlementNote: zod_1.z.string().optional(),
});
exports.executeCompanySettlement = functions.runWith(runtimeOpts).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }
    const validation = settlementSchema.safeParse(data);
    if (!validation.success) {
        throw new functions.https.HttpsError('invalid-argument', 'The data provided is invalid.', validation.error.format());
    }
    const { companyId, paymentAmount, shipmentIdsToArchive, settlementNote } = validation.data;
    const adminId = context.auth.uid;
    const db = admin.firestore();
    const batch = db.batch();
    try {
        const paymentRef = db.collection('company_payments').doc();
        batch.set(paymentRef, {
            companyId,
            amount: paymentAmount,
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            recordedById: adminId,
            notes: settlementNote || 'تسوية عبر شيت',
            isArchived: true,
        });
        for (const shipmentId of shipmentIdsToArchive) {
            const shipmentRef = db.collection('shipments').doc(shipmentId);
            batch.update(shipmentRef, {
                isArchivedForCompany: true,
                companyArchivedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
        return { success: true, message: `تمت تسوية حساب الشركة وأرشفة ${shipmentIdsToArchive.length} شحنة بنجاح.` };
    }
    catch (error) {
        console.error('Error executing company settlement:', error);
        throw new functions.https.HttpsError('internal', 'Failed to execute settlement.', error.message);
    }
});
//# sourceMappingURL=index.js.map