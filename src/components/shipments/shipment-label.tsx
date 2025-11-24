
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
const InfoLine = ({ label, value, valueClass = '', labelClass = '' }: { label: string; value: string; valueClass?: string; labelClass?: string; }) => (
  <p className="leading-tight">
    <span className={`font-bold ${labelClass}`}>{label}:</span> <span className={valueClass}>{value}</span>
  </p>
);

export function ShipmentLabel({ shipment, governorateName, companyName, editUrl }: ShipmentLabelProps) {
  // Style for the main container, fitting the 100mm x 100mm size
  const labelStyle: React.CSSProperties = {
    width: '100mm',
    height: '100mm',
    boxSizing: 'border-box',
    fontFamily: 'Cairo, sans-serif'
  };

  const formattedAmount = new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(shipment.totalAmount);


  return (
    <div id="printable-label" style={labelStyle} className="bg-white border-2 border-black p-3 flex flex-col font-sans text-black" dir="rtl">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
            <div className="text-right flex-grow">
                <h1 className="text-xl font-bold">AlSaqr Logistics</h1>
                <p className="text-sm">{companyName}</p>
            </div>
            <Logo className="w-12 h-12 flex-shrink-0" />
        </div>
        
        {/* Recipient Info */}
        <div className="grid grid-cols-2 gap-x-4 mb-2">
            <div className="col-span-2">
                <InfoLine label="إلى" value={shipment.recipientName} valueClass="text-lg font-bold" labelClass="text-base" />
            </div>
            <div>
                 <InfoLine label="الهاتف" value={shipment.recipientPhone} valueClass="text-lg font-bold" labelClass="text-base" />
            </div>
            <div>
                <InfoLine label="المحافظة" value={governorateName} valueClass="text-lg font-bold" labelClass="text-base"/>
            </div>
             <div className="col-span-2">
                <p className="text-lg font-bold mt-1 leading-tight">
                    {shipment.address}
                </p>
             </div>
        </div>

        {/* Amount */}
        <div className="text-center border-t-2 border-b-2 border-black py-1 my-2">
             <p className="text-base font-bold">المبلغ المطلوب:</p>
             <p className="text-2xl font-bold">
                {formattedAmount}
             </p>
        </div>
        
        {/* Footer with Details & QR Code */}
        <div className="flex justify-between items-center pt-2 mt-auto">
            <div className="flex flex-col justify-center h-full">
                <InfoLine label="رقم الشحنة" value={shipment.trackingNumber || shipment.shipmentCode} valueClass="text-base font-mono font-bold" />
                <p className="text-xs mt-2">شكرًا لاختياركم الصقر للخدمات اللوجستية.</p>
            </div>
            <div className="w-24 h-24 flex-shrink-0">
                {editUrl && <QRCode value={editUrl} size={96} level="M" />}
            </div>
        </div>
    </div>
  );
}
