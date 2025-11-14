export type Role = "admin" | "company" | "courier";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  companyId?: string;
  companyName?: string;
  avatarUrl?: string;
  createdAt: Date;
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
  companyId: string;
  subClientId?: string | null;
  status: ShipmentStatus;
  reason?: string;
  totalAmount: number;
  paidAmount: number;
  assignedCompanyId?: string;
  assignedCourierId?: string;
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

    