
"use client";
import React, { useState, useEffect } from 'react';
import type { Shipment, Company, User, Governorate, CourierPayment, CompanyPayment, ShipmentStatusConfig } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { FileUp, Loader2, ChevronDown, CalendarIcon } from 'lucide-react';
import { exportToExcel } from '@/lib/export';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format as formatDate, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ReportsPageProps {
    shipments: Shipment[];
    companies: Company[];
    couriers: User[];
    governorates: Governorate[];
    courierPayments: CourierPayment[];
    companyPayments: CompanyPayment[];
    isLoading: boolean;
}

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (date.toDate instanceof Function) return date.toDate(); // Firestore Timestamp
    if (date instanceof Date) return date; // JS Date
    const parsed = new Date(date); // ISO string or number
    return isNaN(parsed.getTime()) ? null : parsed;
};


export function ReportsPage({
    shipments,
    companies,
    couriers,
    governorates,
    courierPayments,
    companyPayments,
    isLoading: isPropsLoading
}: ReportsPageProps) {
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
    const [selectedCompanyForReturnsId, setSelectedCompanyForReturnsId] = useState<string | null>(null);
    
    // States for Supply Sheet
    const [supplySheetDateRange, setSupplySheetDateRange] = useState<DateRange | undefined>();

    // States for Update Sheet
    const [selectedCompanyForUpdateId, setSelectedCompanyForUpdateId] = useState<string | null>(null);
    const [companyUpdateStatuses, setCompanyUpdateStatuses] = useState<string[]>([]);
    const [updateSheetDateRange, setUpdateSheetDateRange] = useState<DateRange | undefined>();
    
    // States for Returns Sheet
    const [returnsSheetDateRange, setReturnsSheetDateRange] = useState<DateRange | undefined>();

    // States for Courier Report
    const [courierReportStatuses, setCourierReportStatuses] = useState<string[]>([]);
    const [courierReportDateRange, setCourierReportDateRange] = useState<DateRange | undefined>();

    const { toast } = useToast();
    const firestore = useFirestore();

    const statusesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'shipment_statuses') : null, [firestore]);
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);
    
    const isLoading = isPropsLoading || statusesLoading;

    const enabledStatuses = React.useMemo(() => statuses?.filter(s => s.enabled) || [], [statuses]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }
    
    const handleExport = (data: any[], type: string, fileName: string, reportHeader?: {title: string, date: string}) => {
        if (!data || data.length === 0) {
            toast({
                title: "لا توجد بيانات للتصدير",
                description: "لم يتم العثور على بيانات تطابق الفلاتر المحددة.",
                variant: "default"
            });
            return;
        }
        const reportColumns = getReportColumns(type);
        exportToExcel(data, reportColumns, fileName, governorates, companies, couriers, reportHeader);
    };

    const getReportColumns = (type: string): any[] => {
        const baseShipmentCols = [
          { accessorKey: "orderNumber", header: "رقم الطلب" },
          { accessorKey: "shipmentCode", header: "رقم الشحنة" },
          { accessorKey: "companyId", header: "الشركة" },
          { accessorKey: "senderName", header: "الراسل" },
          { accessorKey: "createdAt", header: "التاريخ" },
          { accessorKey: "recipientName", header: "المرسل اليه" },
          { accessorKey: "recipientPhone", header: "هاتف المستلم" },
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
            case 'company_returns':
                return [...baseShipmentCols, { accessorKey: "companyCommission", header: "عمولة الشركة" }, { accessorKey: "netDue", header: "صافي المستحق" }];
            case 'company_update':
                 return baseShipmentCols.filter(col => !['companyCommission', 'courierCommission', 'netDue'].includes(col.accessorKey));
            case 'courier_shipments':
                return [...baseShipmentCols, { accessorKey: "courierCommission", header: "عمولة المندوب" }, { accessorKey: "netDue", header: "صافي المستحق" }];
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
    
    const filterByDateRange = (shipmentsToFilter: Shipment[], dateRange?: DateRange): Shipment[] => {
        if (!dateRange || (!dateRange.from && !dateRange.to)) {
            return shipmentsToFilter;
        }
        return shipmentsToFilter.filter(s => {
            const shipmentDate = getSafeDate(s.createdAt);
            if (!shipmentDate) return false;
            
            const from = dateRange.from ? new Date(new Date(dateRange.from).setHours(0,0,0,0)) : null;
            const to = dateRange.to ? new Date(new Date(dateRange.to).setHours(23,59,59,999)) : from;

            if (from && shipmentDate < from) return false;
            if (to && shipmentDate > to) return false;
            
            return true;
        });
    };

    const deliveredShipmentStatuses = statuses?.filter(s => s.isDeliveredStatus).map(s => s.id) || [];
    const returnedShipmentStatuses = statuses?.filter(s => s.isReturnedStatus).map(s => s.id) || [];

    const deliveredShipments = shipments.filter(s => deliveredShipmentStatuses.includes(s.status));
    const returnedShipments = shipments.filter(s => returnedShipmentStatuses.includes(s.status));

    const courierFinancials = couriers.map(courier => {
        const courierShipments = shipments.filter(s => s.assignedCourierId === courier.id && !s.isArchivedForCourier);
        const payments = courierPayments.filter(p => p.courierId === courier.id && !p.isArchived);
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
        const companyShipments = shipments.filter(s => s.companyId === company.id && !s.isArchivedForCompany);
        const payments = companyPayments.filter(p => p.companyId === company.id && !p.isArchived);
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

    const filterShipmentsByStatus = (shipments: Shipment[], statusFilters: string[]): Shipment[] => {
        if (statusFilters.length === 0) {
            return shipments;
        }
        return shipments.filter(s => statusFilters.includes(s.status));
    };

    const getEnhancedShipmentData = (shipment: Shipment, context: 'company' | 'courier') => {
        let netDue = 0;
        if (context === 'company') {
            netDue = (shipment.paidAmount || 0) - (shipment.companyCommission || 0);
        } else { // courier
            netDue = (shipment.paidAmount || 0) - (shipment.courierCommission || 0);
        }
        return { ...shipment, netDue };
    }

    const formatDateForDisplay = (date?: Date) => {
        if (!date) return '';
        return formatDate(date, "yyyy-MM-dd");
    }

    const formatDateRangeForDisplay = (dateRange?: DateRange) => {
        if (!dateRange || !dateRange.from) return 'الكل';
        if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
            return `${formatDateForDisplay(dateRange.from)} إلى ${formatDateForDisplay(dateRange.to)}`;
        }
        return formatDateForDisplay(dateRange.from);
    }
    
    const formatDateForFilename = (dateRange?: DateRange) => {
        if (!dateRange || !dateRange.from) return formatDateForDisplay(new Date());
        if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
            return `${formatDateForDisplay(dateRange.from)}_to_${formatDateForDisplay(dateRange.to)}`;
        }
        return formatDateForDisplay(dateRange.from);
    }

    const handleExportCompanyReport = (type: 'supply' | 'update') => {
        const companyId = type === 'supply' ? selectedCompanyId : selectedCompanyForUpdateId;
        const activeDateRange = type === 'supply' ? supplySheetDateRange : updateSheetDateRange;
        const reportType = type === 'supply' ? 'company_shipments' : 'company_update';
        const fileNamePrefix = type === 'supply' ? 'شيت توريد' : 'شيت ابديت';

        if (!companyId) return;
        const company = companies.find(c => c.id === companyId);
        if (!company) return;
        
        let companyShipments = shipments.filter(s => s.companyId === companyId && !s.isArchivedForCompany);
        
        if (type === 'supply') {
            // شيت التوريد يقتصر فقط على الحالات المكتملة والنهائية التي طلبها المستخدم
            const supplyStatusKeys = [
                'Delivered', 
                'Partially Delivered', 
                'Refused (Paid)', 
                'Refused (Unpaid)', 
                'Evasion (Delivery Attempt)'
            ];
            companyShipments = companyShipments.filter(s => supplyStatusKeys.includes(s.status));
        }

        companyShipments = filterByDateRange(companyShipments, activeDateRange);
        
        // الحالات المختارة فقط لشيت الأبديت، أما التوريد فيعتمد على الفلترة البرمجية أعلاه
        const filteredData = type === 'supply' ? companyShipments : filterShipmentsByStatus(companyShipments, companyUpdateStatuses);
        
        const dataToExport = filteredData.map(shipment => getEnhancedShipmentData(shipment, 'company'));

        const dateStringForFilename = formatDateForFilename(activeDateRange);
        const fileName = `${fileNamePrefix} - ${company.name} - ${dateStringForFilename}`;
        
        const reportHeader = {
            title: `${fileNamePrefix} شركة: ${company.name}`,
            date: `تاريخ التقرير: ${formatDateRangeForDisplay(activeDateRange)}`
        };

        handleExport(dataToExport, reportType, fileName, reportHeader);
    };

    const handleExportCourierReport = () => {
        if (!selectedCourierId) return;
        const courier = couriers.find(c => c.id === selectedCourierId);
        if (!courier) return;
        
        let courierShipments = shipments.filter(s => s.assignedCourierId === selectedCourierId && !s.isArchivedForCourier);
        courierShipments = filterByDateRange(courierShipments, courierReportDateRange);
        
        const filteredData = filterShipmentsByStatus(courierShipments, courierReportStatuses);
        
        const dataToExport = filteredData.map(shipment => getEnhancedShipmentData(shipment, 'courier'));
        
        const statusString = courierReportStatuses.length > 0 ? courierReportStatuses.map(s => enabledStatuses.find(es => es.id === s)?.label || s).join('_') : 'الكل';
        const dateString = formatDateForFilename(courierReportDateRange);
        const fileName = `شحنات_${courier.name?.replace(/\s/g, '_')}_${statusString}_${dateString}`;
        
        const reportHeader = {
            title: `تقرير شحنات المندوب: ${courier.name}`,
            date: `الفترة: ${formatDateRangeForDisplay(courierReportDateRange)}`
        };

        handleExport(dataToExport, 'courier_shipments', fileName, reportHeader);
    };

    const handleExportCompanyReturns = () => {
        if (!selectedCompanyForReturnsId) return;
        const company = companies.find(c => c.id === selectedCompanyForReturnsId);
        if (!company) return;

        let companyReturns = shipments.filter(s => 
            s.companyId === selectedCompanyForReturnsId && s.isReturningToCompany === true && !s.isReturnedToCompany
        );
        companyReturns = filterByDateRange(companyReturns, returnsSheetDateRange);

        const dateString = formatDateForFilename(returnsSheetDateRange);
        const fileName = `شيت مرتجعات للتسليم - ${company.name} - ${dateString}`;

        const reportHeader = {
            title: `شيت مرتجعات جاهزة للتسليم لشركة: ${company.name}`,
            date: `تاريخ التقرير: ${formatDateRangeForDisplay(returnsSheetDateRange)}`
        };

        handleExport(companyReturns, 'company_returns', fileName, reportHeader);
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
                <h2 className="text-2xl font-bold mb-2">شيت توريد الشركات</h2>
                <p className="text-muted-foreground">
                    اختر شركة وتاريخاً لتصدير شيت توريد للشحنات النهائية والمالية فقط.
                </p>
                 <div className="mt-4">
                     <Card>
                        <CardContent className="pt-6">
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                 <div>
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
                                  <div>
                                     <label className="text-sm font-medium mb-2 block">فلترة حسب التاريخ</label>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant={"outline"}
                                            className={cn(
                                              "w-full justify-start text-right font-normal",
                                              !supplySheetDateRange && "text-muted-foreground"
                                            )}
                                          >
                                            <CalendarIcon className="ml-2 h-4 w-4" />
                                            {supplySheetDateRange?.from ? (
                                              supplySheetDateRange.to && !isSameDay(supplySheetDateRange.from, supplySheetDateRange.to) ? (
                                                <>
                                                  {formatDate(supplySheetDateRange.from, "LLL dd, y", { locale: ar })} -{' '}
                                                  {formatDate(supplySheetDateRange.to, "LLL dd, y", { locale: ar })}
                                                </>
                                              ) : (
                                                formatDate(supplySheetDateRange.from, "LLL dd, y", { locale: ar })
                                              )
                                            ) : (
                                              <span>اختر تاريخ</span>
                                            )}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={supplySheetDateRange?.from}
                                            selected={supplySheetDateRange}
                                            onSelect={setSupplySheetDateRange}
                                            numberOfMonths={2}
                                            locale={ar}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                 </div>
                                 <Button onClick={() => handleExportCompanyReport('supply')} disabled={!selectedCompanyId}>
                                     <FileUp className="me-2 h-4 w-4" />
                                     إنشاء شيت توريد مالي
                                 </Button>
                             </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">شيت أبديت للشركات</h2>
                <p className="text-muted-foreground">
                    اختر شركة وحالة الشحنات لاستخراج شيت تحديث مختصر (بدون بيانات مالية).
                </p>
                <div className="mt-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium mb-2 block">اختر الشركة</label>
                                    <Select dir="rtl" onValueChange={setSelectedCompanyForUpdateId} value={selectedCompanyForUpdateId || ''}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر شركة..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div>
                                     <label className="text-sm font-medium mb-2 block">فلترة حسب التاريخ</label>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant={"outline"}
                                            className={cn(
                                              "w-full justify-start text-right font-normal",
                                              !updateSheetDateRange && "text-muted-foreground"
                                            )}
                                          >
                                            <CalendarIcon className="ml-2 h-4 w-4" />
                                            {updateSheetDateRange?.from ? (
                                              updateSheetDateRange.to && !isSameDay(updateSheetDateRange.from, updateSheetDateRange.to) ? (
                                                <>
                                                  {formatDate(updateSheetDateRange.from, "LLL dd, y", { locale: ar })} -{' '}
                                                  {formatDate(updateSheetDateRange.to, "LLL dd, y", { locale: ar })}
                                                </>
                                              ) : (
                                                formatDate(updateSheetDateRange.from, "LLL dd, y", { locale: ar })
                                              )
                                            ) : (
                                              <span>اختر تاريخ</span>
                                            )}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={updateSheetDateRange?.from}
                                            selected={updateSheetDateRange}
                                            onSelect={setUpdateSheetDateRange}
                                            numberOfMonths={2}
                                            locale={ar}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                 </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">فلترة حسب الحالة</label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between">
                                                <span>
                                                    {companyUpdateStatuses.length === 0
                                                        ? "اختر الحالة..."
                                                        : companyUpdateStatuses.length === 1
                                                        ? enabledStatuses.find(s => s.id === companyUpdateStatuses[0])?.label
                                                        : `الحالة (${companyUpdateStatuses.length})`}
                                                </span>
                                                <ChevronDown className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56">
                                            {enabledStatuses.map(status => (
                                                <DropdownMenuCheckboxItem
                                                    key={status.id}
                                                    checked={companyUpdateStatuses.includes(status.id)}
                                                    onCheckedChange={(checked) => {
                                                        setCompanyUpdateStatuses(prev => 
                                                            checked ? [...prev, status.id] : prev.filter(s => s !== status.id)
                                                        );
                                                    }}
                                                >
                                                    {status.label}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <Button onClick={() => handleExportCompanyReport('update')} disabled={!selectedCompanyForUpdateId}>
                                    <FileUp className="me-2 h-4 w-4" />
                                    إنشاء شيت أبديت
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">شيت مرتجعات الشركات</h2>
                <p className="text-muted-foreground">
                    اختر شركة لتصدير شيت بجميع المرتجعات التي في طريقها للعودة إلى الشركة.
                </p>
                <div className="mt-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <div className="md:col-span-3">
                                    <label className="text-sm font-medium mb-2 block">اختر الشركة</label>
                                    <Select dir="rtl" onValueChange={setSelectedCompanyForReturnsId} value={selectedCompanyForReturnsId || ''}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر شركة..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div>
                                     <label className="text-sm font-medium mb-2 block">فلترة حسب التاريخ</label>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant={"outline"}
                                            className={cn(
                                              "w-full justify-start text-right font-normal",
                                              !returnsSheetDateRange && "text-muted-foreground"
                                            )}
                                          >
                                            <CalendarIcon className="ml-2 h-4 w-4" />
                                            {returnsSheetDateRange?.from ? (
                                              returnsSheetDateRange.to && !isSameDay(returnsSheetDateRange.from, returnsSheetDateRange.to) ? (
                                                <>
                                                  {formatDate(returnsSheetDateRange.from, "LLL dd, y", { locale: ar })} -{' '}
                                                  {formatDate(returnsSheetDateRange.to, "LLL dd, y", { locale: ar })}
                                                </>
                                              ) : (
                                                formatDate(returnsSheetDateRange.from, "LLL dd, y", { locale: ar })
                                              )
                                            ) : (
                                              <span>اختر تاريخ</span>
                                            )}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={returnsSheetDateRange?.from}
                                            selected={returnsSheetDateRange}
                                            onSelect={setReturnsSheetDateRange}
                                            numberOfMonths={2}
                                            locale={ar}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                 </div>
                                <Button onClick={handleExportCompanyReturns} disabled={!selectedCompanyForReturnsId}>
                                    <FileUp className="me-2 h-4 w-4" />
                                    إنشاء شيت مرتجعات
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-2">تقارير المناديب المخصصة</h2>
                <p className="text-muted-foreground">
                    اختر مندوبًا و حالة الشحنات لاستخراج تقرير مفصل.
                </p>
                <div className="mt-4">
                     <Card>
                        <CardContent className="pt-6">
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
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
                                   <div>
                                     <label className="text-sm font-medium mb-2 block">فلترة حسب التاريخ</label>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant={"outline"}
                                            className={cn(
                                              "w-full justify-start text-right font-normal",
                                              !courierReportDateRange && "text-muted-foreground"
                                            )}
                                          >
                                            <CalendarIcon className="ml-2 h-4 w-4" />
                                            {courierReportDateRange?.from ? (
                                              courierReportDateRange.to && !isSameDay(courierReportDateRange.from, courierReportDateRange.to) ? (
                                                <>
                                                  {formatDate(courierReportDateRange.from, "LLL dd, y", { locale: ar })} -{' '}
                                                  {formatDate(courierReportDateRange.to, "LLL dd, y", { locale: ar })}
                                                </>
                                              ) : (
                                                formatDate(courierReportDateRange.from, "LLL dd, y", { locale: ar })
                                              )
                                            ) : (
                                              <span>اختر تاريخ</span>
                                            )}
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={courierReportDateRange?.from}
                                            selected={courierReportDateRange}
                                            onSelect={setCourierReportDateRange}
                                            numberOfMonths={2}
                                            locale={ar}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                 </div>
                                   <div>
                                     <label className="text-sm font-medium mb-2 block">فلترة حسب الحالة</label>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" className="w-full justify-between">
                                                <span>
                                                    {courierReportStatuses.length === 0
                                                        ? "اختر الحالة..."
                                                        : courierReportStatuses.length === 1
                                                        ? enabledStatuses.find(s => s.id === courierReportStatuses[0])?.label
                                                        : `الحالة (${courierReportStatuses.length})`}
                                                </span>
                                                <ChevronDown className="h-4 w-4 opacity-50" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56">
                                            {enabledStatuses.map(status => (
                                                <DropdownMenuCheckboxItem
                                                    key={status.id}
                                                    checked={courierReportStatuses.includes(status.id)}
                                                    onCheckedChange={(checked) => {
                                                        setCourierReportStatuses(prev => 
                                                            checked ? [...prev, status.id] : prev.filter(s => s !== status.id)
                                                        );
                                                    }}
                                                >
                                                    {status.label}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                 </div>
                                  <Button onClick={handleExportCourierReport} disabled={!selectedCourierId}>
                                      <FileUp className="me-2 h-4 w-4" />
                                      تصدير التقرير
                                  </Button>
                              </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
