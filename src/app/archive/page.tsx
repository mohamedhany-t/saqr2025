
"use client";
import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp, or, writeBatch, doc, and } from 'firebase/firestore';
import type { Shipment, Company, User, Governorate, ShipmentStatusConfig } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileUp, CalendarIcon, Search, History, ArchiveRestore } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatToCairoTime, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
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
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [searchTerm, setSearchTerm] = useState('');
    const [detailsShipment, setDetailsShipment] = useState<Shipment | null>(null);

    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]));
    const { data: users, isLoading: usersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]));
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]));
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]));

    const couriers = useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);

    const shipmentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;

        const filters: any[] = [];
        
        if (selectedId) {
            // If a specific entity is selected, filter by its ID and its specific archive flag
            if (entityType === 'courier') {
                filters.push(where('assignedCourierId', '==', selectedId));
                filters.push(where('isArchivedForCourier', '==', true));
            } else { // company
                filters.push(where('companyId', '==', selectedId));
                filters.push(where('isArchivedForCompany', '==', true));
            }
        } else {
            // If no specific entity is selected, get all archived shipments
            filters.push(or(
                where('isArchivedForCourier', '==', true),
                where('isArchivedForCompany', '==', true)
            ));
        }
        
        // Combine all filters with 'and'
        return query(collection(firestore, 'shipments'), and(...filters));

    }, [firestore, selectedId, entityType]);

    const { data: archivedShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);
    
    const filteredArchivedShipments = useMemo(() => {
        if (!archivedShipments) return [];
        
        let clientFiltered = archivedShipments;

        // Apply date range filter on the client side
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

        if (!searchTerm) return clientFiltered;
        
        const lowercasedTerm = searchTerm.toLowerCase();
        return clientFiltered.filter(shipment =>
            shipment.shipmentCode?.toLowerCase().includes(lowercasedTerm) ||
            shipment.recipientName?.toLowerCase().includes(lowercasedTerm) ||
            shipment.recipientPhone?.toLowerCase().includes(lowercasedTerm) ||
            shipment.address?.toLowerCase().includes(lowercasedTerm)
        );
    }, [archivedShipments, searchTerm, dateRange]);

    const isLoading = companiesLoading || usersLoading || governoratesLoading || shipmentsLoading || statusesLoading;

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
                <h1 className="text-3xl font-bold font-headline mb-2">الأرشيف</h1>
                <p className="text-muted-foreground mb-6">
                    استعرض الشحنات المؤرشفة للشركات والمناديب مع تفاصيل تواريخ الأرشفة.
                </p>

                <Card>
                    <CardHeader>
                        <CardTitle>فلترة الأرشيف</CardTitle>
                        <CardDescription>
                            اختر نوع الكيان والاسم ونطاق التاريخ لعرض البيانات المؤرشفة.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <RadioGroup defaultValue="company" value={entityType} onValueChange={(value: "courier" | "company") => { setEntityType(value); setSelectedId(null); }} className="flex gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="company" id="r-company" /><Label htmlFor="r-company">شركة</Label></div>
                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="courier" id="r-courier" /><Label htmlFor="r-courier">مندوب</Label></div>
                        </RadioGroup>

                        <Select dir="rtl" onValueChange={(value) => setSelectedId(value === "all" ? null : value)} value={selectedId || 'all'}>
                            <SelectTrigger><SelectValue placeholder={`اختر ${entityType === 'courier' ? 'مندوبًا' : 'شركة'}...`} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                {entityType === 'courier' 
                                    ? couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) 
                                    : companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button id="date" variant={"outline"} className={cn("w-full justify-start text-right font-normal", !dateRange && "text-muted-foreground")}>
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y", { locale: ar })} - {format(dateRange.to, "LLL dd, y", { locale: ar })}</>) : format(dateRange.from, "LLL dd, y", { locale: ar })) : (<span>اختر فترة</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ar}/>
                            </PopoverContent>
                        </Popover>

                        <Button variant="outline" onClick={handleExport} disabled={!filteredArchivedShipments || filteredArchivedShipments.length === 0}>
                            <FileUp className="me-2 h-4 w-4" />
                            تصدير إلى Excel
                        </Button>
                    </CardContent>
                </Card>

                <div className="mt-8">
                    {isLoading ? (
                         <div className="flex h-64 w-full items-center justify-center">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : filteredArchivedShipments.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground bg-muted/30 rounded-lg">
                             <h3 className="text-2xl font-bold">الأرشيف فارغ</h3>
                             <p>لا توجد شحنات مؤرشفة تطابق الفلاتر المحددة.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[60vh] rounded-md border">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead>كود الشحنة</TableHead>
                                        <TableHead>تاريخ الأرشفة</TableHead>
                                        <TableHead>المبلغ المدفوع</TableHead>
                                        <TableHead>المندوب</TableHead>
                                        <TableHead>الشركة</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredArchivedShipments.map(shipment => {
                                        const archiveDate = entityType === 'courier' ? shipment.courierArchivedAt : shipment.companyArchivedAt;
                                        return (
                                            <TableRow key={shipment.id}>
                                                <TableCell className="font-mono">{shipment.shipmentCode}</TableCell>
                                                <TableCell className="text-xs">{formatToCairoTime(archiveDate)}</TableCell>
                                                <TableCell>{(shipment.paidAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                                <TableCell>{users?.find(u => u.id === shipment.assignedCourierId)?.name}</TableCell>
                                                <TableCell>{companies?.find(c => c.id === shipment.companyId)?.name}</TableCell>
                                                <TableCell>{statuses?.find(s => s.id === shipment.status)?.label || shipment.status}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => setDetailsShipment(shipment)}>
                                                        <History className="h-4 w-4 text-blue-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleUnarchive(shipment)} disabled={!selectedId}>
                                                        <ArchiveRestore className="h-4 w-4 text-green-500" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </ScrollArea>
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
