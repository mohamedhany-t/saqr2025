

"use client";
import React from 'react';
import type { Shipment, Company, User, Governorate, CourierPayment, CompanyPayment, ShipmentStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { FileUp, Loader2 } from 'lucide-react';
import { exportToExcel } from '@/lib/export';

interface ReportsPageProps {
    shipments: Shipment[];
    companies: Company[];
    couriers: User[];
    governorates: Governorate[];
    courierPayments: CourierPayment[];
    companyPayments: CompanyPayment[];
    isLoading: boolean;
}

export function ReportsPage({
    shipments,
    companies,
    couriers,
    governorates,
    courierPayments,
    companyPayments,
    isLoading
}: ReportsPageProps) {

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
    
    const handleExport = (data: any[], type: string) => {
        const reportColumns = getReportColumns(type);
        exportToExcel(data, reportColumns, type, governorates, companies, couriers);
    };

    const getReportColumns = (type: string): any[] => {
        // A simple way to get columns, can be expanded
        const basicShipmentCols = [
          { accessorKey: "orderNumber", header: "رقم الطلب" },
          { accessorKey: "trackingNumber", header: "رقم الشحنة" },
          { accessorKey: "companyId", header: "الشركة" },
          { accessorKey: "createdAt", header: "التاريخ" },
          { accessorKey: "recipientName", header: "المرسل اليه" },
          { accessorKey: "governorateId", header: "المحافظة" },
          { accessorKey: "assignedCourierId", header: "المندوب"},
          { accessorKey: "status", header: "الحالة" },
          { accessorKey: "totalAmount", header: "الاجمالي" },
          { accessorKey: "paidAmount", header: "المدفوع" },
        ];
        
        switch(type) {
            case 'delivered_shipments':
            case 'returned_shipments':
            case 'all_shipments':
                return basicShipmentCols;
            case 'courier_financials':
                 return [
                    { accessorKey: "name", header: "اسم المندوب" },
                    { accessorKey: "totalShipments", header: "إجمالي الشحنات" },
                    { accessorKey: "totalCollected", header: "إجمالي المحصل" },
                    { accessorKey: "totalCommission", header: "إجمالي العمولات" },
                    { accessorKey: "totalPaidToCompany", header: "إجمالي المدفوع للشركة" },
                    { accessorKey: "netDue", header: "صافي المستحق" },
                 ];
            case 'company_financials':
                 return [
                    { accessorKey: "name", header: "اسم الشركة" },
                    { accessorKey: "totalShipments", header: "إجمالي الشحنات" },
                    { accessorKey: "totalRevenue", header: "إجمالي الإيرادات" },
                    { accessorKey: "totalCompanyCommission", header: "عمولات الشركة" },
                    { accessorKey: "totalPaidByAdmin", header: "إجمالي المدفوع من الإدارة" },
                    { accessorKey: "netDue", header: "صافي المستحق" },
                 ];
            default:
                return [];
        }
    }

    const deliveredShipments = shipments.filter(s => s.status === 'Delivered' || s.status === 'Partially Delivered' || s.status === 'Evasion');
    const returnedShipments = shipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled' || s.status === 'Returned to Sender');

    const courierFinancials = couriers.map(courier => {
        const courierShipments = shipments.filter(s => s.assignedCourierId === courier.id);
        const payments = courierPayments.filter(p => p.courierId === courier.id);
        const totalCollected = courierShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCommission = courierShipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
        const totalPaidToCompany = payments.reduce((acc, p) => acc + p.amount, 0);
        const netDue = (totalCollected - totalCommission) - totalPaidToCompany;
        return {
            name: courier.name,
            totalShipments: courierShipments.length,
            totalCollected,
            totalCommission,
            totalPaidToCompany,
            netDue,
        }
    });
    
    const companyFinancials = companies.map(company => {
        const companyShipments = shipments.filter(s => s.companyId === company.id);
        const payments = companyPayments.filter(p => p.companyId === company.id);
        const totalRevenue = companyShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCompanyCommission = companyShipments.reduce((acc, s) => acc + (s.companyCommission || 0), 0);
        const totalPaidByAdmin = payments.reduce((acc, p) => acc + p.amount, 0);
        const netDue = (totalRevenue - totalCompanyCommission) - totalPaidByAdmin;
        return {
            name: company.name,
            totalShipments: companyShipments.length,
            totalRevenue,
            totalCompanyCommission,
            totalPaidByAdmin,
            netDue,
        }
    });

    const reportCards = [
        { title: "تقرير الشحنات الكامل", description: `تصدير جميع الشحنات في النظام. (${shipments.length} شحنة)`, data: shipments, type: 'all_shipments' },
        { title: "تقرير التسليمات", description: `تصدير جميع الشحنات التي تم تسليمها بنجاح. (${deliveredShipments.length} شحنة)`, data: deliveredShipments, type: 'delivered_shipments' },
        { title: "تقرير المرتجعات", description: `تصدير جميع الشحنات المرتجعة أو الملغاة. (${returnedShipments.length} شحنة)`, data: returnedShipments, type: 'returned_shipments' },
        { title: "التقرير المالي للمناديب", description: "ملخص مالي لجميع المناديب.", data: courierFinancials, type: 'courier_financials' },
        { title: "التقرير المالي للشركات", description: "ملخص مالي لجميع الشركات.", data: companyFinancials, type: 'company_financials' },
    ]

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <h1 className="text-2xl font-bold mb-4">التقارير</h1>
            <p className="text-muted-foreground mb-6">
                هنا يمكنك استخراج تقارير مفصلة لجميع جوانب عملياتك وتصديرها كملفات Excel.
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {reportCards.map(report => (
                    <Card key={report.type} className="flex flex-col">
                        <CardHeader>
                            <CardTitle>{report.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <CardDescription>{report.description}</CardDescription>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={() => handleExport(report.data, report.type)} disabled={report.data.length === 0}>
                                <FileUp className="me-2 h-4 w-4" />
                                تصدير إلى Excel
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    )
}
