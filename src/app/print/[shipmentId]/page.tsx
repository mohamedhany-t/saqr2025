

'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import type { Shipment, Governorate } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';

const isBulkPrint = (shipmentId: string | string[] | undefined): shipmentId is 'bulk' => {
    return shipmentId === 'bulk';
};

export default function PrintShipmentPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const shipmentId = params.shipmentId;
    const firestore = useFirestore();

    const [originUrl, setOriginUrl] = useState('');
    
    useEffect(() => {
        setOriginUrl(window.location.origin);
    }, []);

    const shipmentIds = useMemo(() => {
        if (isBulkPrint(shipmentId)) {
            const idsFromStorage = sessionStorage.getItem('bulkPrintShipmentIds');
            if (idsFromStorage) {
                try {
                    const parsedIds = JSON.parse(idsFromStorage);
                    sessionStorage.removeItem('bulkPrintShipmentIds'); // Clean up after reading
                    return Array.isArray(parsedIds) ? parsedIds : [];
                } catch (e) {
                    console.error("Failed to parse shipment IDs from sessionStorage", e);
                    return [];
                }
            }
            return [];
        }
        return shipmentId ? [shipmentId as string] : [];
    }, [shipmentId]);

    const shipmentsQuery = useMemoFirebase(() => {
        if (!firestore || shipmentIds.length === 0) return null;
        return query(collection(firestore, 'shipments'), where(documentId(), 'in', shipmentIds));
    }, [firestore, shipmentIds]);
    const { data: shipments, isLoading: isLoadingShipments } = useCollection<Shipment>(shipmentsQuery);

    const governoratesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'governorates');
    }, [firestore]);
    const { data: governorates, isLoading: isLoadingGovernorates } = useCollection<Governorate>(governoratesQuery);

    const governorateNameMap = useMemo(() => {
        if (!governorates) return new Map<string, string>();
        return new Map(governorates.map(g => [g.id, g.name]));
    }, [governorates]);

    useEffect(() => {
        if (!isLoadingShipments && shipments && shipments.length > 0 && originUrl) {
            setTimeout(() => {
                window.print();
                window.close();
            }, 500);
        }
    }, [isLoadingShipments, shipments, originUrl]);

    if (isLoadingShipments || isLoadingGovernorates || !originUrl || !shipments) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        );
    }
    
    if (shipments.length === 0) {
        notFound();
    }

    return (
        <div className="p-4 flex flex-col gap-0">
            {shipments.map((shipment, index) => (
                 <div key={shipment.id} className="w-full h-screen page-break">
                    <ShipmentLabel 
                        shipment={shipment} 
                        governorateName={governorateNameMap.get(shipment.governorateId) || ''} 
                        editUrl={`${originUrl}/?edit=${shipment.id}`} 
                    />
                </div>
            ))}
        </div>
    );
}
