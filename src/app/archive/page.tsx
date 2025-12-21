
"use client";
import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import type { Shipment, Company, User, Governorate } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileUp, CalendarIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatToCairoTime, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { exportToExcel } from '@/lib/export';
import { Header } from '@/components/dashboard/header';

const ArchivePage = () => {
    const firestore = useFirestore();
    const [entityType, setEntityType] = useState<'courier' | 'company'>('courier');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]));
    const { data: users, isLoading: usersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]));

    const couriers = useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);

    const shipmentsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedId) return null;
        
        let q;
        if(entityType === 'courier') {
            q = query(collection(firestore, 'archived_courier_shipments'), where('assignedCourierId', '==', selectedId));
        } else {
             q = query(collection(firestore, 'archived_company_shipments'), where('companyId', '==', selectedId));
        }
       
        if (dateRange?.from) {
            q = query(q, where('createdAt', '>=', Timestamp.fromDate(dateRange.from)));
        }
        if (dateRange?.to) {
            const toDate = new Date(dateRange.to);
            toDate.setHours(23, 59, 59, 999);
            q = query(q, where('createdAt', '<=', Timestamp.fromDate(toDate)));
        }
        return q;
    }, [firestore, selectedId, entityType, dateRange]);

    const { data: archivedShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

    const isLoading = companiesLoading || usersLoading || governoratesLoading || (selectedId && shipmentsLoading);

    const handleExport = () => {
        if (!archivedShipments || archivedShipments.length === 0) {
            return;
        }
        const entityName = entityType === 'courier' 
            ? couriers.find(c => c.id === selectedId)?.name 
            : companies?.find(c => c.id === selectedId)?.name;

        const reportHeader = {
            title: `تقرير أرشيف: ${entityName}`,
            date: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`
        };

        const columns = [
            { accessorKey: "orderNumber", header: "رقم الطلب" },
            { accessorKey: "shipmentCode", header: "رقم الشحنة" },
            { accessorKey: "createdAt", header: "التاريخ" },
            { accessorKey: "recipientName", header: "المرسل اليه" },
            { accessorKey: "recipientPhone", header: "هاتف المستلم" },
            { accessorKey: "governorateId", header: "المحافظة" },
            { accessorKey: "address", header: "العنوان" },
            { accessorKey: "status", header: "الحالة" },
            { accessorKey: "totalAmount", header: "الاجمالي" },
            { accessorKey: "paidAmount", header: "المدفوع" },
        ];
        
        exportToExcel(archivedShipments, columns, `archive_${entityName?.replace(/\s/g, '_')}`, governorates || [], companies || [], users || [], reportHeader);
    };

    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header onSearchChange={() => {}} searchTerm="" />
            <main className="flex-1 p-4 md:p-8">
                <h1 className="text-3xl font-bold font-headline mb-2">الأرشيف</h1>
                <p className="text-muted-foreground mb-6">
                    استعرض الشحنات المؤرشفة للشركات والمناديب مع إمكانية التصدير.
                </p>

                <Card>
                    <CardHeader>
                        <CardTitle>فلترة الأرشيف</CardTitle>
                        <CardDescription>
                            اختر نوع الكيان والاسم ونطاق التاريخ لعرض البيانات المؤرشفة.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <RadioGroup defaultValue="courier" value={entityType} onValueChange={(value: "courier" | "company") => { setEntityType(value); setSelectedId(null); }} className="flex gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="courier" id="r-courier" /><Label htmlFor="r-courier">مندوب</Label></div>
                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="company" id="r-company" /><Label htmlFor="r-company">شركة</Label></div>
                        </RadioGroup>

                        <Select dir="rtl" onValueChange={setSelectedId} value={selectedId || ''}>
                            <SelectTrigger><SelectValue placeholder={`اختر ${entityType === 'courier' ? 'مندوبًا' : 'شركة'}...`} /></SelectTrigger>
                            <SelectContent>
                                {entityType === 'courier' 
                                    ? couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) 
                                    : companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("w-full justify-start text-right font-normal", !dateRange && "text-muted-foreground")}>
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ar })} - {format(dateRange.to, "LLL dd, y", { locale: ar })}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>اختر تاريخ</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ar} />
                            </PopoverContent>
                        </Popover>
                         <Button onClick={handleExport} disabled={!archivedShipments || archivedShipments.length === 0}>
                            <FileUp className="me-2 h-4 w-4" />
                            تصدير إلى Excel
                        </Button>
                    </CardContent>
                </Card>

                <Card className="mt-8">
                    <CardHeader>
                        <CardTitle>الشحنات المؤرشفة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[50vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>كود الشحنة</TableHead>
                                        <TableHead>العميل</TableHead>
                                        <TableHead>العنوان</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>المبلغ</TableHead>
                                        <TableHead>تاريخ الإنشاء</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></TableCell></TableRow>
                                    ) : !selectedId ? (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center">الرجاء اختيار كيان لعرض أرشيفه.</TableCell></TableRow>
                                    ) : archivedShipments?.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد شحنات مؤرشفة تطابق الفلاتر.</TableCell></TableRow>
                                    ) : (
                                        archivedShipments?.map(shipment => (
                                            <TableRow key={shipment.id}>
                                                <TableCell className="font-mono">{shipment.shipmentCode}</TableCell>
                                                <TableCell>{shipment.recipientName}</TableCell>
                                                <TableCell className="max-w-xs truncate">{shipment.address}, {governorates?.find(g => g.id === shipment.governorateId)?.name}</TableCell>
                                                <TableCell>{shipment.status}</TableCell>
                                                <TableCell>{new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP" }).format(shipment.totalAmount)}</TableCell>
                                                <TableCell>{formatToCairoTime(shipment.createdAt)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default ArchivePage;
