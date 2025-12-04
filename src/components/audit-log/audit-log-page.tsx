
'use client';

import React, { useState, useMemo } from 'react';
import type { Shipment, ShipmentHistory, User } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { Loader2, Filter } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { useRouter } from 'next/navigation';
import { statusText, statusIcons } from '../dashboard/shipments-table';

interface ExtendedShipmentHistory extends ShipmentHistory {
  shipmentId: string;
}

interface AuditLogPageProps {
  users: User[];
  shipments: Shipment[];
  isLoading: boolean;
}

export function AuditLogPage({ users, shipments, isLoading }: AuditLogPageProps) {
  const firestore = useFirestore();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const router = useRouter();

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

  const { data: history, isLoading: historyLoading } = useCollection<ExtendedShipmentHistory>(historyQuery);

  const enrichedHistory = useMemo(() => {
    if (!history || !shipments) return [];
    return history.map(log => {
      const shipmentId = log.id.split('/history/')[0];
      const shipment = shipments.find(s => s.id === shipmentId);
      return {
        ...log,
        shipmentId,
        shipment: shipment
      };
    });
  }, [history, shipments]);

  const handleShipmentClick = (shipmentId: string) => {
    const url = `/?edit=${shipmentId}`;
    router.push(url);
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedHistory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  لا توجد سجلات تطابق الفلاتر المحددة.
                </TableCell>
              </TableRow>
            ) : (
              enrichedHistory.map(log => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.shipment ? (
                      <Button variant="link" className="p-0 h-auto" onClick={() => handleShipmentClick(log.shipmentId)}>
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
                  <TableCell>{format(log.updatedAt.toDate(), 'PPpp', { locale: ar })}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
