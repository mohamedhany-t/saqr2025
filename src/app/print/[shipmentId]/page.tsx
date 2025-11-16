
'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, collection, getDocs, query, where, documentId, CollectionReference } from 'firebase/firestore';
import type { Shipment, Governorate } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';
import { WithId } from '@/firebase/firestore/use-collection';

const isBulkPrint = (shipmentId: string | string[] | undefined): shipmentId is 'bulk' => {
    return shipmentId === 'bulk';
};

const MAX_IDS_PER_QUERY = 30; // Firestore 'in' query limit

// Component for handling bulk printing logic
function BulkPrintHandler({ onDataLoaded, governorateNameMap, originUrl }: { onDataLoaded: (shipments: WithId<Shipment>[]) => void, governorateNameMap: Map<string, string>, originUrl: string }) {
    const firestore = useFirestore();
    const [bulkShipments, setBulkShipments] = useState<WithId<Shipment>[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore) return;

        const fetchBulkShipments = async () => {
            const idsFromStorage = sessionStorage.getItem('bulkPrintShipmentIds');
            const shipmentIds = idsFromStorage ? JSON.parse(idsFromStorage) : [];
            sessionStorage.removeItem('bulkPrintShipmentIds');

            if (shipmentIds.length === 0) {
                setBulkShipments([]);
                setIsLoading(false);
                return;
            }

            try {
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
                
                setBulkShipments(orderedShipments);
            } catch (error) {
                console.error("Error fetching bulk shipments:", error);
                setBulkShipments([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBulkShipments();
    }, [firestore]);
    
    useEffect(() => {
        if (!isLoading && bulkShipments) {
            onDataLoaded(bulkShipments);
        }
    }, [isLoading, bulkShipments, onDataLoaded]);
    
    if (isLoading) {
         return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }
    
    return <PrintView shipments={bulkShipments} originUrl={originUrl} governorateNameMap={governorateNameMap} />;
}

// Component for handling single shipment printing
function SinglePrintHandler({ shipmentId, onDataLoaded, governorateNameMap, originUrl }: { shipmentId: string, onDataLoaded: (shipments: WithId<Shipment>[]) => void, governorateNameMap: Map<string, string>, originUrl: string }) {
    const firestore = useFirestore();
    const shipmentQuery = useMemoFirebase(() => {
        if (!firestore || !shipmentId) return null;
        return doc(firestore, 'shipments', shipmentId);
    }, [firestore, shipmentId]);

    const { data: shipment, isLoading } = useDoc<Shipment>(shipmentQuery);

    useEffect(() => {
        if (!isLoading) {
            onDataLoaded(shipment ? [shipment] : []);
        }
    }, [isLoading, shipment, onDataLoaded]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    return <PrintView shipments={shipment ? [shipment] : []} originUrl={originUrl} governorateNameMap={governorateNameMap} />;
}


// Component to render the labels and trigger print
function PrintView({ shipments, originUrl, governorateNameMap }: { shipments: WithId<Shipment>[] | null, originUrl: string, governorateNameMap: Map<string, string> }) {
     useEffect(() => {
        if (shipments && originUrl) {
            if (shipments.length > 0) {
                 const timer = setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 1000); 
                }, 500); 
                return () => clearTimeout(timer);
            } else {
                setTimeout(() => window.close(), 500);
            }
        }
    }, [shipments, originUrl]);

    if (!shipments) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (shipments.length === 0) {
        return (
             <div className="flex h-screen items-center justify-center text-center p-4" dir="rtl">
                <div>
                    <h1 className="text-xl font-bold">لم يتم العثور على شحنات</h1>
                    <p className="text-muted-foreground">سيتم إغلاق هذه النافذة تلقائياً.</p>
                </div>
            </div>
        );
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


export default function PrintShipmentPage() {
    const params = useParams();
    const firestore = useFirestore();
    const [originUrl, setOriginUrl] = useState('');
     const [shipmentsToPrint, setShipmentsToPrint] = useState<WithId<Shipment>[] | null>(null);

    useEffect(() => {
        setOriginUrl(window.location.origin);
    }, []);

    const governoratesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'governorates');
    }, [firestore]);
    const { data: governorates, isLoading: isLoadingGovernorates } = useCollection<Governorate>(governoratesQuery);

    const governorateNameMap = useMemo(() => {
        if (!governorates) return new Map<string, string>();
        return new Map(governorates.map(g => [g.id, g.name]));
    }, [governorates]);
    
    const shipmentIdOrBulk = params.shipmentId;
    const isBulk = isBulkPrint(shipmentIdOrBulk);
    
    const handleDataLoaded = (shipments: WithId<Shipment>[]) => {
        setShipmentsToPrint(shipments);
    };

    if (isLoadingGovernorates || !originUrl) {
         return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (isBulk) {
        return <BulkPrintHandler onDataLoaded={handleDataLoaded} governorateNameMap={governorateNameMap} originUrl={originUrl} />;
    } else if (typeof shipmentIdOrBulk === 'string') {
        return <SinglePrintHandler shipmentId={shipmentIdOrBulk} onDataLoaded={handleDataLoaded} governorateNameMap={governorateNameMap} originUrl={originUrl} />;
    }
    
    return <PrintView shipments={[]} originUrl={originUrl} governorateNameMap={governorateNameMap} />;
}
