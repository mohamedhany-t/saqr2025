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

// Component for a single label with a specific key-value pair
const InfoLine = ({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) => (
  <p className="text-base leading-tight">
    <span className="font-bold">{label}:</span> <span className={valueClass}>{value}</span>
  </p>
);

export function ShipmentLabel({ shipment, governorateName, companyName, editUrl }: ShipmentLabelProps) {
  // Style for the main container, fitting the 100mm x 150mm size
  const labelStyle: React.CSSProperties = {
    width: '100mm',
    height: '150mm',
    boxSizing: 'border-box',
    fontFamily: 'Cairo, sans-serif'
  };

  return (
    <div id="printable-label" style={labelStyle} className="bg-white border-2 border-black p-4 flex flex-col font-sans text-black" dir="rtl">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
            <div className="text-right flex-grow">
                <h1 className="text-2xl font-bold">AlSaqr Logistics</h1>
                <p className="text-sm">شريكك اللوجستي الموثوق</p>
            </div>
            <Logo className="w-16 h-16 flex-shrink-0" />
        </div>

        {/* Recipient Info */}
        <div className="border-b-2 border-black pb-2 mb-2 flex-grow">
            <InfoLine label="إلى" value={shipment.recipientName} valueClass="text-lg font-bold" />
            <InfoLine label="الهاتف" value={shipment.recipientPhone} valueClass="text-lg font-bold" />
            <InfoLine label="المحافظة" value={governorateName} valueClass="font-semibold" />
            <p className="text-xl font-bold mt-1 leading-tight">
                {shipment.address}
            </p>
        </div>

        {/* Footer with Details & QR Code */}
        <div className="flex justify-between items-end border-t-2 border-black pt-2">
            <div className="flex-grow space-y-1">
                <InfoLine label="رقم الشحنة" value={shipment.trackingNumber || shipment.shipmentCode} valueClass="font-mono font-bold" />
                <InfoLine label="الشركة" value={companyName} valueClass="font-semibold" />
                <div className="mt-2">
                    <p className="text-base font-bold">المبلغ المطلوب:</p>
                    <p className="text-3xl font-bold">
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

         {/* Final Footer */}
        <div className="border-t-2 border-black pt-1 mt-2 text-center">
            <p className="text-xs">شكرًا لاختياركم الصقر للخدمات اللوجستية.</p>
        </div>
    </div>
  );
}
