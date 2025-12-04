
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * A callable function to get aggregated dashboard statistics.
 * This offloads the calculation from the client.
 */
export const getDashboardStats = functions.https.onCall(async (data, context) => {
  // Enforce authentication and admin role.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const adminDoc = await db.collection("roles_admin").doc(context.auth.uid).get();
  if (!adminDoc.exists) {
      throw new functions.https.HttpsError(
          "permission-denied",
          "The function must be called by an admin user."
      );
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
  } catch (error) {
    console.error("Error calculating dashboard stats:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to calculate dashboard statistics."
    );
  }
});
