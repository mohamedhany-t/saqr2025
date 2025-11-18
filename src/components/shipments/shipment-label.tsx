
'use client';

import React from 'react';
import QRCode from 'react-qr-code';
import { Logo } from '@/components/icons';
import type { Shipment } from '@/lib/types';

interface ShipmentLabelProps {
  shipment: Shipment;
  governorateName: string;
  companyName: string;
  editUrl: string;
}

export function ShipmentLabel({ shipment, governorateName, companyName, editUrl }: ShipmentLabelProps) {
  return (
    <div id="printable-label" className="w-full h-full bg-white border border-black p-8 flex flex-col font-sans text-black" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
            <div className="text-right">
                <h1 className="text-4xl font-bold">AlSaqr Logistics</h1>
                <p className="text-lg">شريكك اللوجستي الموثوق</p>
            </div>
            <Logo className="w-24 h-24" />
        </div>

        {/* Recipient Info */}
        <div className="mb-4">
            <p className="text-xl">
                <span className="font-bold">إلى:</span> {shipment.recipientName}
            </p>
            <p className="text-xl">
                <span className="font-bold">الهاتف:</span> {shipment.recipientPhone}
            </p>
            <p className="text-xl">
                <span className="font-bold">المحافظة:</span> {governorateName}
            </p>
            <p className="text-2xl font-bold leading-tight mt-2">
                {shipment.address}
            </p>
        </div>

        {/* Details & QR Code */}
        <div className="flex-grow flex justify-between items-end border-t-2 border-black pt-4 mt-auto">
            <div className="flex-grow">
                <p className="text-lg">
                    <span className="font-bold">رقم الشحنة:</span> {shipment.trackingNumber || shipment.shipmentCode}
                </p>
                <p className="text-lg">
                    <span className="font-bold">الشركة:</span> {companyName}
                </p>
                 <div className="mt-4">
                    <p className="text-xl font-bold">المبلغ المطلوب:</p>
                    <p className="text-5xl font-bold">
                        {new Intl.NumberFormat('ar-EG', {
                            style: 'currency',
                            currency: 'EGP',
                        }).format(shipment.totalAmount)}
                    </p>
                </div>
            </div>
            <div className="w-32 h-32 flex-shrink-0">
                {editUrl && <QRCode value={editUrl} size={128} level="M" />}
            </div>
        </div>

         {/* Footer */}
        <div className="border-t-2 border-black pt-2 mt-4 text-center">
            <p className="text-base">شكرًا لاختياركم الصقر للخدمات اللوجستية.</p>
        </div>
    </div>
  );
}
