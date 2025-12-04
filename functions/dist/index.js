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
exports.getDashboardStats = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
/**
 * A callable function to get aggregated dashboard statistics.
 * This offloads the calculation from the client.
 */
exports.getDashboardStats = functions.https.onCall(async (data, context) => {
    // Optional: Add authentication check
    // if (!context.auth) {
    //   throw new functions.https.HttpsError(
    //     "unauthenticated",
    //     "The function must be called while authenticated."
    //   );
    // }
    try {
        const shipmentsSnapshot = await db.collection("shipments").get();
        let totalRevenue = 0;
        let inTransit = 0;
        let delivered = 0;
        let returned = 0;
        const totalShipments = shipmentsSnapshot.size;
        shipmentsSnapshot.forEach((doc) => {
            const shipment = doc.data();
            // Calculate total revenue from delivered shipments
            if (shipment.paidAmount) {
                totalRevenue += shipment.paidAmount;
            }
            // Count statuses
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
                default:
                    break;
            }
        });
        return {
            totalRevenue,
            inTransit,
            delivered,
            returned,
            totalShipments,
        };
    }
    catch (error) {
        console.error("Error calculating dashboard stats:", error);
        throw new functions.https.HttpsError("internal", "Failed to calculate dashboard statistics.");
    }
});
//# sourceMappingURL=index.js.map