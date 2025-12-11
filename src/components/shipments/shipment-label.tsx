
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
const InfoLine = ({ label, value, valueClass = '', labelClass = '' }: { label: string; value: React.ReactNode; valueClass?: string; labelClass?: string; }) => (
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
    fontFamily: 'Cairo, sans-serif',
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto', // Header, Content, Footer
    gridTemplateColumns: '100%',
  };

  const formattedAmount = new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(shipment.totalAmount);


  return (
    <div id="printable-label" style={labelStyle} className="bg-white border-2 border-black p-1 text-black" dir="rtl">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-1">
            <div className="text-right">
                <h1 className="text-base font-bold">AlSaqr Logistics</h1>
                <p className="text-xs">{companyName}</p>
            </div>
            <Logo className="w-8 h-8 flex-shrink-0" />
        </div>
        
        {/* Main Content */}
        <div className='flex flex-col justify-between h-full'>
            {/* Recipient Info */}
            <div className="space-y-1">
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
            <div className="text-center border-t-2 border-b-2 border-black py-1 my-1">
                <p className="text-sm font-bold">المبلغ المطلوب:</p>
                <p className="text-xl font-bold">
                    {formattedAmount}
                </p>
            </div>
        </div>
        
        {/* Footer with Details & QR Code */}
        <div className="flex justify-between items-end pt-1">
            <div className="flex flex-col justify-end h-full">
                <p className="text-xs">شكرًا لاختياركم الصقر للخدمات اللوجستية.</p>
                <p className="text-xs mt-1">
                    <span className="font-bold">من:</span> {shipment.senderName || companyName}
                </p>
            </div>
            <div className="text-center">
                <div className="w-24 h-24 mx-auto">
                  {editUrl && <QRCode value={editUrl} size={96} level="M" />}
                </div>
                 <p className="text-[10px] font-mono font-bold mt-1">{shipment.shipmentCode}</p>
            </div>
        </div>
    </div>
  );
}
