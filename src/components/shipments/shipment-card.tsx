
'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { statusText } from "@/components/dashboard/shipments-table";
import type { Shipment } from "@/lib/types";
import { Pencil, MessageSquare, Package, CalendarDays, Phone, Share2 } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useUser } from "@/firebase";

interface ShipmentCardProps {
    shipment: Shipment;
    governorateName: string;
    companyName: string;
    onEdit: (shipment: Shipment) => void;
}

export function ShipmentCard({ shipment, governorateName, companyName, onEdit }: ShipmentCardProps) {
    const { user: courierUser } = useUser();
    const { 
        recipientName, 
        recipientPhone, 
        address, 
        totalAmount, 
        status, 
        trackingNumber, 
        reason,
        createdAt
    } = shipment;

    const handleWhatsApp = (e: React.MouseEvent) => {
        e.stopPropagation();
        const cleanPhone = recipientPhone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.startsWith('20') ? cleanPhone : `20${cleanPhone}`;
        
        const courierName = courierUser?.displayName || "مندوب الشحن";
        const customerName = recipientName;
        const orderAmount = totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' });
        const fullAddress = `${address}, ${governorateName}`;

        const message = `أهلاً ${customerName}، معاك ${courierName} من شركة الصقر. حضرتك ليك اوردر بمبلغ ${orderAmount} والعنوان: ${fullAddress}. برجاء تأكيد إذا كنت ترغب في الاستلام – التأجيل – أو إلغاء الأوردر.
شكرًا لك 🌸.`;
        const encodedMessage = encodeURIComponent(message);
        
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
    };

    const handleShareToAdmin = (e: React.MouseEvent) => {
        e.stopPropagation();

        const courierName = courierUser?.displayName || "مندوب";
        
        const shipmentDetails = [
            `*تقرير شحنة من ${courierName}*`,
            `--------------------------`,
            `*كود الشحنة:* ${trackingNumber}`,
            `*الراسل:* ${companyName}`,
            `*المرسل إليه:* ${recipientName}`,
            `*الهاتف:* ${recipientPhone}`,
            `*العنوان:* ${address}, ${governorateName}`,
            `*المبلغ الإجمالي:* ${totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`,
            `*الحالة الحالية:* ${statusText[status] || status}`,
            `*ملاحظات المندوب:* ${reason || 'لا يوجد'}`,
        ].join('\n');

        const encodedMessage = encodeURIComponent(shipmentDetails);
        
        // This URL will open WhatsApp and let the user choose a contact to send the message to.
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

    const timeAgo = createdAt?.toDate ? formatDistanceToNow(createdAt.toDate(), { addSuffix: true, locale: ar }) : '';

    return (
        <Card className="shadow-md border w-full overflow-hidden" onClick={handleEdit}>
            <CardContent className="p-0">
                {/* Top Bar */}
                <div className="bg-muted/50 px-3 py-2 flex justify-between items-center text-sm text-muted-foreground border-b">
                     <div className="flex items-center gap-2">
                        <Package className="h-4 w-4"/>
                        <span className="font-mono">{trackingNumber}</span>
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
                </div>
            </CardContent>
        </Card>
    );
}

    