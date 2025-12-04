
'use client';
import React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { ShipmentHistory } from '@/lib/types';
import { statusIcons, statusText } from '../dashboard/shipments-table';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { formatToCairoTime } from '@/lib/utils';

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
      <div className="flex justify-center items-center h-48 text-muted-foreground">
        لا يوجد سجل تتبع لهذه الشحنة.
      </div>
    );
  }

  return (
    <ScrollArea className="h-96">
      <div className="relative pe-4">
        {/* The timeline bar */}
        <div className="absolute top-0 right-4 h-full w-0.5 bg-border -z-10"></div>
        
        <div className="space-y-8">
          {history.map((entry) => (
            <div key={entry.id} className="relative flex items-start gap-4">
              <div className="bg-background flex-shrink-0 flex items-center justify-center">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {statusIcons[entry.status]}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {statusText[entry.status] || entry.status}
                </p>
                <p className="text-sm text-muted-foreground">
                  بواسطة: {entry.updatedBy}
                </p>
                {entry.reason && (
                    <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded-md">
                        السبب: {entry.reason}
                    </p>
                )}
                <time className="text-xs text-muted-foreground/80 mt-1 block">
                    {formatToCairoTime(entry.updatedAt?.toDate())} ({formatDistanceToNow(entry.updatedAt.toDate(), { addSuffix: true, locale: ar })})
                </time>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
