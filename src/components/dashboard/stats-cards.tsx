
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, CircleDollarSign, Building, Wallet, BadgeDollarSign, Archive } from "lucide-react";
import type { Shipment, Role } from "@/lib/types";

interface StatsCardsProps {
    shipments: Shipment[];
    role: Role | null;
}

export function StatsCards({ shipments, role }: StatsCardsProps) {
    const totalRevenue = shipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const inTransit = shipments.filter(s => s.status === 'In-Transit').length;
    const delivered = shipments.filter(s => s.status === 'Delivered' || s.status === 'Partially Delivered' || s.status === 'Evasion').length;
    const returned = shipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled').length;
    const totalShipments = shipments.length;

    // For Courier Dashboard
    const totalCourierCommission = shipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
    const netDueForCourier = totalRevenue - totalCourierCommission;


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
        { title: "المبلغ المستحق للدفع", value: `${netDueForCourier.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`, icon: Wallet, description: "الصافي المستحق عليك تسليمه للشركة." },
        { title: "إجمالي الشحنات", value: `${totalShipments}`, icon: Package, description: "إجمالي عدد الشحنات المسندة إليك." },
    ];
    
    let statsToDisplay;
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
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
