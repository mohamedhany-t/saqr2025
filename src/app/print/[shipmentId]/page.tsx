
'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, collection, getDocs, query, where, documentId, CollectionReference, getDoc } from 'firebase/firestore';
import type { Shipment } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';
import { WithId } from '@/firebase/firestore/use-collection';

const isBulkPrint = (shipmentId: string | string[] | undefined): shipmentId is 'bulk' => {
    return shipmentId === 'bulk';
};

const MAX_IDS_PER_QUERY = 30; // Firestore 'in' query limit

// Universal PrintView component
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
    const [shipments, setShipments] = useState<WithId<Shipment>[] | null>(null);
    const [governorateNameMap, setGovernorateNameMap] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    const shipmentIdOrBulk = params.shipmentId;

    useEffect(() => {
        setOriginUrl(window.location.origin);
    }, []);

    useEffect(() => {
        if (!firestore || !originUrl || !shipmentIdOrBulk) return;

        const fetchAndSetData = async () => {
            setIsLoading(true);

            if (isBulkPrint(shipmentIdOrBulk)) {
                // --- BULK PRINT LOGIC ---
                const idsFromStorage = sessionStorage.getItem('bulkPrintShipmentIds');
                const shipmentIds = idsFromStorage ? JSON.parse(idsFromStorage) : [];
                sessionStorage.removeItem('bulkPrintShipmentIds');

                if (shipmentIds.length === 0) {
                    setShipments([]);
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
                    const queryPromises = idChunks.map(chunk => getDocs(query(shipmentsCollection, where(documentId(), 'in', chunk))));
                    const querySnapshots = await Promise.all(queryPromises);

                    querySnapshots.forEach(querySnapshot => {
                        querySnapshot.forEach(docSnap => {
                            if (docSnap.exists()) {
                                allFetchedShipments.push({ id: docSnap.id, ...docSnap.data() } as WithId<Shipment>);
                            }
                        });
                    });
                    
                    const orderedShipments = shipmentIds
                        .map(id => allFetchedShipments.find(s => s.id === id))
                        .filter((s): s is WithId<Shipment> => s !== undefined);
                    
                    const governoratesCollection = collection(firestore, 'governorates');
                    const govSnapshot = await getDocs(governoratesCollection);
                    const govMap = new Map(govSnapshot.docs.map(doc => [doc.id, doc.data().name]));

                    setShipments(orderedShipments);
                    setGovernorateNameMap(govMap);

                } catch (error) {
                    console.error("Error fetching bulk data:", error);
                    setShipments([]);
                }

            } else if (typeof shipmentIdOrBulk === 'string') {
                // --- SINGLE PRINT LOGIC (FAST PATH) ---
                try {
                    const shipmentDocRef = doc(firestore, 'shipments', shipmentIdOrBulk);
                    const shipmentSnap = await getDoc(shipmentDocRef);

                    if (shipmentSnap.exists()) {
                        const shipmentData = { id: shipmentSnap.id, ...shipmentSnap.data() } as WithId<Shipment>;
                        
                        const governorateDocRef = doc(firestore, 'governorates', shipmentData.governorateId);
                        const govSnap = await getDoc(governorateDocRef);
                        const govName = govSnap.exists() ? govSnap.data().name : '';
                        
                        setShipments([shipmentData]);
                        setGovernorateNameMap(new Map([[shipmentData.governorateId, govName]]));
                    } else {
                        setShipments([]);
                    }
                } catch (error) {
                    console.error("Error fetching single shipment:", error);
                    setShipments([]);
                }
            }
            setIsLoading(false);
        };

        fetchAndSetData();

    }, [firestore, originUrl, shipmentIdOrBulk]);

    if (isLoading || !originUrl) {
         return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    return <PrintView shipments={shipments} originUrl={originUrl} governorateNameMap={governorateNameMap} />;
}
