

'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, getDocs, collection, query, where, documentId, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Shipment, Governorate } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';

interface PrintableShipment extends Shipment {
    governorateName: string;
}

const fetchShipmentAndGovernorate = async (firestore: any, shipmentId: string): Promise<PrintableShipment | null> => {
    const shipmentDocRef = doc(firestore, 'shipments', shipmentId);
    const shipmentSnap = await getDoc(shipmentDocRef);

    if (!shipmentSnap.exists()) {
        return null;
    }

    const shipmentData = shipmentSnap.data() as Shipment;
    let governorateName = 'N/A';

    if (shipmentData.governorateId) {
        const govDocRef = doc(firestore, 'governorates', shipmentData.governorateId);
        const govSnap = await getDoc(govDocRef);
        if (govSnap.exists()) {
            governorateName = (govSnap.data() as Governorate).name;
        }
    }

    return { ...shipmentData, id: shipmentSnap.id, governorateName };
};


// --- Main Page Component ---
export default function PrintShipmentPage() {
    return (
        // Suspense is required by Next.js for components that use searchParams
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>}>
            <PrintView />
        </Suspense>
    );
}


function PrintView() {
    const [data, setData] = useState<PrintableShipment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [originUrl, setOriginUrl] = useState('');
    const params = useParams();
    const searchParams = useSearchParams();
    const firestore = useFirestore();

    useEffect(() => {
        setOriginUrl(window.location.origin);

        const isBulk = params.shipmentId === 'bulk';
        const shipmentId = isBulk ? null : params.shipmentId as string;
        const bulkIds = searchParams.get('ids');

        const fetchData = async () => {
            if (!firestore) return;

            try {
                if (isBulk && bulkIds) {
                    // Handle Bulk Printing
                    const ids = bulkIds.split(',');
                    const chunks: string[][] = [];
                    for (let i = 0; i < ids.length; i += 30) {
                        chunks.push(ids.slice(i, i + 30));
                    }
                    
                    const shipmentsPromises = chunks.map(chunk => 
                        getDocs(query(collection(firestore, 'shipments'), where(documentId(), 'in', chunk)))
                    );

                    const shipmentsSnaps = await Promise.all(shipmentsPromises);
                    const shipments = shipmentsSnaps.flatMap(snap => snap.docs.map(d => ({ ...d.data(), id: d.id } as Shipment)));
                    
                    const govSnap = await getDocs(collection(firestore, 'governorates'));
                    const govMap = new Map(govSnap.docs.map(doc => [doc.id, doc.data() as Governorate]));
                    
                    const printableData = shipments.map(shipment => ({
                        ...shipment,
                        governorateName: govMap.get(shipment.governorateId)?.name || 'N/A'
                    }));

                    setData(printableData);

                } else if (shipmentId) {
                    // Handle Single Shipment Printing
                    const shipment = await fetchShipmentAndGovernorate(firestore, shipmentId);
                    if (shipment) {
                        setData([shipment]);
                    } else {
                        setError("لم يتم العثور على الشحنة المطلوبة.");
                    }
                } else {
                    setError("لم يتم العثور على بيانات للطباعة. يرجى المحاولة مرة أخرى.");
                }
            } catch (e) {
                console.error("Error fetching print data:", e);
                setError("حدث خطأ أثناء تحميل بيانات الطباعة.");
            }
        };

        fetchData();

    }, [firestore, params, searchParams]);


    useEffect(() => {
        if (data || error) {
            const timer = setTimeout(() => {
                if (data && data.length > 0) {
                    window.print();
                }
                // Optional: close window after printing
                 setTimeout(() => window.close(), 1000); 
            }, 500); // Small delay to ensure content is rendered
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