
'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Shipment, ShipmentStatusConfig } from "@/lib/types";
import { Pencil, MessageSquare, Package, CalendarDays, Phone, Share2, Trash2, Printer } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useUser, useUserProfile } from "@/firebase";
import { Checkbox } from "../ui/checkbox";
import { cn, formatToCairoTime } from "@/lib/utils";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ShipmentCardProps {
    shipment: Shipment;
    statusConfig?: ShipmentStatusConfig;
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
    statusConfig,
    governorateName, 
    companyName, 
    onEdit, 
    onDelete, 
    onPrint,
    isSelected,
    onSelectToggle
}: ShipmentCardProps) {
    const { userProfile } = useUserProfile();

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

    const isAdmin = userProfile?.role === 'admin';
    const isCourier = userProfile?.role === 'courier';
    const isCustomerService = userProfile?.role === 'customer-service';
    const hasPhoneNumber = !!recipientPhone;

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasPhoneNumber) return;
        
        let message = '';
        if (isCourier) {
            const courierName = userProfile?.name || "مندوب شركة الصقر";
            const formattedAmount = totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' });
            const fullAddress = `${address}, ${governorateName}`;
            message = [
                `أهلاً أ/ ${recipientName}، معك ${courierName} من شركة الصقر.`,
                `لديك أوردر بمبلغ ${formattedAmount}، وعنوان التسليم هو: ${fullAddress}.`,
                `\nبرجاء تأكيد إذا كنت ترغب في الاستلام – التأجيل – أو إلغاء الأوردر.`,
                `\nشكرًا لك 🌸`
            ].join('\n');
        } else if (isCustomerService) {
            const csName = userProfile?.name || "خدمة عملاء الصقر";
            message = [
                `أهلاً أ/ ${recipientName}، معك ${csName} من فريق المتابعة في شركة الصقر.`,
                `نود المتابعة بخصوص شحنتكم رقم ${trackingNumber || shipment.shipmentCode}.`,
                `\nهل هناك أي استفسارات يمكننا المساعدة بها؟`,
            ].join('\n');
        }


        const encodedMessage = encodeURIComponent(message);
        const whatsappNumber = recipientPhone.replace(/\D/g, '').replace(/^0/, '20');
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    };

    const handleShareToAdmin = (e: React.MouseEvent) => {
        e.stopPropagation();

        const senderNameText = userProfile?.name || "مستخدم";
        
        const shipmentDetails = [
            `*تقرير شحنة من ${senderNameText}*`,
            `--------------------------`,
            `*كود الشحنة:* ${trackingNumber || shipment.shipmentCode}`,
            `*الشركة (العميل الرئيسي):* ${companyName}`,
            `*الراسل (العميل الفرعي):* ${senderName || 'غير محدد'}`,
            `*المرسل إليه:* ${recipientName}`,
            `*الهاتف:* ${recipientPhone || 'غير متوفر'}`,
            `*العنوان:* ${address}, ${governorateName}`,
            `*المبلغ الإجمالي:* ${totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`,
            `*الحالة الحالية:* ${statusConfig?.label || status}`,
            `*ملاحظات:* ${reason || 'لا يوجد'}`,
        ].join('\n');

        const encodedMessage = encodeURIComponent(shipmentDetails);
        
        window.open(`whatsapp://send?text=${encodedMessage}`, '_blank');
    }

    const handlePhoneCall = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasPhoneNumber) return;
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

    const timeAgo = formatToCairoTime(createdAt?.toDate());
    
    const canEdit = isAdmin || isCourier;

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
                            <p className="text-xs text-muted-foreground">ملاحظات</p>
                            <p className="font-semibold">{reason || 'لا يوجد'}</p>
                        </div>
                        {/* Status */}
                        <div className="flex justify-end items-center gap-2">
                            <Badge variant="outline">{statusConfig?.label || status}</Badge>
                        </div>
                     </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t bg-muted/20 px-4 py-2 flex justify-between items-center">
                    {canEdit ? (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={handleEdit}>
                            <Pencil className="h-5 w-5" />
                             <span className="sr-only">تعديل</span>
                        </Button>
                    ) : <div></div> /* Empty div to maintain layout */}

                     <Button variant="ghost" size="icon" className="h-9 w-9 text-purple-600" onClick={handleShareToAdmin}>
                        <Share2 className="h-5 w-5" />
                         <span className="sr-only">مشاركة تقرير</span>
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
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600" onClick={handlePhoneCall} disabled={!hasPhoneNumber}>
                                            <Phone className="h-5 w-5" />
                                            <span className="sr-only">اتصال</span>
                                        </Button>
                                    </TooltipTrigger>
                                    {!hasPhoneNumber && <TooltipContent><p>لا يوجد رقم هاتف</p></TooltipContent>}
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-green-600" onClick={handleWhatsApp} disabled={!hasPhoneNumber}>
                                            <MessageSquare className="h-5 w-5" />
                                            <span className="sr-only">واتساب</span>
                                        </Button>
                                    </TooltipTrigger>
                                    {!hasPhoneNumber && <TooltipContent><p>لا يوجد رقم هاتف</p></TooltipContent>}
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
