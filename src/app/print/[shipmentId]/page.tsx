

'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, getDocs, query, where, documentId, getDoc, CollectionReference } from 'firebase/firestore';
import type { Shipment, Governorate } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';
import { WithId } from '@/firebase/firestore/use-collection';

const isBulkPrint = (shipmentId: string | string[] | undefined): shipmentId is 'bulk' => {
    return shipmentId === 'bulk';
};

const MAX_IDS_PER_QUERY = 30; // Firestore 'in' query limit

export default function PrintShipmentPage() {
    const params = useParams();
    const firestore = useFirestore();

    const [originUrl, setOriginUrl] = useState('');
    const [shipments, setShipments] = useState<WithId<Shipment>[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setOriginUrl(window.location.origin);
    }, []);

    const shipmentIdOrBulk = params.shipmentId;

    useEffect(() => {
        if (!firestore) {
            setIsLoading(false);
            return;
        }

        const fetchShipments = async () => {
            setIsLoading(true);

            try {
                if (isBulkPrint(shipmentIdOrBulk)) {
                    // --- BULK PRINT LOGIC ---
                    const idsFromStorage = sessionStorage.getItem('bulkPrintShipmentIds');
                    const shipmentIds = idsFromStorage ? JSON.parse(idsFromStorage) : [];
                    sessionStorage.removeItem('bulkPrintShipmentIds'); // Clean up

                    if (shipmentIds.length === 0) {
                        setShipments([]);
                        return;
                    }

                    const shipmentsCollection = collection(firestore, 'shipments') as CollectionReference<Shipment>;
                    const allFetchedShipments: WithId<Shipment>[] = [];

                    const idChunks = [];
                    for (let i = 0; i < shipmentIds.length; i += MAX_IDS_PER_QUERY) {
                        idChunks.push(shipmentIds.slice(i, i + MAX_IDS_PER_QUERY));
                    }

                    const queryPromises = idChunks.map(chunk =>
                        getDocs(query(shipmentsCollection, where(documentId(), 'in', chunk)))
                    );

                    const querySnapshots = await Promise.all(queryPromises);

                    for (const querySnapshot of querySnapshots) {
                        querySnapshot.forEach(docSnap => {
                            if (docSnap.exists()) {
                                allFetchedShipments.push({ id: docSnap.id, ...docSnap.data() } as WithId<Shipment>);
                            }
                        });
                    }

                    const orderedShipments = shipmentIds
                        .map(id => allFetchedShipments.find(s => s.id === id))
                        .filter((s): s is WithId<Shipment> => s !== undefined);

                    setShipments(orderedShipments);
                } else {
                    // --- SINGLE PRINT LOGIC ---
                    const singleShipmentId = shipmentIdOrBulk as string;
                     if (!singleShipmentId) {
                         setShipments([]);
                         return;
                     }
                    const shipmentDocRef = doc(firestore, 'shipments', singleShipmentId);
                    const docSnap = await getDoc(shipmentDocRef);

                    if (docSnap.exists()) {
                        setShipments([{ id: docSnap.id, ...docSnap.data() } as WithId<Shipment>]);
                    } else {
                        setShipments([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching shipment(s):", error);
                setShipments([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchShipments();

    }, [firestore, shipmentIdOrBulk]);


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
        if (!isLoading && shipments && shipments.length > 0 && originUrl) {
            const timer = setTimeout(() => {
                window.print();
                // Close after a delay to allow print dialog to open
                setTimeout(() => window.close(), 1000); 
            }, 500); // Small delay to ensure rendering
            return () => clearTimeout(timer);
        }
         if (!isLoading && shipments?.length === 0){
             setTimeout(() => window.close(), 500);
        }
    }, [isLoading, shipments, originUrl]);

    if (isLoading || isLoadingGovernorates || !originUrl || !shipments) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        );
    }
    
    if (shipments.length === 0) {
        return (
             <div className="flex h-screen items-center justify-center text-center p-4" dir="rtl">
                <div>
                    <h1 className="text-xl font-bold">لم يتم العثور على شحنات</h1>
                    <p className="text-muted-foreground">سيتم إغلاق هذه النافذة تلقائياً.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 flex flex-col gap-0">
            {shipments.map((shipment) => (
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
