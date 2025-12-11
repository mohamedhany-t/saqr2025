
'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc, getDocs, collection, query, where, documentId, Firestore } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Shipment, Governorate, Company } from '@/lib/types';
import { ShipmentLabel } from '@/components/shipments/shipment-label';
import { Loader2 } from 'lucide-react';
import { Cairo } from "next/font/google";

// Load the Cairo font specifically for this page
const cairo = Cairo({ subsets: ["arabic"], variable: "--font-cairo", weight: ['400', '700'] });

interface PrintableShipment extends Shipment {
    governorateName: string;
    companyName: string;
}

// --- Data Fetching Functions ---

const fetchShipment = async (firestore: Firestore, shipmentId: string): Promise<Shipment | null> => {
    const shipmentDocRef = doc(firestore, 'shipments', shipmentId);
    const shipmentSnap = await getDoc(shipmentDocRef);
    return shipmentSnap.exists() ? { ...shipmentSnap.data(), id: shipmentSnap.id } as Shipment : null;
};

const fetchGovernorate = async (firestore: Firestore, governorateId: string): Promise<Governorate | null> => {
    if (!governorateId) return null;
    const govDocRef = doc(firestore, 'governorates', governorateId);
    const govSnap = await getDoc(govDocRef);
    return govSnap.exists() ? { ...govSnap.data(), id: govSnap.id } as Governorate : null;
};

const fetchCompany = async (firestore: Firestore, companyId: string): Promise<Company | null> => {
    if (!companyId) return null;
    const companyDocRef = doc(firestore, 'companies', companyId);
    const companySnap = await getDoc(companyDocRef);
    return companySnap.exists() ? { ...companySnap.data(), id: companySnap.id } as Company : null;
};


// --- Child Components ---

const SingleShipmentPrint = () => {
    const [data, setData] = useState<PrintableShipment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [originUrl, setOriginUrl] = useState('');
    const params = useParams();
    const firestore = useFirestore();

    useEffect(() => {
        setOriginUrl(window.location.origin);
        const shipmentId = params.shipmentId as string;

        const fetchData = async () => {
            if (!firestore || !shipmentId) return;
            try {
                const shipment = await fetchShipment(firestore, shipmentId);
                if (!shipment) {
                    setError("لم يتم العثور على الشحنة المطلوبة.");
                    return;
                }
                const governorate = shipment.governorateId ? await fetchGovernorate(firestore, shipment.governorateId) : null;
                const company = shipment.companyId ? await fetchCompany(firestore, shipment.companyId) : null;

                setData({
                    ...shipment,
                    governorateName: governorate?.name || 'N/A',
                    companyName: company?.name || 'N/A'
                });
            } catch (e) {
                console.error("Error fetching single print data:", e);
                setError("حدث خطأ أثناء تحميل بيانات الطباعة.");
            }
        };

        fetchData();
    }, [firestore, params]);

    useEffect(() => {
        if (data || error) {
            const timer = setTimeout(() => {
                if (data) {
                    window.print();
                }
                setTimeout(() => window.close(), 1000);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [data, error]);

    if (error) return <PrintableError />;
    if (!data) return <PrintableLoader />;

    return (
        <div className="w-full min-h-screen flex items-center justify-center bg-gray-200">
            <ShipmentLabel
                shipment={data}
                governorateName={data.governorateName}
                companyName={data.companyName}
                editUrl={`${originUrl}/?edit=${data.id}`}
                className={cairo.className}
            />
        </div>
    );
};

const BulkShipmentPrint = () => {
    const [data, setData] = useState<PrintableShipment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [originUrl, setOriginUrl] = useState('');
    const searchParams = useSearchParams();
    const firestore = useFirestore();

    useEffect(() => {
        setOriginUrl(window.location.origin);
        const bulkIds = searchParams.get('ids');

        const fetchData = async () => {
            if (!firestore || !bulkIds) return;
            try {
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

                if (shipments.length === 0) {
                  setError("لم يتم العثور على أي من الشحنات المحددة.");
                  return;
                }

                const allGovIds = [...new Set(shipments.map(s => s.governorateId).filter((id): id is string => !!id))];
                const allCompanyIds = [...new Set(shipments.map(s => s.companyId).filter((id): id is string => !!id))];
                
                let govMap = new Map();
                let companyMap = new Map();

                if (allGovIds.length > 0) {
                    const govSnap = await getDocs(query(collection(firestore, 'governorates'), where(documentId(), 'in', allGovIds)));
                    govMap = new Map(govSnap.docs.map(doc => [doc.id, doc.data() as Governorate]));
                }
                 if (allCompanyIds.length > 0) {
                    const companySnap = await getDocs(query(collection(firestore, 'companies'), where(documentId(), 'in', allCompanyIds)));
                    companyMap = new Map(companySnap.docs.map(doc => [doc.id, doc.data() as Company]));
                 }


                const printableData = shipments.map(shipment => ({
                    ...shipment,
                    governorateName: shipment.governorateId ? govMap.get(shipment.governorateId)?.name || 'N/A' : 'N/A',
                    companyName: companyMap.get(shipment.companyId)?.name || 'N/A'
                }));

                setData(printableData);
            } catch (e) {
                console.error("Error fetching bulk print data:", e);
                setError("حدث خطأ أثناء تحميل بيانات الطباعة.");
            }
        };

        fetchData();
    }, [firestore, searchParams]);

    useEffect(() => {
        if (data || error) {
            const timer = setTimeout(() => {
                if (data && data.length > 0) {
                    window.print();
                }
                setTimeout(() => window.close(), 1000);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [data, error]);

    if (error) return <PrintableError />;
    if (!data) return <PrintableLoader />;

    return (
        <div className="bg-gray-200">
            {data.map((shipment) => (
                <div key={shipment.id} className="page-break" style={{ width: '100mm', height: '100mm', display: 'block', margin: '0' }}>
                    <ShipmentLabel
                        shipment={shipment}
                        governorateName={shipment.governorateName}
                        companyName={shipment.companyName}
                        editUrl={`${originUrl}/?edit=${shipment.id}`}
                        className={cairo.className}
                    />
                </div>
            ))}
        </div>
    );
};

// --- UI Components ---
const PrintableError = () => (
    <div className="flex h-screen items-center justify-center text-center p-4" dir="rtl">
        <div>
            <h1 className="text-xl font-bold text-destructive">حدث خطأ</h1>
            <p className="text-muted-foreground">سيتم إغلاق هذه النافذة تلقائياً.</p>
        </div>
    </div>
);

const PrintableLoader = () => (
    <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>
);


// --- Main Page Component ---
function PrintView() {
    const params = useParams();
    const isBulk = params.shipmentId === 'bulk';

    if (isBulk) {
        return <BulkShipmentPrint />;
    }
    return <SingleShipmentPrint />;
}

export default function PrintShipmentPage() {
    return (
        <Suspense fallback={<PrintableLoader />}>
            <main className={cairo.className}>
                <PrintView />
            </main>
        </Suspense>
    );
}
