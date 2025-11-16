export type Role = "admin" | "courier";

export type User = {
  id: string; // This will be the Firebase Auth UID
  name?: string;
  email: string;
  role: Role;
  deliveryCompanyId?: string; // For couriers, linking to a delivery company
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
  | "Returned";

export type Shipment = {
  id: string;
  shipmentCode: string; // SH-YYYYMMDD-0001
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
  assignedCompanyId?: string; // Corresponds to a document ID in /deliveryCompanies
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
  deliveryCompanyId: string;
  commissionRate?: number;
}

export interface Governorate {
  id: string;
  name: string;
}
