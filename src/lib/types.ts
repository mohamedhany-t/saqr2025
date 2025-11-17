export type Role = "admin" | "company" | "courier";

export type User = {
  id: string; // This will be the Firebase Auth UID
  name?: string;
  email: string;
  role: Role;
  companyId?: string; // For company users, this is their own ID. For couriers, it's optional.
  companyName?: string; // For company users
  avatarUrl?: string;
  createdAt: any; // Can be Date or Firebase Timestamp
  commissionRate?: number; // For couriers
};

export type ShipmentStatus =
  | "Pending"
  | "In-Transit"
  | "Delivered"
  | "Partially Delivered"
  | "Evasion"
  | "Cancelled"
  | "Returned"
  | "Postponed"
  | "Returned to Sender";

export type Shipment = {
  id: string;
  shipmentCode: string; // SH-YYYYMMDD-0001
  senderName?: string; // Sub-client
  orderNumber: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  governorateId: string;
  address: string;
  deliveryDate: Date;
  status: ShipmentStatus;
  reason?: string;
  totalAmount: number;
  paidAmount: number;
  collectedAmount?: number; // For partial delivery
  courierCommission?: number; // Calculated commission for the courier on this shipment
  companyId: string; // The company that owns this shipment. (was assignedCompanyId)
  assignedCourierId?: string; // Corresponds to a document ID in /couriers
  createdAt: any; // Can be Date or Firebase Timestamp
  updatedAt: any; // Can be Date or Firebase Timestamp
};

export interface Company {
  id: string;
  name: string;
}

export interface Courier {
  id: string;
  name: string;
  commissionRate?: number;
}

export interface Governorate {
  id: string;
  name: string;
}

export interface ChatMessage {
    id: string;
    text: string;
    imageUrl?: string;
    senderId: string;
    senderName: string;
    createdAt: any; // Firestore Timestamp
}
