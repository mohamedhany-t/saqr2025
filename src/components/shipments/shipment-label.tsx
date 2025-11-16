
'use client';

import React from 'react';
import QRCode from 'react-qr-code';
import { Logo } from '@/components/icons';
import type { Shipment } from '@/lib/types';

interface ShipmentLabelProps {
  shipment: Shipment;
  governorateName: string;
  editUrl: string;
}

export function ShipmentLabel({ shipment, governorateName, editUrl }: ShipmentLabelProps) {
  return (
    <div className="w-[377px] h-auto bg-white border border-black p-4 font-sans text-black" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
            <div className="text-right">
                <h1 className="text-lg font-bold">AlSaqr Logistics</h1>
                <p className="text-xs">شريكك اللوجستي الموثوق</p>
            </div>
            <Logo className="w-12 h-12" />
        </div>

        {/* Recipient Info */}
        <div className="mb-2">
            <p className="text-sm">
                <span className="font-bold">إلى:</span> {shipment.recipientName}
            </p>
            <p className="text-sm">
                <span className="font-bold">الهاتف:</span> {shipment.recipientPhone}
            </p>
            <p className="text-sm">
                <span className="font-bold">المحافظة:</span> {governorateName}
            </p>
            <p className="text-base font-bold leading-tight">
                {shipment.address}
            </p>
        </div>

        {/* Details & QR Code */}
        <div className="flex justify-between items-start border-t-2 border-black pt-2">
            <div className="flex-grow">
                <p className="text-sm">
                    <span className="font-bold">رقم الشحنة:</span> {shipment.trackingNumber || shipment.shipmentCode}
                </p>
                 <div className="mt-2">
                    <p className="text-sm font-bold">المبلغ المطلوب:</p>
                    <p className="text-xl font-bold">
                        {new Intl.NumberFormat('ar-EG', {
                            style: 'currency',
                            currency: 'EGP',
                        }).format(shipment.totalAmount)}
                    </p>
                </div>
            </div>
            <div className="w-24 h-24 flex-shrink-0">
                {editUrl && <QRCode value={editUrl} size={96} level="M" />}
            </div>
        </div>

         {/* Footer */}
        <div className="border-t-2 border-black pt-1 mt-2 text-center">
            <p className="text-xs">شكرًا لاختياركم الصقر للخدمات اللوجستية.</p>
        </div>
    </div>
  );
}