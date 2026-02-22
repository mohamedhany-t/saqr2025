
'use client';
import React from 'react';
import type { Shipment, ShipmentHistory, Governorate, Company, User, ShipmentStatusConfig, ShipmentHistoryEntry } from '@/lib/types';
import { Card, CardContent, CardHeader } from '../ui/card';
import { formatToCairoTime } from '@/lib/utils';
import { ArrowRight, User as UserIcon, MapPin, DollarSign, Tag, Clock, CheckCircle2, History as HistoryIcon, Edit3, Trash2, ArrowLeft, Search, Pencil } from 'lucide-react';
import { Button } from '../ui/button';

// 1. Correctly define the interface first.
interface DetailedHistoryCardProps {
    historyEntry: ShipmentHistory;
    shipment: Shipment | null | undefined;
    onShowDetails?: (shipment: Shipment) => void;
    onEdit?: (shipmentId: string) => void;
    onDelete?: (historyEntry: ShipmentHistory) => void;
    governorates?: Governorate[];
    companies?: Company[];
    couriers?: User[];
    statuses?: ShipmentStatusConfig[]; // Add statuses to the props
}

// 2. Define constants outside the interface.
const fieldLabels: { [key: string]: string } = {
  status: 'الحالة',
  reason: 'الملاحظات / السبب',
  totalAmount: 'المبلغ الإجمالي',
  paidAmount: 'المبلغ المدفوع',
  collectedAmount: 'المبلغ المحصّل',
  recipientName: 'اسم المستلم',
  recipientPhone: 'رقم الهاتف',
  address: 'العنوان بالتفصيل',
  governorateId: 'المحافظة',
  assignedCourierId: 'المندوب المسؤول',
  companyId: 'الشركة / العميل',
  orderNumber: 'رقم الأوردر',
  shipmentCode: 'كود الشحنة',
  senderName: 'اسم الراسل',
  isUrgent: 'مستعجل',
  isExchange: 'استبدال',
  isCustomReturn: 'مرتجع مخصص',
  retryAttempt: 'إعادة محاولة',
  isWarehouseReturn: 'دخل المخزن',
  isReturnedToCompany: 'رجع للشركة',
  isReturningToCompany: 'قيد الرجوع للشركة',
  isLabelPrinted: 'طباعة الملصق',
  isArchivedForCompany: 'أرشفة للشركة',
  isArchivedForCourier: 'أرشفة للمندوب',
};

const getActionTitle = (changes: ShipmentHistoryEntry[] | undefined, oldS: string, newS: string): { title: string, icon: any, color: string, bgColor: string } => {
    if (!changes || changes.length === 0) return { title: "تحديث بيانات", icon: Edit3, color: "text-blue-600", bgColor: "bg-blue-50" };
    
    const fields = new Set(changes.map(c => c.field));
    
    if (fields.has('status')) return { title: `تغيير الحالة: ${newS}`, icon: CheckCircle2, color: "text-green-700", bgColor: "bg-green-50" };
    if (fields.has('assignedCourierId')) return { title: "تعديل المندوب", icon: UserIcon, color: "text-purple-700", bgColor: "bg-purple-50" };
    if (fields.has('totalAmount')) return { title: "تعديل السعر", icon: DollarSign, color: "text-amber-700", bgColor: "bg-amber-50" };
    if (fields.has('address') || fields.has('governorateId')) return { title: "تعديل العنوان", icon: MapPin, color: "text-indigo-700", bgColor: "bg-indigo-50" };
    if (fields.has('isWarehouseReturn')) return { title: "تحديث حالة المخزن", icon: HistoryIcon, color: "text-slate-700", bgColor: "bg-slate-50" };
    
    return { title: "تحديث معلومات", icon: Edit3, color: "text-slate-700", bgColor: "bg-slate-50" };
};

// 3. Define the main component.
export function DetailedHistoryCard({ 
    historyEntry, 
    shipment, 
    onShowDetails,
    onEdit,
    onDelete,
    governorates = [], 
    companies = [], 
    couriers = [], 
    statuses = [] 
}: DetailedHistoryCardProps) {
    
    const formatValue = (field: string, val: any): string => {
        if (val === null || val === undefined || val === '' || val === 'فارغ') return 'غير محدد';
        
        switch (field) {
            case 'status': 
                return statuses.find(s => s.id === val)?.label || String(val);
            case 'governorateId': 
                return governorates.find(g => g.id === val)?.name || String(val);
            case 'companyId': 
                return companies.find(c => c.id === val)?.name || String(val);
            case 'assignedCourierId': 
                const courier = couriers.find(u => u.id === val);
                return courier ? (courier.name || 'مجهول') : (val === '' ? 'إلغاء التعيين' : 'غير موجود بالنظام');
            case 'totalAmount': case 'paidAmount': case 'collectedAmount':
                return typeof val === 'number' ? val.toLocaleString('ar-EG') + ' ج.م' : String(val);
            case 'isUrgent': case 'isExchange': case 'isWarehouseReturn': case 'retryAttempt':
            case 'isReturnedToCompany': case 'isReturningToCompany':
                return val === true || val === 'true' ? 'نعم' : 'لا';
            default: 
                return String(val);
        }
    };
    
    const changesToShow = (historyEntry.changes || []).filter(c => c.field !== 'updatedAt' && c.field !== 'updatedBy');
    
    const statusChange = changesToShow.find(c => c.field === 'status');
    const { title, icon: ActionIcon, color, bgColor } = getActionTitle(
        changesToShow, 
        formatValue('status', statusChange?.oldValue), 
        formatValue('status', statusChange?.newValue)
    );
    return (
        <div className="relative pr-8 pb-8 border-r-2 border-slate-200 last:border-r-0 last:pb-0 mr-4 group">
            {/* Timeline Dot & Icon */}
            <div className={`absolute -right-[19px] top-0 rounded-full p-2 bg-white border-2 shadow-sm transition-transform group-hover:scale-110 z-10 ${color.replace('text', 'border')}`}>
                <ActionIcon className={`h-5 w-5 ${color}`} />
            </div>
            <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-white rounded-xl">
                <CardHeader className={`p-4 flex flex-col items-center justify-between sm:flex-row space-y-0 ${bgColor}`}>
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <span className="font-bold text-lg text-slate-800 leading-none text-right sm:text-right">{historyEntry.updatedBy}</span>
                        <div className="flex items-center gap-2 text-slate-500 justify-start">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{formatToCairoTime(historyEntry.updatedAt)}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 sm:mt-0">
                        <Badge className={`${color} ${bgColor} border-none shadow-none text-sm font-bold`}>
                            {title}
                        </Badge>
                        <div className="flex gap-1">
                            {shipment && onShowDetails && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => onShowDetails(shipment)}>
                                    <Search className="h-4 w-4" />
                                </Button>
                            )}
                            {shipment && onEdit && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => onEdit(shipment.id)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                            {onDelete && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => onDelete(historyEntry)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                
                <CardContent className="p-4 bg-white">
                    {shipment && (
                        <div className="mb-4 flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-dashed border-slate-200">
                             <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">الشحنة:</span>
                                <span className="text-sm font-bold text-slate-700">{shipment.shipmentCode}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">المرسل إليه:</span>
                                <span className="text-sm font-medium text-slate-700">{shipment.recipientName}</span>
                             </div>
                        </div>
                    )}
                    <div className="space-y-3">
                        {changesToShow.length > 0 ? (
                            changesToShow.map((change, i) => (
                                <div key={i} className="flex flex-col gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                            <Tag className="h-3.5 w-3.5 opacity-50" />
                                            {fieldLabels[change.field] || change.field}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white p-2 rounded border border-slate-100 shadow-sm">
                                        <div className="flex-1 text-center">
                                            <p className="text-[10px] text-slate-400 mb-1">من</p>
                                            <span className="text-sm font-medium text-slate-400 line-through truncate block">
                                                {formatValue(change.field, change.oldValue)}
                                            </span>
                                        </div>
                                        <ArrowLeft className="h-5 w-5 text-slate-300" />
                                        <div className="flex-1 text-center">
                                            <p className="text-[10px] text-primary mb-1">إلى</p>
                                            <span className="text-base font-bold text-primary truncate block">
                                                {formatValue(change.field, change.newValue)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-2">لا توجد تفاصيل إضافية لهذا التعديل</p>
                        )}
                    </div>
                    
                    {historyEntry.reason && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                            <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                                <HistoryIcon className="h-3.5 w-3.5" /> ملاحظة إدارية:
                            </p>
                            <p className="text-sm text-amber-900 font-medium leading-relaxed">{historyEntry.reason}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// 4. Define a simple Badge component since the original one is not in scope.
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
            {children}
        </span>
    );
}
