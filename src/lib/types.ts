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
  governorate: string;
  recipientAddress: string;
  deliveryDate: Date;
  client: string; // Company name
  subClient?: string;
  status: ShipmentStatus;
  reason?: string;
  totalAmount: number;
  paidAmount: number;
  assignedCompanyId?: string;
  assignedCourierId?: string;
  assignedCourierName?: string;
  createdAt: Date;
  updatedAt: Date;
};
