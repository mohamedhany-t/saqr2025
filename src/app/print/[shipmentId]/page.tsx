
'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, collection, getDocs, query, where, documentId, CollectionReference, getDoc } from 'firebase/firestore';
import type { Shipment, Governorate } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';
import { WithId } from '@/firebase/firestore/use-collection';

// --- Single Shipment Print Component ---
// This component fetches its own data and prints. It avoids complex hooks for speed.
const SingleShipmentPrint = ({ shipmentId, originUrl }: { shipmentId: string, originUrl: string }) => {
    const [data, setData] = useState<{ shipment: WithId<Shipment>; govName: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const firestore = useFirestore();

    useEffect(() => {
        if (!firestore) return;

        const fetchSingleShipment = async () => {
            try {
                const shipmentDocRef = doc(firestore, 'shipments', shipmentId);
                const shipmentSnap = await getDoc(shipmentDocRef);

                if (shipmentSnap.exists()) {
                    const shipmentData = { id: shipmentSnap.id, ...shipmentSnap.data() } as WithId<Shipment>;
                    
                    const govSnap = await getDoc(doc(firestore, 'governorates', shipmentData.governorateId));
                    const govName = govSnap.exists() ? govSnap.data().name : '';
                    
                    setData({ shipment: shipmentData, govName });
                } else {
                    setError("لم يتم العثور على الشحنة.");
                }
            } catch (e: any) {
                console.error("Error fetching single shipment for printing:", e);
                setError("حدث خطأ أثناء تحميل بيانات الشحنة.");
            }
        };

        fetchSingleShipment();
    }, [shipmentId, firestore]);

    useEffect(() => {
        if (data) {
            const timer = setTimeout(() => {
                window.print();
                setTimeout(() => window.close(), 500);
            }, 500); // Small delay to ensure render
            return () => clearTimeout(timer);
        }
         if (error) {
            setTimeout(() => window.close(), 2000);
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
        <div className="p-4 flex flex-col gap-0">
            <div className="w-full h-screen">
                <ShipmentLabel 
                    shipment={data.shipment} 
                    governorateName={data.govName}
                    editUrl={`${originUrl}/?edit=${data.shipment.id}`} 
                />
            </div>
        </div>
    );
};


// --- Bulk Shipment Print Component ---
const MAX_IDS_PER_QUERY = 30; // Firestore 'in' query limit

const BulkShipmentPrint = ({ originUrl }: { originUrl: string }) => {
    const [shipments, setShipments] = useState<WithId<Shipment>[] | null>(null);
    const [governorateNameMap, setGovernorateNameMap] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(true);
    const firestore = useFirestore();

     useEffect(() => {
        if (!firestore) return;

        const fetchBulkData = async () => {
            const idsFromStorage = sessionStorage.getItem('bulkPrintShipmentIds');
            const shipmentIds = idsFromStorage ? JSON.parse(idsFromStorage) : [];
            sessionStorage.removeItem('bulkPrintShipmentIds');

            if (shipmentIds.length === 0) {
                setShipments([]);
                setIsLoading(false);
                return;
            }

            try {
                // Fetch all governorates first
                const govSnapshot = await getDocs(collection(firestore, 'governorates'));
                const govMap = new Map(govSnapshot.docs.map(doc => [doc.id, doc.data().name as string]));
                setGovernorateNameMap(govMap);

                // Fetch shipments in chunks
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
                    .map((id: string) => allFetchedShipments.find(s => s.id === id))
                    .filter((s: WithId<Shipment> | undefined): s is WithId<Shipment> => s !== undefined);
                
                setShipments(orderedShipments);

            } catch (error) {
                console.error("Error fetching bulk data:", error);
                setShipments([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBulkData();
    }, [firestore]);


    useEffect(() => {
        if (!isLoading) {
            if (shipments && shipments.length > 0) {
                const timer = setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 1000);
                }, 500);
                return () => clearTimeout(timer);
            } else {
                 setTimeout(() => window.close(), 1000);
            }
        }
    }, [isLoading, shipments]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (!shipments || shipments.length === 0) {
        return (
             <div className="flex h-screen items-center justify-center text-center p-4" dir="rtl">
                <div>
                    <h1 className="text-xl font-bold">لم يتم العثور على شحنات للطباعة</h1>
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
};


// --- Main Page Component ---
export default function PrintShipmentPage() {
    const params = useParams();
    const [originUrl, setOriginUrl] = useState('');
    const shipmentIdOrBulk = params.shipmentId;
    
    useEffect(() => {
        setOriginUrl(window.location.origin);
    }, []);

    if (!originUrl) {
         return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    if (shipmentIdOrBulk === 'bulk') {
        return <BulkShipmentPrint originUrl={originUrl} />;
    }
    
    if (typeof shipmentIdOrBulk === 'string') {
        return <SingleShipmentPrint shipmentId={shipmentIdOrBulk} originUrl={originUrl} />;
    }

    // Fallback for invalid URL
    return (
         <div className="flex h-screen items-center justify-center text-center p-4" dir="rtl">
            <div>
                <h1 className="text-xl font-bold text-destructive">رابط طباعة غير صالح</h1>
                <p className="text-muted-foreground">سيتم إغلاق هذه النافذة تلقائياً.</p>
            </div>
        </div>
    );
}

