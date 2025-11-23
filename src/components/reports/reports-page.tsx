

"use client";
import React, { useState } from 'react';
import type { Shipment, Company, User, Governorate, CourierPayment, CompanyPayment } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { FileUp, Loader2 } from 'lucide-react';
import { exportToExcel } from '@/lib/export';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
    
    const handleExport = (data: any[], type: string, fileName: string) => {
        const reportColumns = getReportColumns(type);
        exportToExcel(data, reportColumns, fileName, governorates, companies, couriers);
    };

    const getReportColumns = (type: string): any[] => {
        const baseShipmentCols = [
          { accessorKey: "orderNumber", header: "رقم الطلب" },
          { accessorKey: "trackingNumber", header: "رقم الشحنة" },
          { accessorKey: "companyId", header: "الشركة" },
          { accessorKey: "senderName", header: "الراسل" },
          { accessorKey: "createdAt", header: "التاريخ" },
          { accessorKey: "recipientName", header: "المرسل اليه" },
          { accessorKey: "governorateId", header: "المحافظة" },
          { accessorKey: "address", header: "العنوان" },
          { accessorKey: "assignedCourierId", header: "المندوب"},
          { accessorKey: "status", header: "الحالة" },
          { accessorKey: "totalAmount", header: "الاجمالي" },
          { accessorKey: "paidAmount", header: "المدفوع" },
          { accessorKey: "reason", header: "السبب" },
        ];
        
        switch(type) {
            case 'company_shipments':
                return [...baseShipmentCols, { accessorKey: "companyCommission", header: "عمولة الشركة" }];
            case 'courier_shipments':
                return [...baseShipmentCols, { accessorKey: "courierCommission", header: "عمولة المندوب" }];
            case 'delivered_shipments':
            case 'returned_shipments':
            case 'all_shipments':
                return baseShipmentCols;
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

    const deliveredShipments = shipments.filter(s => s.status === 'Delivered' || s.status === 'Partially Delivered' || s.status === 'Evasion (Delivery Attempt)');
    const returnedShipments = shipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled' || s.status === 'Returned to Sender' || s.status === 'Evasion (Phone)');

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
        { title: "تقرير الشحنات الكامل", description: `تصدير جميع الشحنات في النظام. (${shipments.length} شحنة)`, data: shipments, type: 'all_shipments', fileName: 'all_shipments' },
        { title: "تقرير التسليمات", description: `تصدير جميع الشحنات التي تم تسليمها بنجاح. (${deliveredShipments.length} شحنة)`, data: deliveredShipments, type: 'delivered_shipments', fileName: 'delivered_shipments' },
        { title: "تقرير المرتجعات", description: `تصدير جميع الشحنات المرتجعة أو الملغاة. (${returnedShipments.length} شحنة)`, data: returnedShipments, type: 'returned_shipments', fileName: 'returned_shipments' },
        { title: "التقرير المالي للمناديب", description: "ملخص مالي لجميع المناديب.", data: courierFinancials, type: 'courier_financials', fileName: 'courier_financials' },
        { title: "التقرير المالي للشركات", description: "ملخص مالي لجميع الشركات.", data: companyFinancials, type: 'company_financials', fileName: 'company_financials' },
    ]

    const handleExportCompanyReport = () => {
        if (!selectedCompanyId) return;
        const company = companies.find(c => c.id === selectedCompanyId);
        if (!company) return;
        const companyShipments = shipments.filter(s => s.companyId === selectedCompanyId);
        handleExport(companyShipments, 'company_shipments', `shipments_${company.name.replace(/\s/g, '_')}`);
    };

    const handleExportCourierReport = () => {
        if (!selectedCourierId) return;
        const courier = couriers.find(c => c.id === selectedCourierId);
        if (!courier) return;
        const courierShipments = shipments.filter(s => s.assignedCourierId === selectedCourierId);
        handleExport(courierShipments, 'courier_shipments', `shipments_${courier.name?.replace(/\s/g, '_')}`);
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">التقارير العامة</h1>
                <p className="text-muted-foreground">
                    تقارير مجمعة لجميع جوانب عملياتك.
                </p>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
                    {reportCards.map(report => (
                        <Card key={report.type} className="flex flex-col">
                            <CardHeader>
                                <CardTitle>{report.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <CardDescription>{report.description}</CardDescription>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => handleExport(report.data, report.type, report.fileName)} disabled={report.data.length === 0}>
                                    <FileUp className="me-2 h-4 w-4" />
                                    تصدير إلى Excel
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>

             <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">تقارير الشركات المخصصة</h2>
                <p className="text-muted-foreground">
                    اختر شركة لاستخراج تقرير مفصل بجميع شحناتها.
                </p>
                 <div className="mt-4">
                     <Card>
                        <CardContent className="pt-6">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                 <div className="md:col-span-2">
                                     <label className="text-sm font-medium mb-2 block">اختر الشركة</label>
                                     <Select dir="rtl" onValueChange={setSelectedCompanyId} value={selectedCompanyId || ''}>
                                         <SelectTrigger>
                                             <SelectValue placeholder="اختر شركة..." />
                                         </SelectTrigger>
                                         <SelectContent>
                                             {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                         </SelectContent>
                                     </Select>
                                 </div>
                                 <Button onClick={handleExportCompanyReport} disabled={!selectedCompanyId}>
                                     <FileUp className="me-2 h-4 w-4" />
                                     تصدير تقرير الشحنات
                                 </Button>
                             </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-2">تقارير المناديب المخصصة</h2>
                <p className="text-muted-foreground">
                    اختر مندوبًا لاستخراج تقرير مفصل بجميع شحناته.
                </p>
                <div className="mt-4">
                     <Card>
                        <CardContent className="pt-6">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                  <div className="md:col-span-2">
                                     <label className="text-sm font-medium mb-2 block">اختر المندوب</label>
                                     <Select dir="rtl" onValueChange={setSelectedCourierId} value={selectedCourierId || ''}>
                                         <SelectTrigger>
                                             <SelectValue placeholder="اختر مندوبًا..." />
                                         </SelectTrigger>
                                         <SelectContent>
                                             {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                         </SelectContent>
                                     </Select>
                                  </div>
                                  <Button onClick={handleExportCourierReport} disabled={!selectedCourierId}>
                                      <FileUp className="me-2 h-4 w-4" />
                                      تصدير تقرير الشحنات
                                  </Button>
                              </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
