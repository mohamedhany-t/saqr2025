import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, CheckCircle2, CircleDollarSign } from "lucide-react";

const stats = [
    { title: "إجمالي الإيرادات", value: "45,231.89 ر.س", icon: CircleDollarSign, description: "+20.1% عن الشهر الماضي" },
    { title: "قيد التوصيل", value: "+2350", icon: Truck, description: "+180.1% عن الشهر الماضي" },
    { title: "تم التوصيل", value: "+12,234", icon: CheckCircle2, description: "+19% عن الشهر الماضي" },
    { title: "إجمالي الشحنات", value: "573", icon: Package, description: "+201 منذ الأسبوع الماضي" },
];

export function StatsCards() {
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
