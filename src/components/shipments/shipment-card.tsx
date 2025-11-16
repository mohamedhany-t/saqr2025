
'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { statusText, statusVariants } from "@/components/dashboard/shipments-table";
import type { Shipment } from "@/lib/types";
import { CircleDollarSign, MapPin, Pencil } from "lucide-react";
import React from "react";

interface ShipmentCardProps {
    shipment: Shipment;
    governorateName: string;
    onEdit: (shipment: Shipment) => void;
}

export function ShipmentCard({ shipment, governorateName, onEdit }: ShipmentCardProps) {
    const { recipientName, address, totalAmount, status } = shipment;
    return (
        <Card>
            <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{recipientName}</CardTitle>
                    <Badge variant={statusVariants[status]}>{statusText[status] || status}</Badge>
                </div>
                <CardDescription className="flex items-center gap-2 pt-1">
                    <MapPin className="h-4 w-4" />
                    <span>{address}, {governorateName}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex items-center gap-2 font-semibold text-lg">
                    <CircleDollarSign className="h-5 w-5 text-green-600"/>
                    <span>
                        {totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                    </span>
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-end gap-2">
                <Button variant="outline" onClick={() => onEdit(shipment)}>
                    <Pencil className="h-4 w-4 me-2"/>
                    تحديث الحالة
                </Button>
            </CardFooter>
        </Card>
    );
}

    