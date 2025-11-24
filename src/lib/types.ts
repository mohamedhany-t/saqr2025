

import type { User as AuthUser } from 'firebase/auth';

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
  | "Evasion (Phone)"
  | "Evasion (Delivery Attempt)"
  | "Cancelled"
  | "Returned"
  | "Postponed"
  | "Returned to Sender"
  | "Refused (Paid)"
  | "Refused (Unpaid)"
  | "Returned to Warehouse";

export type Shipment = {
  id: string;
  shipmentCode: string; // SH-YYYYMMDD-0001
  senderName?: string; // Sub-client
  orderNumber: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  governorateId?: string;
  address: string;
  deliveryDate: Date;
  status: ShipmentStatus;
  reason?: string;
  totalAmount: number;
  paidAmount: number;
  collectedAmount?: number; // For partial delivery
  courierCommission?: number; // Calculated commission for the courier on this shipment
  companyCommission?: number; // Calculated commission for the company on this shipment
  companyId: string; // The company that owns this shipment. (was assignedCompanyId)
  assignedCourierId?: string; // Corresponds to a document ID in /couriers
  createdAt: any; // Can be Date or Firebase Timestamp
  updatedAt: any; // Can be Date or Firebase Timestamp
  isArchived?: boolean; // For settling courier accounts
};

export interface Company {
  id: string;
  name: string;
  governorateCommissions?: { [governorateId: string]: number };
}

export interface Courier {
  id: string;
  name: string;
  commissionRate?: number;
}

export interface Governorate {
  id:string;
  name: string;
}

export interface CourierPayment {
    id: string;
    courierId: string;
    amount: number;
    paymentDate: any; // Can be Date or Firebase Timestamp
    recordedById: string; // Admin UID
    notes?: string;
    isArchived?: boolean; // For settling courier accounts
}

export interface CompanyPayment {
    id: string;
    companyId: string;
    amount: number;
    paymentDate: any; // Can be Date or Firebase Timestamp
    recordedById: string; // Admin UID
    notes?: string;
    isArchived?: boolean;
}

export interface Chat {
    id: string;
    participants: string[];
    participantNames: { [key: string]: string };
    lastMessage?: string;
    lastMessageTimestamp: any;
    unreadCounts?: { [key: string]: number };
}

export interface ChatMessage {
    id: string;
    senderId: string;
    text?: string;
    imageUrl?: string;
    fileUrl?: string;
    fileName?: string;
    timestamp: any;
}
