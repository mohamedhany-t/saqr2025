
'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { statusText } from "@/components/dashboard/shipments-table";
import type { Shipment, SystemSettings } from "@/lib/types";
import { Pencil, MessageSquare, Package, CalendarDays, Phone, Share2, Trash2, Printer } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useUser, useFirestore } from "@/firebase";
import { Checkbox } from "../ui/checkbox";
import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { getSettings } from "@/firebase/settings";

interface ShipmentCardProps {
    shipment: Shipment;
    governorateName: string;
    companyName: string;
    onEdit: (shipment: Shipment) => void;
    onDelete?: (shipment: Shipment) => void;
    onPrint?: (shipment: Shipment) => void;
    isSelected?: boolean;
    onSelectToggle?: (id: string) => void;
}

export function ShipmentCard({ 
    shipment, 
    governorateName, 
    companyName, 
    onEdit, 
    onDelete, 
    onPrint,
    isSelected,
    onSelectToggle
}: ShipmentCardProps) {
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    const [settings, setSettings] = useState<SystemSettings | null>(null);

    const { 
        id,
        recipientName, 
        recipientPhone, 
        address, 
        totalAmount, 
        status, 
        trackingNumber, 
        reason,
        createdAt,
        senderName
    } = shipment;

    useEffect(() => {
        if(firestore) {
            getSettings(firestore).then(setSettings);
        }
    }, [firestore]);


    const isAdmin = authUser?.email === 'mhanyt21@gmail.com'; // Simple admin check

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        const cleanPhone = recipientPhone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.startsWith('20') ? cleanPhone : `20${cleanPhone}`;
        
        const courierName = authUser?.displayName || "مندوب الشحن";
        const customerName = recipientName;
        const orderAmount = totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' });
        const fullAddress = `${address}, ${governorateName}`;

        const defaultTemplate = `أهلاً {customerName}، معاك {courierName} من شركة الصقر. حضرتك ليك اوردر بمبلغ {orderAmount} والعنوان: {fullAddress}. برجاء تأكيد إذا كنت ترغب في الاستلام – التأجيل – أو إلغاء الأوردر.\nشكرًا لك 🌸.`;
        const messageTemplate = settings?.whatsappTemplate || defaultTemplate;

        const message = messageTemplate
            .replace('{customerName}', customerName)
            .replace('{courierName}', courierName)
            .replace('{orderAmount}', orderAmount)
            .replace('{fullAddress}', fullAddress);
            
        const encodedMessage = encodeURIComponent(message);
        
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    };

    const handleShareToAdmin = (e: React.MouseEvent) => {
        e.stopPropagation();

        const courierName = authUser?.displayName || "مندوب";
        
        const shipmentDetails = [
            `*تقرير شحنة من ${courierName}*`,
            `--------------------------`,
            `*كود الشحنة:* ${trackingNumber || shipment.shipmentCode}`,
            `*الشركة (العميل الرئيسي):* ${companyName}`,
            `*الراسل (العميل الفرعي):* ${senderName || 'غير محدد'}`,
            `*المرسل إليه:* ${recipientName}`,
            `*الهاتف:* ${recipientPhone}`,
            `*العنوان:* ${address}, ${governorateName}`,
            `*المبلغ الإجمالي:* ${totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`,
            `*الحالة الحالية:* ${statusText[status] || status}`,
            `*ملاحظات المندوب:* ${reason || 'لا يوجد'}`,
        ].join('\n');

        const encodedMessage = encodeURIComponent(shipmentDetails);
        
        window.open(`whatsapp://send?text=${encodedMessage}`, '_blank');
    }

    const handlePhoneCall = (e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(`tel:${recipientPhone}`);
    };
    
    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(shipment);
    }
    
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(shipment);
        }
    }
    
    const handlePrint = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onPrint) {
            onPrint(shipment);
        }
    }

    const handleCardClick = () => {
        if (onSelectToggle) {
            onSelectToggle(id);
        } else {
            onEdit(shipment);
        }
    };

    const timeAgo = createdAt?.toDate ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true, locale: ar }) : '';

    return (
        <Card className={cn("shadow-md border w-full overflow-hidden relative", isSelected && "ring-2 ring-primary border-primary")} onClick={handleCardClick}>
             {onSelectToggle && (
                 <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onSelectToggle(id)}
                        aria-label="Select shipment"
                        className="h-5 w-5"
                    />
                 </div>
            )}
            <CardContent className="p-0">
                {/* Top Bar */}
                <div className="bg-muted/30 px-3 py-2 flex justify-between items-center text-sm text-muted-foreground border-b">
                     <div className="flex items-center gap-2">
                        <Package className="h-4 w-4"/>
                        <span className="font-mono">{trackingNumber || shipment.shipmentCode}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4"/>
                        <span>{timeAgo}</span>
                    </div>
                    <div className="font-bold text-base text-foreground">
                        {totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                    </div>
                </div>
                
                {/* Main Content */}
                <div className="p-4 space-y-3">
                     {/* Sender and Recipient */}
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground">الراسل</p>
                            <p className="font-semibold text-primary">{companyName}</p>
                        </div>
                        <div className="relative">
                            <p className="text-xs text-muted-foreground">المرسل إليه</p>
                            <p className="font-semibold">{recipientName}</p>
                        </div>
                     </div>
                     
                     {/* Address */}
                     <div>
                        <p className="text-xs text-muted-foreground">العنوان</p>
                        <p className="font-semibold">{address}, {governorateName}</p>
                     </div>

                     <div className="grid grid-cols-2 gap-4 items-start">
                        {/* Notes */}
                        <div>
                            <p className="text-xs text-muted-foreground">ملاحظات الكابتن</p>
                            <p className="font-semibold">{reason || 'لا يوجد'}</p>
                        </div>
                        {/* Status */}
                        <div className="flex justify-end items-center gap-2">
                            <Badge variant="outline">{statusText[status] || status}</Badge>
                        </div>
                     </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t bg-muted/20 px-4 py-2 flex justify-between items-center">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={handleEdit}>
                        <Pencil className="h-5 w-5" />
                         <span className="sr-only">تعديل</span>
                    </Button>
                     <Button variant="ghost" size="icon" className="h-9 w-9 text-purple-600" onClick={handleShareToAdmin}>
                        <Share2 className="h-5 w-5" />
                         <span className="sr-only">مشاركة للإدارة</span>
                    </Button>
                    
                    {isAdmin ? (
                        <div className="flex items-center gap-2">
                             <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600" onClick={handlePrint}>
                                <Printer className="h-5 w-5" />
                                <span className="sr-only">طباعة</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={handleDelete}>
                                <Trash2 className="h-5 w-5" />
                                <span className="sr-only">حذف</span>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600" onClick={handlePhoneCall}>
                                <Phone className="h-5 w-5" />
                                <span className="sr-only">اتصال</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600" onClick={handleWhatsApp}>
                                <MessageSquare className="h-5 w-5" />
                                <span className="sr-only">واتساب</span>
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

    