
'use client';

import React from 'react';
import QRCode from 'react-qr-code';
import { Logo } from '@/components/icons';
import type { Shipment } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ShipmentLabelProps {
  shipment: Shipment;
  governorateName: string;
  companyName: string;
  editUrl: string;
  className?: string;
}

const InfoLine = ({ label, value, valueClass = '', labelClass = '' }: { label: string; value: React.ReactNode; valueClass?: string; labelClass?: string; }) => (
  <div className="flex items-baseline">
    <span className={`font-bold ${labelClass}`}>{label}:</span>
    <span className={`mr-2 font-bold ${valueClass}`}>{value}</span>
  </div>
);


export function ShipmentLabel({ shipment, governorateName, companyName, editUrl, className }: ShipmentLabelProps) {
  const labelStyle: React.CSSProperties = {
    width: '100mm',
    height: '100mm',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Cairo', sans-serif",
  };

  const formattedAmount = new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(shipment.totalAmount);

  // Combine company name and sender name
  const senderDisplay = [companyName, shipment.senderName].filter(Boolean).join(' - ');

  return (
    <div id="printable-label" style={labelStyle} className={cn("bg-white border-2 border-black p-2 text-black flex flex-col", className)} dir="rtl">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-1">
            <div className="text-right">
                <h1 className="text-lg font-bold leading-none">AlSaqr Logistics</h1>
            </div>
            <Logo className="w-8 h-8 flex-shrink-0" />
        </div>
        
        <div className="w-full border-t-2 border-black mb-2"></div>

        {/* Recipient Info */}
        <div className="space-y-1 mb-2">
            <InfoLine label="إلى" value={shipment.recipientName} valueClass="text-lg" />
            <div className="flex justify-between items-center text-sm">
                <InfoLine label="الهاتف" value={shipment.recipientPhone} valueClass="font-mono" />
                <InfoLine label="المحافظة" value={governorateName} />
            </div>
            <p className="text-base font-bold pt-1 leading-tight">
                {shipment.address}
            </p>
        </div>

        {/* Amount */}
        <div className="text-center border-t-2 border-b-2 border-black py-2 my-auto">
            <p className="text-base font-bold leading-none">المبلغ المطلوب:</p>
            <p className="text-2xl font-bold leading-tight">
                {formattedAmount}
            </p>
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-start pt-2 mt-auto">
            <div className="flex-1 text-right text-xs">
                 <p className="font-semibold text-base">{senderDisplay}</p>
                 <p className="font-bold">كود الشحنة: <span className="font-mono font-normal">{shipment.shipmentCode}</span></p>
                 <p className="text-sm leading-none mt-2">شكرًا لاختياركم الصقر للخدمات اللوجستية.</p>
            </div>
             <div className="text-left">
                {editUrl && <QRCode value={editUrl} size={90} level="M" />}
            </div>
        </div>
    </div>
  );
}
