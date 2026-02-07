
import type { User as AuthUser } from 'firebase/auth';

export type Role = "admin" | "company" | "courier" | "customer-service";

export type User = {
  id: string; // This will be the Firebase Auth UID
  name?: string;
  email: string;
  phone?: string;
  role: Role;
  companyId?: string; // For company users, this is their own ID. For couriers, it's optional.
  companyName?: string; // For company users
  avatarUrl?: string;
  createdAt: any; // Can be Date or Firebase Timestamp
  commissionRate?: number; // For couriers
};

export type ShipmentStatusKey =
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
  | "PriceChangeRequested"
  | "PriceChangeRejected";


export type ShipmentStatusConfig = {
  id: string; // The unique key, e.g., 'pending'
  label: string; // The display name, e.g., 'قيد الانتظار'
  affectsCourierBalance: boolean; // Determines if it's counted in courier's financial calculations
  affectsCompanyBalance: boolean; // Determines if it's counted in company's financial calculations
  enabled: boolean; // Whether the status is active and can be used
  requiresFullCollection: boolean; // e.g., for "Delivered"
  requiresPartialCollection: boolean; // e.g., for "Partially Delivered", "Refused (Paid)"
  isDeliveredStatus: boolean; // Is this status counted as "delivered" for reports?
  isReturnedStatus: boolean; // Is this status counted as "returned" for reports?
  visibleToCourier?: boolean;
};
  
export type Shipment = {
  id: string;
  shipmentCode: string; // SH-YYYYMMDD-0001
  senderName?: string; // Sub-client
  orderNumber: string;
  trackingNumber?: string;
  recipientName: string;
  recipientPhone: string;
  governorateId?: string;
  address: string;
  deliveryDate: Date;
  status: string; // Now a string to hold the key from ShipmentStatusConfig
  reason?: string;
  totalAmount: number;
  paidAmount: number;
  collectedAmount?: number; // For partial delivery
  requestedAmount?: number; // For price change requests
  amountChangeReason?: string; // For price change requests
  courierCommission?: number; // Calculated commission for the courier on this shipment
  companyCommission?: number; // Calculated commission for the company on this shipment
  companyId: string; // The company that owns this shipment. (was assignedCompanyId)
  assignedCourierId?: string; // Corresponds to a document ID in /couriers
  createdAt: any; // Can be Date or Firebase Timestamp
  updatedAt: any; // Can be Date or Firebase Timestamp
  isArchivedForCourier?: boolean; // For settling courier accounts
  isArchivedForCompany?: boolean; // For settling company accounts
  courierArchivedAt?: any; // NEW: Timestamp when archived for courier
  companyArchivedAt?: any; // NEW: Timestamp when archived for company
  deliveredToCourierAt?: any; // NEW: Timestamp when assigned to courier
  isWarehouseReturn?: boolean; // To mark if the item is physically in the warehouse
  isReturningToCompany?: boolean; // To mark if the item is on its way back to the company
  isReturnedToCompany?: boolean; // To mark if the item has been returned to the original company
  isExchange?: boolean; // To mark the shipment as a package-for-package exchange
  isUrgent?: boolean; // To mark the shipment as urgent
  isCustomReturn?: boolean; // To mark the shipment as a custom return
  retryAttempt?: boolean; // To mark the shipment for a retry attempt
  isLabelPrinted?: boolean; // To track if the shipping label has been printed
};

export const expenseCategories = {
  transport: 'مواصلات',
  parking: 'شحن مواقف',
  tip: 'شاي / إكرامية',
  maintenance: 'صيانة',
  other: 'أخرى',
} as const;

export const expenseEntities = {
  courier: 'مندوب',
  office: 'مكتب',
  company: 'شركة',
  general: 'عام',
} as const;

export type ExpenseEntityType = keyof typeof expenseEntities;
export type ExpenseCategory = keyof typeof expenseCategories;

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  entityType: ExpenseEntityType;
  relatedUserId?: string; // For 'courier' or 'company'
  expenseDate: any;
  receiptImageUrl?: string;
  notes?: string;
  createdBy: string; // UID of the admin who recorded it
  createdAt: any;
  updatedAt: any;
};

export interface ShipmentHistoryEntry {
    field: string;
    oldValue: any;
    newValue: any;
}

export type ShipmentHistory = {
  id: string;
  status?: string; // Will be deprecated but kept for old records
  reason?: string; // Will be deprecated
  updatedAt: any;
  updatedBy: string; // User's name
  userId: string; // User's ID
  changes: ShipmentHistoryEntry[]; // The new detailed changes
}

export interface Company {
  id: string;
  name: string;
  governorateCommissions?: { [governorateId: string]: number };
}

export interface Courier {
  id: string;
  name: string;
  commissionRate?: number;
  adminNote?: {
    message: string;
    isRead: boolean;
    updatedAt: any;
  }
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
    isArchived?: boolean; 
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
