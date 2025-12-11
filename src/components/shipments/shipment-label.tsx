
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
  <p className="leading-tight">
    <span className={`font-bold ${labelClass}`}>{label}:</span> <span className={valueClass}>{value}</span>
  </p>
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


  return (
    <div id="printable-label" style={labelStyle} className={cn("bg-white border-2 border-black p-2 text-black flex flex-col", className)} dir="rtl">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-1">
            <div className="text-right">
                <h1 className="text-base font-bold">AlSaqr Logistics</h1>
                <p className="text-xs">{shipment.senderName || companyName}</p>
            </div>
            <Logo className="w-8 h-8 flex-shrink-0" />
        </div>
        
        {/* Main Content */}
        <div className='flex flex-col flex-grow'>
            {/* Recipient Info */}
            <div className="space-y-1 flex-grow">
                <div className="grid grid-cols-2 gap-x-2">
                    <div className="col-span-2">
                        <InfoLine label="إلى" value={shipment.recipientName} valueClass="text-base font-bold" labelClass="text-sm" />
                    </div>
                    <div>
                        <InfoLine label="الهاتف" value={shipment.recipientPhone} valueClass="text-base font-bold" labelClass="text-sm" />
                    </div>
                    <div>
                        <InfoLine label="المحافظة" value={governorateName} valueClass="text-base font-bold" labelClass="text-sm"/>
                    </div>
                </div>
                <div className="col-span-2">
                    <p className="text-sm font-bold mt-1 leading-tight">
                        {shipment.address}
                    </p>
                </div>
            </div>

            {/* Amount */}
            <div className="text-center border-t-2 border-b-2 border-black py-1 my-2">
                <p className="text-sm font-bold">المبلغ المطلوب:</p>
                <p className="text-xl font-bold">
                    {formattedAmount}
                </p>
            </div>
        </div>
        
        {/* Footer with Details & QR Code */}
        <div className="flex justify-between items-center pt-1">
             <div className="text-center">
                {editUrl && <QRCode value={editUrl} size={64} level="M" />}
            </div>
             <div className="flex flex-col h-full text-right px-1">
                 <p className="text-xs font-bold leading-tight">رقم الشحنة: <span className="font-mono">{shipment.shipmentCode}</span></p>
                <p className="text-[10px] mt-2 leading-tight">شكرًا لاختياركم الصقر للخدمات اللوجستية.</p>
            </div>
        </div>
    </div>
  );
}
