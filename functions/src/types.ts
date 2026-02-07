
export type Role = "admin" | "company" | "courier" | "customer-service";

export type User = {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  role: Role;
  companyId?: string;
  companyName?: string;
  avatarUrl?: string;
  createdAt: any; 
  commissionRate?: number; 
};

export type ShipmentStatusConfig = {
  id: string; 
  label: string; 
  affectsCourierBalance: boolean; 
  affectsCompanyBalance: boolean; 
  enabled: boolean; 
  visibleToCourier: boolean; 
  requiresFullCollection: boolean; 
  requiresPartialCollection: boolean; 
  isDeliveredStatus: boolean; 
  isReturnedStatus: boolean; 
};
  
export type Shipment = {
  id: string;
  shipmentCode: string; 
  senderName?: string; 
  orderNumber: string;
  trackingNumber?: string;
  recipientName: string;
  recipientPhone: string;
  governorateId?: string;
  address: string;
  deliveryDate: Date;
  status: string; 
  reason?: string;
  totalAmount: number;
  paidAmount: number;
  collectedAmount?: number; 
  requestedAmount?: number; 
  amountChangeReason?: string; 
  courierCommission?: number; 
  companyCommission?: number; 
  companyId: string; 
  assignedCourierId?: string; 
  createdAt: any; 
  updatedAt: any; 
  isArchivedForCourier?: boolean; 
  isArchivedForCompany?: boolean; 
  courierArchivedAt?: any;
  companyArchivedAt?: any;
  deliveredToCourierAt?: any;
  isWarehouseReturn?: boolean; 
  isReturnedToCompany?: boolean; 
  isExchange?: boolean; 
  isUrgent?: boolean; 
  isCustomReturn?: boolean; 
  retryAttempt?: boolean; 
  isLabelPrinted?: boolean; 
};

export interface ShipmentHistoryEntry {
    field: string;
    oldValue: any;
    newValue: any;
}

export type ShipmentHistory = {
  id: string;
  status?: string;
  reason?: string;
  updatedAt: any;
  updatedBy: string;
  userId: string;
  changes: ShipmentHistoryEntry[];
}

export interface Company {
  id: string;
  name: string;
  governorateCommissions?: { [governorateId: string]: number };
}
