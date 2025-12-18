
'use client';
import React from 'react';
import type { Shipment, ShipmentHistory, Governorate, Company, User, ShipmentStatusConfig } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { formatToCairoTime } from '@/lib/utils';
import { ArrowRight, FileText, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

interface DetailedHistoryCardProps {
    historyEntry: ShipmentHistory;
    shipment: Shipment | null | undefined;
    onShowDetails?: (shipment: Shipment) => void;
    onEdit?: (shipmentId: string) => void;
    onDelete?: (historyEntry: ShipmentHistory) => void;
    governorates?: Governorate[];
    companies?: Company[];
    couriers?: User[];
    statuses?: ShipmentStatusConfig[];
}

// A helper map to provide user-friendly labels for field names
const fieldLabels: { [key: string]: string } = {
  status: 'الحالة',
  reason: 'السبب / الملاحظة',
  totalAmount: 'المبلغ الإجمالي',
  paidAmount: 'المبلغ المدفوع',
  collectedAmount: 'المبلغ المحصّل',
  recipientName: 'اسم المستلم',
  recipientPhone: 'هاتف المستلم',
  address: 'العنوان',
  governorateId: 'المحافظة',
  assignedCourierId: 'المندوب',
  companyId: 'الشركة',
  orderNumber: 'رقم الطلب',
  shipmentCode: 'كود الشحنة',
  senderName: 'الراسل',
  isUrgent: 'شحنة مستعجلة',
  isExchange: 'شحنة استبدال',
  isCustomReturn: 'استرجاع مخصص',
  retryAttempt: 'إعادة محاولة',
  isWarehouseReturn: 'مرتجع للمخزن',
  isReturnedToCompany: 'مرتجع للشركة',
};

export function DetailedHistoryCard({ 
    historyEntry, 
    shipment,
    onShowDetails,
    onEdit,
    onDelete,
    governorates = [],
    companies = [],
    couriers = [],
    statuses = [],
}: DetailedHistoryCardProps) {

    const formatValue = (field: string, value: any): string => {
        if (value === null || value === undefined || value === '') return 'فارغ';
        
        switch (field) {
            case 'status':
                return statuses.find(s => s.id === value)?.label || value;
            case 'governorateId':
                return governorates.find(g => g.id === value)?.name || value;
            case 'companyId':
                return companies.find(c => c.id === value)?.name || value;
            case 'assignedCourierId':
                return couriers.find(u => u.id === value)?.name || 'غير معين';
            case 'isUrgent':
            case 'isExchange':
            case 'isCustomReturn':
            case 'retryAttempt':
            case 'isWarehouseReturn':
            case 'isReturnedToCompany':
                return value ? 'نعم' : 'لا';
            case 'totalAmount':
            case 'paidAmount':
            case 'collectedAmount':
            case 'requestedAmount':
                 if (typeof value === 'number') {
                     return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(value);
                 }
                 return String(value);
            default:
                return String(value);
        }
    };
    
    // Legacy support for old history entries which had a single 'status' change
    const hasDetailedChanges = historyEntry.changes && historyEntry.changes.length > 0;
    const legacyChange = historyEntry.status
        ? { field: 'status', oldValue: 'غير معروف', newValue: historyEntry.status }
        : null;
    const changesToShow = hasDetailedChanges ? historyEntry.changes : (legacyChange ? [legacyChange] : []);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarFallback>{historyEntry.updatedBy?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <CardTitle className="text-base font-bold">{historyEntry.updatedBy}</CardTitle>
                        <p className="text-xs text-muted-foreground">{formatToCairoTime(historyEntry.updatedAt)}</p>
                    </div>
                </div>
                {shipment && (
                     <div className="flex items-center gap-2">
                        {onShowDetails && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onShowDetails(shipment)}>
                                <FileText className="h-4 w-4" />
                                <span className="sr-only">عرض التفاصيل</span>
                            </Button>
                        )}
                        {onEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(shipment.id)}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">تعديل</span>
                            </Button>
                        )}
                         {onDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(historyEntry)}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">حذف</span>
                            </Button>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <Separator className="my-2" />
                <div className="space-y-2 pt-2 text-sm">
                    {changesToShow.map((change, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-3 font-semibold text-muted-foreground">{fieldLabels[change.field] || change.field}:</span>
                            <span className="col-span-4 truncate text-right">{formatValue(change.field, change.oldValue)}</span>
                            <ArrowRight className="h-4 w-4 mx-auto text-primary col-span-1" />
                            <span className="col-span-4 font-bold text-primary truncate">{formatValue(change.field, change.newValue)}</span>
                        </div>
                    ))}
                    {historyEntry.reason && !changesToShow.some(c => c.field === 'reason') && (
                         <div className="grid grid-cols-12 gap-2 items-center">
                            <span className="col-span-3 font-semibold text-muted-foreground">السبب:</span>
                            <span className="col-span-9 font-bold">{historyEntry.reason}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
