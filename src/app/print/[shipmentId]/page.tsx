
'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { notFound, useParams } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Shipment, Governorate } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';

export default function PrintShipmentPage() {
    const params = useParams();
    const shipmentId = params.shipmentId as string;
    const firestore = useFirestore();

    const [originUrl, setOriginUrl] = useState('');
    
    useEffect(() => {
        // This ensures window.location.origin is only accessed on the client side
        setOriginUrl(window.location.origin);
    }, []);

    const shipmentDocRef = useMemoFirebase(() => {
        if (!firestore || !shipmentId) return null;
        return doc(firestore, 'shipments', shipmentId);
    }, [firestore, shipmentId]);
    const { data: shipment, isLoading: isLoadingShipment } = useDoc<Shipment>(shipmentDocRef);

    const governoratesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'governorates');
    }, [firestore]);
    const { data: governorates, isLoading: isLoadingGovernorates } = useCollection<Governorate>(governoratesQuery);

    const governorateName = useMemo(() => {
        if (!shipment || !governorates) return '';
        return governorates.find(g => g.id === shipment.governorateId)?.name || '';
    }, [shipment, governorates]);

    useEffect(() => {
        if (!isLoadingShipment && shipment && originUrl) {
            // Delay print slightly to ensure QR code and content are rendered
            setTimeout(() => {
                window.print();
                window.close();
            }, 500);
        }
    }, [isLoadingShipment, shipment, originUrl]);

    if (isLoadingShipment || isLoadingGovernorates || !originUrl) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        );
    }
    
    if (!shipment) {
        notFound();
    }
    
    const editUrl = `${originUrl}/?edit=${shipment.id}`;

    return (
        <div className="p-4">
            <ShipmentLabel shipment={shipment} governorateName={governorateName} editUrl={editUrl} />
        </div>
    );
}