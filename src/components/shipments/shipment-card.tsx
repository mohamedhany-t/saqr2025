'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { statusText } from "@/components/dashboard/shipments-table";
import type { Shipment } from "@/lib/types";
import { Pencil, MessageSquare, Package, CalendarDays } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ShipmentCardProps {
    shipment: Shipment;
    governorateName: string;
    companyName: string;
    onEdit: (shipment: Shipment) => void;
}

export function ShipmentCard({ shipment, governorateName, companyName, onEdit }: ShipmentCardProps) {
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
        window.open(`https://wa.me/${whatsappNumber}`, '_blank');
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
                            <Button variant="ghost" size="icon" className="absolute top-1/2 -translate-y-1/2 start-[-10px] h-8 w-8 text-green-600" onClick={handleWhatsApp}>
                                <MessageSquare className="h-5 w-5" />
                            </Button>
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
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handleEdit}>
                                <Pencil className="h-5 w-5" />
                            </Button>
                        </div>
                     </div>
                </div>
            </CardContent>
        </Card>
    );
}

