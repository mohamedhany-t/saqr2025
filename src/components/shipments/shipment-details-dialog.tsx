
'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Shipment, Company, User, Governorate } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building, User as UserIcon, Truck, MapPin, Phone, Hash, Barcode, Calendar, DollarSign, Package, Archive, Clock } from 'lucide-react';
import { ShipmentHistoryTimeline } from './shipment-history-timeline';
import { formatToCairoTime } from '@/lib/utils';

interface ShipmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: Shipment | null;
  company?: Company | null;
  courier?: User | null;
  governorate?: Governorate | null;
}

const DetailRow = ({ icon: Icon, label, value, valueClass = '' }: { icon: React.ElementType, label: string, value: React.ReactNode, valueClass?: string }) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 text-muted-foreground mt-1" />
            <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`font-semibold ${valueClass}`}>{value}</span>
            </div>
        </div>
    );
};

export function ShipmentDetailsDialog({
  open,
  onOpenChange,
  shipment,
  company,
  courier,
  governorate,
}: ShipmentDetailsDialogProps) {
  if (!shipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl">تفاصيل الشحنة: {shipment.recipientName}</DialogTitle>
          <DialogDescription>
            عرض شامل لجميع بيانات الشحنة وسجل التتبع الخاص بها.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 grid md:grid-cols-2 gap-8 overflow-y-auto pr-2">
            {/* Left Side: Details */}
            <div className="space-y-4">
                 <h3 className="font-bold text-lg text-primary border-b pb-2">بيانات الشحنة</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <DetailRow icon={Package} label="الراسل" value={shipment.senderName || company?.name} />
                    <DetailRow icon={Building} label="الشركة" value={company?.name} />
                    <DetailRow icon={Hash} label="رقم الطلب" value={shipment.orderNumber} valueClass="font-mono" />
                    <DetailRow icon={Barcode} label="كود الشحنة" value={shipment.shipmentCode} valueClass="font-mono" />
                    <DetailRow icon={DollarSign} label="المبلغ الإجمالي" value={shipment.totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })} />
                    <DetailRow icon={Calendar} label="تاريخ الإنشاء" value={formatToCairoTime(shipment.createdAt)} />
                 </div>
                 
                 <Separator />
                 <h3 className="font-bold text-sm text-muted-foreground border-b pb-1">تواريخ التتبع الإداري</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <DetailRow icon={Clock} label="تسليم المندوب" value={formatToCairoTime(shipment.deliveredToCourierAt)} />
                    <DetailRow icon={Archive} label="أرشفة المندوب" value={formatToCairoTime(shipment.courierArchivedAt)} />
                    <DetailRow icon={Archive} label="أرشفة الشركة" value={formatToCairoTime(shipment.companyArchivedAt)} />
                 </div>

                 <Separator />
                 <h3 className="font-bold text-lg text-primary border-b pb-2">بيانات المستلم</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailRow icon={UserIcon} label="الاسم" value={shipment.recipientName} />
                    <DetailRow icon={Phone} label="الهاتف" value={shipment.recipientPhone} valueClass="font-mono" />
                    <DetailRow icon={MapPin} label="المحافظة" value={governorate?.name} />
                    <DetailRow icon={Truck} label="المندوب" value={courier?.name} />
                 </div>
                 <div className="col-span-2">
                    <DetailRow icon={MapPin} label="العنوان التفصيلي" value={shipment.address} />
                 </div>
            </div>

            {/* Right Side: History Timeline */}
            <div className="space-y-4">
                <h3 className="font-bold text-lg text-primary border-b pb-2">سجل التتبع</h3>
                <ShipmentHistoryTimeline shipmentId={shipment.id} />
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
