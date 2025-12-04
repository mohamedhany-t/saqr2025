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
exports.handleShipmentUpdate = exports.getDashboardStats = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
const cors_1 = __importDefault(require("cors"));
try {
    admin.initializeApp();
}
catch (e) {
    // This can happen in local dev environments
    if (!/already exists/.test(e.message)) {
        console.error('Firebase admin initialization error', e);
    }
}
const db = admin.firestore();
// Initialize cors middleware
const corsHandler = (0, cors_1.default)({ origin: true });
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
 * An HTTP Request function for a courier to update a shipment's status.
 * This centralizes logic and security checks.
 */
const updateShipmentStatusSchema = zod_1.z.object({
    shipmentId: zod_1.z.string(),
    status: zod_1.z.string(),
    reason: zod_1.z.string().optional(),
    collectedAmount: zod_1.z.number(),
    paidAmount: zod_1.z.number(),
    courierCommission: zod_1.z.number(),
    companyCommission: zod_1.z.number(),
});
exports.handleShipmentUpdate = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a;
        if (req.method !== 'POST') {
            res.status(405).send({ error: { message: 'Method Not Allowed' } });
            return;
        }
        let context = {};
        if ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.startsWith('Bearer ')) {
            const idToken = req.headers.authorization.split('Bearer ')[1];
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                context.auth = decodedToken;
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
        const { uid: courierId, token } = context.auth;
        const validation = updateShipmentStatusSchema.safeParse(req.body.data);
        if (!validation.success) {
            console.error("Validation failed:", validation.error);
            res.status(400).send({ error: { status: 'INVALID_ARGUMENT', message: 'The data provided is invalid.' } });
            return;
        }
        const _b = validation.data, { shipmentId, status, reason } = _b, financials = __rest(_b, ["shipmentId", "status", "reason"]);
        const shipmentRef = db.collection('shipments').doc(shipmentId);
        try {
            const result = await db.runTransaction(async (transaction) => {
                const shipmentDoc = await transaction.get(shipmentRef);
                if (!shipmentDoc.exists) {
                    throw new functions.https.HttpsError("not-found", "Shipment not found.");
                }
                const shipmentData = shipmentDoc.data();
                if (shipmentData.assignedCourierId !== courierId) {
                    throw new functions.https.HttpsError("permission-denied", "You are not assigned to this shipment.");
                }
                const finalShipmentUpdate = Object.assign(Object.assign({}, financials), { status: status, reason: reason || "", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
                const historyRef = shipmentRef.collection('history').doc();
                const historyEntry = {
                    status: status,
                    reason: reason || '',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: token.name || token.email,
                    userId: courierId,
                };
                transaction.update(shipmentRef, finalShipmentUpdate);
                transaction.set(historyRef, historyEntry);
                return { success: true, message: "Shipment updated successfully." };
            });
            // Send success response back to client
            res.status(200).send({ data: result });
        }
        catch (error) {
            console.error("Error updating shipment status:", error);
            // Send internal error response
            res.status(500).send({ error: { status: 'INTERNAL', message: error.message } });
        }
    });
});
//# sourceMappingURL=index.js.map