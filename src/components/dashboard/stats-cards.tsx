import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, CircleDollarSign, Building, Wallet, BadgeDollarSign, Archive, HandCoins } from "lucide-react";
import type { Shipment, Role, CourierPayment } from "@/lib/types";
import React from 'react';

interface StatsCardsProps {
    shipments: Shipment[];
    payments?: CourierPayment[];
    role: Role | null;
}

export function StatsCards({ shipments, payments, role }: StatsCardsProps) {
    const totalRevenue = shipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const inTransit = shipments.filter(s => s.status === 'In-Transit').length;
    const delivered = shipments.filter(s => s.status === 'Delivered').length;
    const returned = shipments.filter(s => ['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)'].includes(s.status)).length;
    const totalShipments = shipments.length;

    // For Courier Dashboard
    const totalCourierCommission = shipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
    const totalPaidByCourier = payments?.filter(p => !p.isArchived).reduce((acc, p) => acc + p.amount, 0) || 0;
    const netDueForCourier = (totalRevenue - totalCourierCommission) - totalPaidByCourier;


    const adminStats = [
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
            statsToDisplay = adminStats;
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
                            <div className={`text-2xl font-bold ${stat.title === 'صافي المبلغ المستحق' ? (netDueForCourier > 0 ? 'text-destructive' : 'text-green-600') : ''}`}>{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
