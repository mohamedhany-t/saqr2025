"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Package } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { Shipment } from '@/lib/types';
import { ShipmentHistoryTimeline } from '@/components/shipments/shipment-history-timeline';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Logo } from '@/components/icons';

// Main page component wrapped in Suspense
export default function TrackShipmentPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40 p-4" dir="rtl">
            <div className="mb-8 text-center">
                <Logo className="mx-auto size-12 text-primary" />
                <h1 className="text-4xl font-bold font-headline mt-4">تتبع شحنتك</h1>
                <p className="text-muted-foreground">
                    أدخل رقم الشحنة أو رقم الطلب لمعرفة حالتها الحالية.
                </p>
            </div>
            <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                <TrackingComponent />
            </Suspense>
        </div>
    );
}

// This component uses client-side hooks and is now rendered within Suspense
function TrackingComponent() {
    const searchParams = useSearchParams();
    const [trackingNumber, setTrackingNumber] = useState('');
    const [shipment, setShipment] = useState<Shipment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const firestore = useFirestore();

    const handleSearch = async (code?: string) => {
        const searchCode = code || trackingNumber;
        if (!searchCode.trim() || !firestore) {
            setError("يرجى إدخال رقم شحنة صالح.");
            return;
        }
        setIsLoading(true);
        setShipment(null);
        setError(null);

        try {
            const shipmentsRef = collection(firestore, 'shipments');
            const q = query(shipmentsRef, 
                where('trackingNumber', '==', searchCode.trim()),
                limit(1)
            );
            const q2 = query(shipmentsRef,
                where('orderNumber', '==', searchCode.trim()),
                limit(1)
            );

            const [querySnapshot, querySnapshot2] = await Promise.all([getDocs(q), getDocs(q2)]);

            let foundDoc;
            if (!querySnapshot.empty) {
                foundDoc = querySnapshot.docs[0];
            } else if (!querySnapshot2.empty) {
                foundDoc = querySnapshot2.docs[0];
            }


            if (foundDoc) {
                setShipment({ id: foundDoc.id, ...foundDoc.data() } as Shipment);
            } else {
                setError("لم يتم العثور على شحنة بهذا الرقم. يرجى التحقق مرة أخرى.");
            }
        } catch (e) {
            console.error(e);
            setError("حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.");
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        const queryParam = searchParams.get('q');
        if (queryParam) {
            setTrackingNumber(queryParam);
            handleSearch(queryParam);
        }
    }, [searchParams]);

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <div className="flex gap-2">
                    <Input
                        type="search"
                        placeholder="أدخل رقم الشحنة أو الطلب هنا..."
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        className="flex-grow"
                    />
                    <Button onClick={() => handleSearch()} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        <span className="sr-only sm:not-sr-only sm:ms-2">بحث</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {shipment && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <Package className="h-6 w-6 text-primary" />
                                    <span>الحالة الحالية للشحنة</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold">{shipment.status}</p>
                                {shipment.reason && <p className="text-muted-foreground mt-2">السبب: {shipment.reason}</p>}
                            </CardContent>
                        </Card>
                        <ShipmentHistoryTimeline shipmentId={shipment.id} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}