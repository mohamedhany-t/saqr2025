
'use client';
import React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { ShipmentHistory, ShipmentHistoryEntry } from '@/lib/types';
import { statusIcons, statusText } from '../dashboard/shipments-table';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { History, Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { formatToCairoTime } from '@/lib/utils';
import { DetailedHistoryCard } from '../audit-log/detailed-history-card';
import { Card, CardContent } from '../ui/card';

interface ShipmentHistoryTimelineProps {
  shipmentId: string;
}

export function ShipmentHistoryTimeline({ shipmentId }: ShipmentHistoryTimelineProps) {
  const firestore = useFirestore();

  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !shipmentId) return null;
    return query(
      collection(firestore, 'shipments', shipmentId, 'history'),
      orderBy('updatedAt', 'desc')
    );
  }, [firestore, shipmentId]);

  const { data: history, isLoading } = useCollection<ShipmentHistory>(historyQuery);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
        <History className="h-10 w-10 mb-2"/>
        <p>لا يوجد سجل تتبع لهذه الشحنة.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-96">
      <div className="space-y-4">
        {history.map((entry) => (
          <DetailedHistoryCard 
            key={entry.id}
            historyEntry={entry}
            shipment={null} // We don't need full shipment object here
          />
        ))}
      </div>
    </ScrollArea>
  );
}
