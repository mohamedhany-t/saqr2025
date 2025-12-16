

'use client';

import React, { useState, useMemo } from 'react';
import type { Shipment, ShipmentHistory, User, Company, Governorate } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, WithIdAndRef } from '@/firebase';
import { collectionGroup, query, orderBy, where, Timestamp, getDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Loader2, Filter, Pencil, FileText, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatToCairoTime } from '@/lib/utils';
import { ar } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { statusText, statusIcons } from '../dashboard/shipments-table';
import { ShipmentDetailsDialog } from '../shipments/shipment-details-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';


interface ExtendedShipmentHistory extends WithIdAndRef<ShipmentHistory> {
  shipmentId: string;
}

interface AuditLogPageProps {
  users: User[];
  shipments: Shipment[];
  companies: Company[];
  governorates: Governorate[];
  isLoading: boolean;
}

export function AuditLogPage({ users, shipments, companies, governorates, isLoading }: AuditLogPageProps) {
  const firestore = useFirestore();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [detailsShipment, setDetailsShipment] = useState<Shipment | null>(null);
  const [historyToDelete, setHistoryToDelete] = useState<ExtendedShipmentHistory | null>(null);
  const { toast } = useToast();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const historyQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    let q = query(collectionGroup(firestore, 'history'), orderBy('updatedAt', 'desc'));
    
    if (selectedUserId) {
        q = query(q, where('userId', '==', selectedUserId));
    }
    if (dateRange?.from) {
        q = query(q, where('updatedAt', '>=', Timestamp.fromDate(dateRange.from)));
    }
    if (dateRange?.to) {
        // To include the whole day, we set the time to the end of the day.
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        q = query(q, where('updatedAt', '<=', Timestamp.fromDate(toDate)));
    }
    
    return q;
  }, [firestore, selectedUserId, dateRange]);

  const { data: history, isLoading: historyLoading } = useCollection<ShipmentHistory>(historyQuery);

  const enrichedHistory = useMemo(() => {
    if (!history || !shipments) return [];
    return history.map(log => {
      // The ref path is like 'shipments/shipmentId/history/historyId'
      const pathSegments = log.ref.path.split('/');
      const shipmentId = pathSegments.length > 1 ? pathSegments[1] : ''; 
      const shipment = shipments.find(s => s.id === shipmentId);
      return {
        ...log,
        shipmentId,
        shipment,
      };
    });
  }, [history, shipments]);

  const handleEditShipment = (shipmentId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('edit', shipmentId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleShowDetails = async (shipment: Shipment) => {
    setDetailsShipment(shipment);
  };

   const handleDeleteHistoryEntry = () => {
    if (!firestore || !historyToDelete) return;
    // The ref property is on the historyToDelete object from useCollection
    deleteDoc(historyToDelete.ref)
        .then(() => {
            toast({ title: `تم حذف سجل التغيير بنجاح` });
        })
        .catch((err) => {
             if (err instanceof Error && 'code' in err && err.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: historyToDelete.ref.path,
                    operation: 'delete'
                }));
             } else {
                toast({ title: 'خطأ', description: 'حدث خطأ أثناء حذف سجل التغيير', variant: 'destructive' });
             }
        })
        .finally(() => {
            setHistoryToDelete(null);
        });
  };

  const clearFilters = () => {
    setSelectedUserId(null);
    setDateRange(undefined);
  }

  const isFiltered = selectedUserId || dateRange;

  if (isLoading || historyLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">سجل التغييرات</h1>
          <p className="text-muted-foreground mt-2">
            عرض لجميع التغييرات التي حدثت على الشحنات في النظام.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline">
                        <Filter className="me-2 h-4 w-4" />
                        فلترة حسب التاريخ
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={ar}
                    />
                </PopoverContent>
            </Popover>
            <Select onValueChange={setSelectedUserId} value={selectedUserId || ''}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="فلترة حسب المستخدم" />
                </SelectTrigger>
                <SelectContent>
                    {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {isFiltered && <Button variant="ghost" onClick={clearFilters}>مسح الفلاتر</Button>}
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الشحنة (رقم الطلب)</TableHead>
              <TableHead>التغيير</TableHead>
              <TableHead>السبب/الملاحظات</TableHead>
              <TableHead>المستخدم</TableHead>
              <TableHead>الوقت</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  لا توجد سجلات تطابق الفلاتر المحددة.
                </TableCell>
              </TableRow>
            ) : (
              enrichedHistory.map(log => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.shipment ? (
                      <Button variant="link" className="p-0 h-auto" onClick={() => handleShowDetails(log.shipment!)}>
                        {log.shipment.orderNumber || log.shipment.trackingNumber}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">شحنة محذوفة</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="flex gap-2 items-center">
                       {statusIcons[log.status]}
                       <span>{statusText[log.status] || log.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{log.reason || '-'}</TableCell>
                  <TableCell>{log.updatedBy}</TableCell>
                  <TableCell>{log.updatedAt?.toDate ? formatToCairoTime(log.updatedAt.toDate()) : 'الآن...'}</TableCell>
                  <TableCell>
                    {log.shipment && (
                      <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleShowDetails(log.shipment!)}>
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">عرض التفاصيل</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditShipment(log.shipmentId)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">تعديل</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setHistoryToDelete(log)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">حذف</span>
                          </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {detailsShipment && (
        <ShipmentDetailsDialog 
            open={!!detailsShipment}
            onOpenChange={(open) => !open && setDetailsShipment(null)}
            shipment={detailsShipment}
            company={companies.find(c => c.id === detailsShipment.companyId)}
            courier={users.find(u => u.id === detailsShipment.assignedCourierId)}
            governorate={governorates.find(g => g.id === detailsShipment.governorateId)}
        />
      )}
       <AlertDialog open={!!historyToDelete} onOpenChange={(open) => !open && setHistoryToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من حذف هذا السجل؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف هذا الإدخال المحدد ({historyToDelete?.status ? statusText[historyToDelete.status] : ''}) من سجل تتبع الشحنة بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setHistoryToDelete(null)}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteHistoryEntry} className="bg-destructive hover:bg-destructive/90">حذف السجل</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
