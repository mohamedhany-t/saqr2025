

'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Shipment, ShipmentStatusConfig, User } from "@/lib/types";
import { Pencil, MessageSquare, Package, CalendarDays, Phone, Share2, Trash2, Printer, Edit, Replace, Star, Archive } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useUser, useUserProfile, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { Checkbox } from "../ui/checkbox";
import { cn, formatToCairoTime } from "@/lib/utils";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { doc, collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

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
    const firestore = useFirestore();
    const { toast } = useToast();

    const settingsDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'system_settings', 'whatsapp_templates') : null, [firestore]);
    const { data: whatsappTemplates } = useDoc<{courierTemplate: string, customerServiceTemplate: string}>(settingsDocRef);
    
    // Fetch all users to find courier info
    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: allUsers } = useCollection<User>(usersQuery);
    
    const assignedCourier = React.useMemo(() => {
        if (!allUsers || !shipment.assignedCourierId) return null;
        return allUsers.find(u => u.id === shipment.assignedCourierId);
    }, [allUsers, shipment.assignedCourierId]);


    const { 
        id,
        recipientName, 
        recipientPhone, 
        address, 
        totalAmount, 
        status, 
        shipmentCode,
        reason,
        createdAt,
        senderName,
        isExchange,
        isUrgent,
        isCustomReturn,
    } = shipment;

    const isAdmin = userProfile?.role === 'admin';
    const isCourier = userProfile?.role === 'courier';
    const isCustomerService = userProfile?.role === 'customer-service';
    const hasPhoneNumber = !!recipientPhone;

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!hasPhoneNumber) return;
        
        let message = '';
        const trackingUrl = '';

        if (isCourier) {
            const template = whatsappTemplates?.courierTemplate || '';
            message = template
                .replace('{customer_name}', recipientName || '')
                .replace('{courier_name}', userProfile?.name || '')
                .replace('{company_name}', companyName || '')
                .replace('{total_amount}', totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) || '')
                .replace('{address}', `${address}, ${governorateName}` || '')
                .replace('{tracking_link}', trackingUrl);
        } else if (isCustomerService) {
            // Ensure courier data is loaded before attempting to send the message
            if (shipment.assignedCourierId && !assignedCourier) {
                toast({
                    title: "جاري تحميل بيانات المندوب",
                    description: "يرجى المحاولة مرة أخرى خلال لحظات.",
                    variant: "default",
                });
                return;
            }

            const template = whatsappTemplates?.customerServiceTemplate || '';
            message = template
                .replace(/\{customer_name\}/g, recipientName || '')
                .replace(/\{customer_service_name\}/g, userProfile?.name || '')
                .replace(/\{shipment_code\}/g, shipmentCode || '')
                .replace(/\{company_name\}/g, companyName || '')
                .replace(/\{courier_name\}/g, assignedCourier?.name || 'غير محدد')
                .replace(/\{courier_phone\}/g, assignedCourier?.phone || 'غير متوفر')
                .replace(/\{total_amount\}/g, totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) || '')
                .replace(/\{address\}/g, `${address}, ${governorateName}` || '')
                .replace(/\{tracking_link\}/g, trackingUrl);
        }


        const encodedMessage = encodeURIComponent(message);
        const whatsappNumber = recipientPhone.replace(/\D/g, '').replace(/^0/, '20');
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    };

    const handleShareToAdmin = (e: React.MouseEvent) => {
        e.stopPropagation();

        const senderNameText = userProfile?.name || "مستخدم";
        const senderPhoneText = userProfile?.phone || "غير متوفر";
        
        const shipmentDetails = [
            `*تقرير شحنة من: ${senderNameText}*`,
            `*الهاتف: ${senderPhoneText}*`,
            `--------------------------`,
            `*كود الشحنة:* ${shipment.shipmentCode}`,
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

    const timeAgo = formatToCairoTime(createdAt);
    
    const canEdit = isAdmin || isCourier || isCustomerService;
    const isPriceChangePending = status === 'PriceChangeRequested';

    return (
        <Card className={cn(
            "shadow-md border w-full overflow-hidden relative transition-all", 
            isSelected && "ring-2 ring-primary border-primary", 
            isPriceChangePending && "border-yellow-500 ring-2 ring-yellow-500", 
            isUrgent && "border-red-500 ring-2 ring-red-500"
        )} onClick={handleCardClick}>
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
                        <span className="font-mono">{shipment.shipmentCode}</span>
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
                        <div className="flex justify-end items-center gap-2 flex-wrap">
                            {isUrgent && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <Star className="h-3 w-3" />
                                    <span>مستعجلة</span>
                                </Badge>
                            )}
                             {isExchange && (
                                <Badge variant="outline" className="border-orange-600 text-orange-700 bg-orange-50 flex items-center gap-1">
                                    <Replace className="h-3 w-3" />
                                    <span>استبدال</span>
                                </Badge>
                            )}
                            {isCustomReturn && (
                                <Badge variant="outline" className="border-blue-600 text-blue-700 bg-blue-50 flex items-center gap-1">
                                    <Archive className="h-3 w-3" />
                                    <span>استرجاع</span>
                                </Badge>
                            )}
                            <Badge variant={isPriceChangePending ? "outline" : "default"} className={cn(isPriceChangePending && "border-yellow-600 text-yellow-700")}>{statusConfig?.label || status}</Badge>
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

                     <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-purple-600" onClick={handleShareToAdmin}>
                            <Share2 className="h-5 w-5" />
                            <span className="sr-only">مشاركة تقرير</span>
                        </Button>
                     </div>
                    
                    {(isAdmin || isCustomerService) ? (
                        <div className="flex items-center gap-2">
                            <TooltipProvider>
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
                             <Button variant="ghost" size="icon" className="h-9 w-9 text-blue-600" onClick={handlePrint}>
                                <Printer className="h-5 w-5" />
                                <span className="sr-only">طباعة</span>
                            </Button>
                            {isAdmin && <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={handleDelete}>
                                <Trash2 className="h-5 w-5" />
                                <span className="sr-only">حذف</span>
                            </Button>}
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
