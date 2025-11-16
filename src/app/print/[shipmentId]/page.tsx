

'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Shipment } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';

interface PrintableShipment extends Shipment {
    governorateName: string;
}

// --- Main Page Component ---
export default function PrintShipmentPage() {
    const [data, setData] = useState<PrintableShipment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [originUrl, setOriginUrl] = useState('');
    const params = useParams();

    useEffect(() => {
        // This effect runs only once on mount to get the origin URL.
        setOriginUrl(window.location.origin);

        try {
            const dataFromStorage = sessionStorage.getItem('printData');
            if (dataFromStorage) {
                const parsedData: PrintableShipment[] = JSON.parse(dataFromStorage);
                setData(parsedData);
                // Clean up immediately after reading
                sessionStorage.removeItem('printData');
            } else {
                setError("لم يتم العثور على بيانات للطباعة. يرجى المحاولة مرة أخرى من لوحة التحكم.");
            }
        } catch (e) {
            console.error("Failed to parse print data from session storage:", e);
            setError("حدث خطأ أثناء قراءة بيانات الطباعة.");
        }
    }, []);

    useEffect(() => {
        if (data || error) {
            const timer = setTimeout(() => {
                if(data && data.length > 0) {
                   window.print();
                }
                setTimeout(() => window.close(), 1000); 
            }, 500); 
            return () => clearTimeout(timer);
        }
    }, [data, error]);

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center text-center p-4" dir="rtl">
                <div>
                    <h1 className="text-xl font-bold text-destructive">{error}</h1>
                    <p className="text-muted-foreground">سيتم إغلاق هذه النافذة تلقائياً.</p>
                </div>
            </div>
        );
    }
    
    if (!data) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }
    
    return (
        <div className="p-0 m-0 flex flex-col gap-0">
            {data.map((shipment, index) => (
                 <div key={shipment.id} className={`w-full h-screen ${index < data.length - 1 ? 'page-break' : ''}`}>
                    <ShipmentLabel 
                        shipment={shipment} 
                        governorateName={shipment.governorateName}
                        editUrl={`${originUrl}/?edit=${shipment.id}`} 
                    />
                </div>
            ))}
        </div>
    );
}
