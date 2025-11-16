

'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { statusText, statusVariants } from "@/components/dashboard/shipments-table";
import type { Shipment } from "@/lib/types";
import { CircleDollarSign, MapPin, Pencil, Phone, MessageCircle } from "lucide-react";
import { Separator } from "../ui/separator";

interface ShipmentCardProps {
    shipment: Shipment;
    governorateName: string;
    onEdit: (shipment: Shipment) => void;
}

export function ShipmentCard({ shipment, governorateName, onEdit }: ShipmentCardProps) {
    const { recipientName, recipientPhone, address, totalAmount, status } = shipment;

    const handleCall = () => {
        window.location.href = `tel:${recipientPhone}`;
    };

    const handleWhatsApp = () => {
        // Remove any non-digit characters from the phone number
        const cleanPhone = recipientPhone.replace(/\D/g, '');
        // Assume Egyptian numbers, prepend with country code if not present
        const whatsappNumber = cleanPhone.startsWith('20') ? cleanPhone : `20${cleanPhone}`;
        window.open(`https://wa.me/${whatsappNumber}`, '_blank');
    };

    return (
        <Card className="shadow-md">
            <CardHeader className="p-4">
                <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg font-bold">{recipientName}</CardTitle>
                    <Badge variant={statusVariants[status]} className="flex-shrink-0">{statusText[status] || status}</Badge>
                </div>
                <CardDescription className="text-base text-foreground font-semibold flex items-start gap-2 pt-2">
                    <MapPin className="h-5 w-5 mt-1 text-muted-foreground flex-shrink-0" />
                    <span>{address}, {governorateName}</span>
                </CardDescription>
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
                    <span>{recipientPhone}</span>
                </div>
            </CardHeader>
             <CardContent className="p-4 pt-0">
                <Separator className="mb-4" />
                <div className="flex items-center gap-2 font-semibold text-xl">
                    <CircleDollarSign className="h-6 w-6 text-green-600"/>
                    <span className="font-bold">
                        {totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                    </span>
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-end gap-2">
                 <Button variant="outline" size="sm" onClick={handleCall}>
                    <Phone className="h-4 w-4 me-2"/>
                    اتصال
                </Button>
                <Button variant="outline" size="sm" onClick={handleWhatsApp}>
                    <MessageCircle className="h-4 w-4 me-2"/>
                    WhatsApp
                </Button>
                <Button variant="default" size="sm" onClick={() => onEdit(shipment)}>
                    <Pencil className="h-4 w-4 me-2"/>
                    تحديث الحالة
                </Button>
            </CardFooter>
        </Card>
    );
}

    