

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, CircleDollarSign, Building, Wallet, BadgeDollarSign, Archive, HandCoins, Loader2 } from "lucide-react";
import type { Shipment, Role, CourierPayment, ShipmentStatusConfig } from "@/lib/types";
import React, { useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useFirebaseApp, useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { query, collection } from "firebase/firestore";

interface StatsCardsProps {
    shipments: Shipment[];
    payments?: CourierPayment[];
    role: Role | null;
}

interface AdminStatsData {
    totalRevenue: number;
    inTransit: number;
    delivered: number;
    returned: number;
    totalShipments: number;
}

export function StatsCards({ shipments, payments, role }: StatsCardsProps) {
    const [adminStats, setAdminStats] = useState<AdminStatsData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const app = useFirebaseApp();
    const firestore = useFirestore();

    const { data: statuses } = useCollection<ShipmentStatusConfig>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]));

    useEffect(() => {
        if (role === 'admin') {
            // Admin stats are not fetched on the client side to avoid heavy reads.
            // This component can be adapted to fetch stats if needed.
            // For now, we will rely on client-side calculation which might be incomplete
            // for a full system overview but is useful for other roles.
            setIsLoading(false);
        }
    }, [role, app]);
    
    if (isLoading) {
        return (
            <div className="my-6 grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                {Array.from({length: 4}).map((_, i) => (
                    <Card key={i}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                             <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                        </CardHeader>
                        <CardContent>
                             <div className="h-8 w-32 bg-muted rounded animate-pulse" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        )
    }

    const deliveredStatuses = statuses?.filter(s => s.isDeliveredStatus).map(s => s.id) || [];
    const returnedStatuses = statuses?.filter(s => s.isReturnedStatus).map(s => s.id) || [];


    const totalRevenue = shipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const inTransit = shipments.filter(s => !deliveredStatuses.includes(s.status) && !returnedStatuses.includes(s.status)).length;
    const delivered = shipments.filter(s => deliveredStatuses.includes(s.status)).length;
    const returned = shipments.filter(s => returnedStatuses.includes(s.status)).length;
    
    const totalShipments = shipments.length;

    // For Courier Dashboard
    const totalCourierCommission = shipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
    const totalPaidByCourier = payments?.reduce((acc, p) => acc + p.amount, 0) || 0;
    
    // For calculating net due, we only use ACTIVE (non-archived) payments.
    const activePayments = payments?.filter(p => !p.isArchived) || [];
    const totalActivePaidByCourier = activePayments.reduce((acc, p) => acc + p.amount, 0);
    const netDueForCourier = (totalRevenue - totalCourierCommission) - totalActivePaidByCourier;


    const adminStatsList = [
        { title: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: CircleDollarSign, description: "" },
        { title: "قيد التوصيل", value: `+${inTransit}`, icon: Truck, description: "" },
        { title: "تم التسليم", value: `+${delivered}`, icon: CheckCircle2, description: "" },
        { title: "المرتجعات", value: `${returned}`, icon: Archive, description: "" },
    ];
    
    const companyStats = [
        { title: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: CircleDollarSign, description: "إجمالي الإيرادات من الشحنات المسلمة." },
        { title: "قيد التوصيل", value: `+${inTransit}`, icon: Truck, description: "الشحنات التي هي مع المناديب حاليا." },
        { title: "تم التسليم", value: `+${delivered}`, icon: CheckCircle2, description: "الشحنات التي تم توصيلها بنجاح." },
        { title: "إجمالي الشحنات", value: `${totalShipments}`, icon: Package, description: "إجمالي عدد الشحنات الخاصة بشركتك." },
    ];
    
    const courierStats = [
        { title: "إجمالي التحصيل", value: `${totalRevenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: CircleDollarSign, description: "المبلغ الإجمالي الذي قمت بتحصيله." },
        { title: "إجمالي عمولاتك", value: `${totalCourierCommission.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: BadgeDollarSign, description: "مجموع العمولات المستحقة لك." },
        { title: "إجمالي المدفوعات", value: `${totalPaidByCourier.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: HandCoins, description: "إجمالي المبالغ التي قمت بدفعها للشركة." },
        { title: "صافي المبلغ المستحق", value: `${netDueForCourier.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: Wallet, description: "الصافي المستحق عليك تسليمه للشركة." },
    ];
    
    let statsToDisplay: { title: string; value: string; icon: React.ElementType; description: string; }[];
    switch(role) {
        case 'admin':
            statsToDisplay = adminStatsList;
            break;
        case 'company':
            statsToDisplay = companyStats;
            break;
        case 'courier':
            statsToDisplay = courierStats;
            break;
        default:
            statsToDisplay = [];
            break;
    }


    return (
        <div className="my-6">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                {statsToDisplay.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${stat.title === 'صافي المبلغ المستحق' ? (netDueForCourier >= 0 ? 'text-destructive' : 'text-green-600') : ''}`}>{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
