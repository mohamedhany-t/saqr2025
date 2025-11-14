import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, CircleDollarSign, Building } from "lucide-react";
import type { Shipment, Role, Company } from "@/lib/types";

interface StatsCardsProps {
    shipments: Shipment[];
    role: Role | null;
    companies: Company[];
}

export function StatsCards({ shipments, role, companies }: StatsCardsProps) {
    const totalRevenue = shipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const inTransit = shipments.filter(s => s.status === 'In-Transit').length;
    const delivered = shipments.filter(s => s.status === 'Delivered').length;
    const totalShipments = shipments.length;

    const stats = [
        { title: "إجمالي الإيرادات", value: `${totalRevenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: CircleDollarSign, description: "" },
        { title: "قيد التوصيل", value: `+${inTransit}`, icon: Truck, description: "" },
        { title: "تم التوصيل", value: `+${delivered}`, icon: CheckCircle2, description: "" },
        { title: "إجمالي الشحنات", value: `${totalShipments}`, icon: Package, description: "" },
    ];
    
    const companyRevenues = role === 'admin' 
        ? companies.map(company => {
            const companyShipments = shipments.filter(s => s.companyId === company.id);
            const revenue = companyShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
            return {
                title: `إيرادات ${company.name}`,
                value: `${revenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`,
                icon: Building
            }
        })
        : [];


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
            {role === 'admin' && companyRevenues.length > 0 && (
                 <div className="mt-8">
                     <h3 className="text-xl font-headline font-semibold mb-4">إيرادات الشركات</h3>
                    <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                        {companyRevenues.map((stat, index) => (
                             <Card key={index}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stat.value}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
