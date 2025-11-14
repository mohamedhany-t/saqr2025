import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, CircleDollarSign } from "lucide-react";
import type { Shipment } from "@/lib/types";

export function StatsCards({ shipments }: { shipments: Shipment[]}) {
    const totalRevenue = shipments.filter(s => s.status === 'Delivered').reduce((acc, s) => acc + s.totalAmount, 0);
    const inTransit = shipments.filter(s => s.status === 'In-Transit').length;
    const delivered = shipments.filter(s => s.status === 'Delivered').length;
    const totalShipments = shipments.length;

    const stats = [
        { title: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString('ar-SA', { style: 'currency', currency: 'SAR' })}`, icon: CircleDollarSign, description: "" },
        { title: "قيد التوصيل", value: `+${inTransit}`, icon: Truck, description: "" },
        { title: "تم التوصيل", value: `+${delivered}`, icon: CheckCircle2, description: "" },
        { title: "إجمالي الشحنات", value: `${totalShipments}`, icon: Package, description: "" },
    ];


    return (
        <div className="my-6">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                {stats.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
