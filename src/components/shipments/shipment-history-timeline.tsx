
'use client';
import React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { ShipmentHistory, Governorate, Company, User, ShipmentStatusConfig } from '@/lib/types';
import { Loader2, History } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { DetailedHistoryCard } from '../audit-log/detailed-history-card';

// 1. Define Props for the component
interface ShipmentHistoryTimelineProps {
  shipmentId: string;
}

// 2. Define the component function correctly
export function ShipmentHistoryTimeline({ shipmentId }: ShipmentHistoryTimelineProps) {
  const firestore = useFirestore();

  // 3. Correctly define the query for shipment history inside the component
  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !shipmentId) return null;
    return query(
      collection(firestore, 'shipments', shipmentId, 'history'),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, shipmentId]);

  const { data: history, isLoading: historyLoading } = useCollection<ShipmentHistory>(historyQuery);

  // Fetch needed data for labels translation
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? query(collection(firestore, 'governorates')) : null, [firestore]));
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]));
  const { data: couriers, isLoading: couriersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('role', '==', 'courier')) : null, [firestore]));
  const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]));

  // 4. Combine all loading states
  const isLoading = historyLoading || governoratesLoading || companiesLoading || couriersLoading || statusesLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
        <History className="h-12 w-12 mb-3 opacity-20"/>
        <p className="text-lg font-medium">لا يوجد سجل تتبع لهذه الشحنة حتى الآن.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-6 py-4">
        {history.map((entry) => (
          <DetailedHistoryCard 
            key={entry.id}
            historyEntry={entry}
            shipment={null}
            governorates={governorates || []}
            companies={companies || []}
            couriers={couriers || []}
            statuses={statuses || []}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
