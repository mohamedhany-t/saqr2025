
"use client";
import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp, or, writeBatch, doc, and, orderBy, limit } from 'firebase/firestore';
import type { Shipment, Company, User, Governorate, ShipmentStatusConfig } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileUp, CalendarIcon, Search, History, ArchiveRestore, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatToCairoTime, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { exportToExcel } from '@/lib/export';
import { Header } from '@/components/dashboard/header';
import { Input } from '@/components/ui/input';
import { ShipmentDetailsDialog } from '@/components/shipments/shipment-details-dialog';
import { useToast } from '@/hooks/use-toast';

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    if (date instanceof Date) return date;
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime()) ? parsedDate : null;
};

const ArchivePage = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [entityType, setEntityType] = useState<'courier' | 'company'>('company');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 120),
        to: new Date()
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [detailsShipment, setDetailsShipment] = useState<Shipment | null>(null);

    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]));
    const { data: users, isLoading: usersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]));
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]));

    const couriers = useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);

    // Simplified query to avoid index errors and permission issues with complex range filters
    const shipmentsQuery = useMemoFirebase(() => {
        if (!firestore || !selectedId) return null;

        const filters: any[] = [];
        
        if (entityType === 'courier') {
            filters.push(where('assignedCourierId', '==', selectedId));
            filters.push(where('isArchivedForCourier', '==', true));
        } else { // company
            filters.push(where('companyId', '==', selectedId));
            filters.push(where('isArchivedForCompany', '==', true));
        }
        
        // Removed range filter (createdAt >= ...) and orderBy from server-side query
        // to ensure it works without complex composite indexes
        return query(
            collection(firestore, 'shipments'), 
            and(...filters),
            limit(1500) // Increased limit but kept simple filters
        );

    }, [firestore, selectedId, entityType]);

    const { data: archivedShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);
    
    const filteredArchivedShipments = useMemo(() => {
        if (!archivedShipments) return [];
        
        let clientFiltered = archivedShipments;

        // Apply date range filter on CLIENT side for maximum compatibility and performance
        if (dateRange?.from) {
            const fromDate = startOfDay(dateRange.from);
            clientFiltered = clientFiltered.filter(s => {
                const shipmentDate = getSafeDate(s.createdAt);
                return shipmentDate ? shipmentDate >= fromDate : false;
            });
        }
        
        if (dateRange?.to) {
            const toDate = endOfDay(dateRange.to);
            clientFiltered = clientFiltered.filter(s => {
                const shipmentDate = getSafeDate(s.createdAt);
                return shipmentDate ? shipmentDate <= toDate : false;
            });
        }

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            clientFiltered = clientFiltered.filter(shipment =>
                shipment.shipmentCode?.toLowerCase().includes(lowercasedTerm) ||
                shipment.recipientName?.toLowerCase().includes(lowercasedTerm) ||
                shipment.recipientPhone?.toLowerCase().includes(lowercasedTerm) ||
                shipment.address?.toLowerCase().includes(lowercasedTerm) ||
                shipment.orderNumber?.toLowerCase().includes(lowercasedTerm)
            );
        }

        // Sort by date on client side
        return clientFiltered.sort((a, b) => {
            const dateA = getSafeDate(a.createdAt)?.getTime() || 0;
            const dateB = getSafeDate(b.createdAt)?.getTime() || 0;
            return dateB - dateA;
        });
    }, [archivedShipments, searchTerm, dateRange]);

    const isLoading = companiesLoading || usersLoading || governoratesLoading || (selectedId && shipmentsLoading) || statusesLoading;

    const handleExport = () => {
        if (!filteredArchivedShipments || filteredArchivedShipments.length === 0) {
            return;
        }
        const entityName = entityType === 'courier' 
            ? couriers.find(c => c.id === selectedId)?.name 
            : companies?.find(c => c.id === selectedId)?.name;

        const reportHeader = {
            title: `تقرير أرشيف: ${entityName || 'الكل'}`,
            date: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`
        };

        const columns = [
            { accessorKey: "orderNumber", header: "رقم الطلب" },
            { accessorKey: "shipmentCode", header: "رقم الشحنة" },
            { accessorKey: "createdAt", header: "تاريخ الإنشاء" },
            { accessorKey: "deliveredToCourierAt", header: "تاريخ تسليم المندوب" },
            { accessorKey: "courierArchivedAt", header: "تاريخ أرشفة المندوب" },
            { accessorKey: "companyArchivedAt", header: "تاريخ أرشفة الشركة" },
            { accessorKey: "companyId", header: "الشركة" },
            { accessorKey: "assignedCourierId", header: "المندوب" },
            { accessorKey: "recipientName", header: "المرسل اليه" },
            { accessorKey: "recipientPhone", header: "هاتف المستلم" },
            { accessorKey: "governorateId", header: "المحافظة" },
            { accessorKey: "address", header: "العنوان" },
            { accessorKey: "status", header: "الحالة" },
            { accessorKey: "totalAmount", header: "الاجمالي" },
            { accessorKey: "paidAmount", header: "المدفوع" },
        ];
        
        exportToExcel(filteredArchivedShipments, columns, `archive_${entityName?.replace(/\s/g, '_') || 'all'}`, governorates || [], companies || [], users || [], reportHeader);
    };

    const handleUnarchive = async (shipment: Shipment) => {
        if (!firestore) return;
        const shipmentRef = doc(firestore, 'shipments', shipment.id);
        
        let fieldToUpdate: { [key: string]: any } = {};
        
        if (selectedId && entityType) {
            if (entityType === 'company') {
                fieldToUpdate['isArchivedForCompany'] = false;
                fieldToUpdate['companyArchivedAt'] = null;
            } else if (entityType === 'courier') {
                fieldToUpdate['isArchivedForCourier'] = false;
                fieldToUpdate['courierArchivedAt'] = null;
            }
        } else {
            fieldToUpdate = {
                isArchivedForCompany: false,
                isArchivedForCourier: false,
                companyArchivedAt: null,
                courierArchivedAt: null,
            };
        }
        
        try {
            await writeBatch(firestore).update(shipmentRef, fieldToUpdate).commit();
            toast({ title: 'تم إلغاء الأرشفة بنجاح' });
        } catch (error) {
            toast({ title: 'فشل إلغاء الأرشفة', variant: 'destructive' });
            console.error(error);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col">
            <Header onSearchChange={setSearchTerm} searchTerm={searchTerm} />
            <main className="flex-1 p-4 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold font-headline mb-1">الأرشيف</h1>
                        <p className="text-muted-foreground text-sm">
                            استعرض الشحنات المؤرشفة للشركات والمناديب.
                        </p>
                    </div>
                </div>

                <Card className="border-primary/10 shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Filter className="h-5 w-5 text-primary" />
                            تخصيص العرض
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>نوع البحث</Label>
                            <RadioGroup defaultValue="company" value={entityType} onValueChange={(value: "courier" | "company") => { setEntityType(value); setSelectedId(null); }} className="flex gap-4 p-2 border rounded-md bg-muted/30">
                                <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="company" id="r-company" /><Label htmlFor="r-company">شركة</Label></div>
                                <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="courier" id="r-courier" /><Label htmlFor="r-courier">مندوب</Label></div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-2">
                            <Label>الاسم</Label>
                            <Select dir="rtl" onValueChange={(value) => setSelectedId(value === "none" ? null : value)} value={selectedId || 'none'}>
                                <SelectTrigger className="w-full"><SelectValue placeholder={`اختر ${entityType === 'courier' ? 'مندوبًا' : 'شركة'}...`} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">اختر من القائمة...</SelectItem>
                                    {entityType === 'courier' 
                                        ? couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) 
                                        : companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>نطاق التاريخ</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button id="date" variant={"outline"} className={cn("w-full justify-start text-right font-normal h-10", !dateRange && "text-muted-foreground")}>
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ar })} - {format(dateRange.to, "LLL dd, y", { locale: ar })}</>) : format(dateRange.from, "LLL dd, y", { locale: ar })) : (<span>اختر فترة</span>)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ar}/>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <Button variant="outline" onClick={handleExport} disabled={!filteredArchivedShipments || filteredArchivedShipments.length === 0} className="h-10">
                            <FileUp className="me-2 h-4 w-4" />
                            تصدير للتميز
                        </Button>
                    </CardContent>
                </Card>

                <div className="mt-8">
                    {!selectedId ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-muted/20 border-2 border-dashed rounded-xl text-center px-4">
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                                <Search className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-bold">بانتظار اختيار {entityType === 'courier' ? 'مندوب' : 'شركة'}</h3>
                            <p className="text-muted-foreground mt-2 max-w-md">يرجى اختيار {entityType === 'courier' ? 'مندوب' : 'شركة'} من القائمة أعلاه لعرض البيانات المؤرشفة.</p>
                        </div>
                    ) : isLoading ? (
                         <div className="flex flex-col items-center justify-center py-24">
                            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground animate-pulse">جاري جلب بيانات الأرشيف...</p>
                        </div>
                    ) : filteredArchivedShipments.length === 0 ? (
                        <div className="text-center py-24 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed">
                             <h3 className="text-2xl font-bold mb-2">لا توجد نتائج</h3>
                             <p>لم يتم العثور على أي شحنات مؤرشفة لهذا {entityType === 'courier' ? 'المندوب' : 'الشركة'} في الفترة المحددة.</p>
                        </div>
                    ) : (
                        <Card className="overflow-hidden border-none shadow-md">
                            <div className="bg-primary/5 px-4 py-2 border-b flex justify-between items-center text-sm">
                                <span className="font-medium">عدد النتائج: {filteredArchivedShipments.length}</span>
                            </div>
                            <ScrollArea className="h-[65vh]">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-20">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[150px]">كود الشحنة</TableHead>
                                            <TableHead>تاريخ الأرشفة</TableHead>
                                            <TableHead>المبلغ المحصل</TableHead>
                                            <TableHead>الاسم</TableHead>
                                            <TableHead>الحالة</TableHead>
                                            <TableHead className="text-left w-[120px]">الإجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredArchivedShipments.map(shipment => {
                                            const archiveDate = entityType === 'courier' ? shipment.courierArchivedAt : shipment.companyArchivedAt;
                                            return (
                                                <TableRow key={shipment.id} className="hover:bg-muted/20 transition-colors">
                                                    <TableCell className="font-mono text-sm font-medium">{shipment.shipmentCode}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{formatToCairoTime(archiveDate)}</TableCell>
                                                    <TableCell className="font-bold text-green-700">{(shipment.paidAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                                    <TableCell className="text-sm">
                                                        <div className="flex flex-col">
                                                            <span>{shipment.recipientName}</span>
                                                            <span className="text-[10px] text-muted-foreground">{shipment.recipientPhone}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-xs px-2 py-1 rounded-full bg-slate-100 inline-block">
                                                            {statuses?.find(s => s.id === shipment.status)?.label || shipment.status}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" onClick={() => setDetailsShipment(shipment)}>
                                                                <History className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-50 hover:text-green-600" onClick={() => handleUnarchive(shipment)} title="إلغاء الأرشفة">
                                                                <ArchiveRestore className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </Card>
                    )}
                </div>
            </main>
            {detailsShipment && (
                <ShipmentDetailsDialog 
                    open={!!detailsShipment}
                    onOpenChange={(open) => !open && setDetailsShipment(null)}
                    shipment={detailsShipment}
                    company={companies?.find(c => c.id === detailsShipment.companyId)}
                    courier={users?.find(u => u.id === detailsShipment.assignedCourierId)}
                    governorate={governorates?.find(g => g.id === detailsShipment.governorateId)}
                />
            )}
        </div>
    );
};

export default ArchivePage;
