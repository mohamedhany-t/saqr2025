export type Role = "admin" | "company" | "courier";

export type User = {
  id: string; // This will be the Firebase Auth UID
  name?: string;
  email: string;
  role: Role;
  companyId?: string; // For company users, linking to a company in /companies
  companyName?: string; // Denormalized for display
  deliveryCompanyId?: string; // For couriers, linking to a delivery company
  avatarUrl?: string;
  createdAt: any; // Can be Date or Firebase Timestamp
};

export type ShipmentStatus =
  | "Pending"
  | "In-Transit"
  | "Delivered"
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
  companyId: string; // Corresponds to a document ID in /companies
  subClientId?: string | null;
  status: ShipmentStatus;
  reason?: string;
  totalAmount: number;
  paidAmount: number;
  assignedCompanyId?: string; // Corresponds to a document ID in /deliveryCompanies
  assignedCourierId?: string; // Corresponds to a document ID in /couriers
  createdAt: any; // Can be Date or Firebase Timestamp
  updatedAt: any; // Can be Date or Firebase Timestamp
};

export interface Company {
  id: string;
  name: string;
}

export interface SubClient {
  id: string;
  companyId: string;
  name: string;
}

export interface Courier {
  id: string;
  name: string;
  deliveryCompanyId: string;
}

export interface Governorate {
  id: string;
  name: string;
}
