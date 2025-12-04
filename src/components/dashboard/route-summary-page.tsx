
'use client';
import React, { useMemo } from 'react';
import type { Shipment, Governorate } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Loader2, Map } from 'lucide-react';
import { Button } from '../ui/button';

interface RouteSummaryPageProps {
  shipments: Shipment[];
  governorates: Governorate[];
  isLoading: boolean;
}

interface RouteGroup {
  governorateId: string;
  governorateName: string;
  totalCount: number;
  deliveredCount: number;
  completionPercentage: number;
  addresses: string[];
}

export function RouteSummaryPage({ shipments, governorates, isLoading }: RouteSummaryPageProps) {

  const routeSummary = useMemo((): RouteGroup[] => {
    if (!shipments || !governorates) return [];

    const groups: { [key: string]: { totalCount: number; deliveredCount: number; addresses: Set<string> } } = {};

    for (const shipment of shipments) {
      const govId = shipment.governorateId || 'unknown';

      if (!groups[govId]) {
        groups[govId] = { totalCount: 0, deliveredCount: 0, addresses: new Set() };
      }

      groups[govId].totalCount++;
      if (shipment.status === 'Delivered' || shipment.status === 'Partially Delivered' || shipment.status === 'Refused (Paid)') {
        groups[govId].deliveredCount++;
      }
      groups[govId].addresses.add(shipment.address);
    }
    
    const result = Object.entries(groups).map(([govId, data]) => {
      const governorate = governorates.find(g => g.id === govId);
      return {
        governorateId: govId,
        governorateName: governorate?.name || 'منطقة غير محددة',
        totalCount: data.totalCount,
        deliveredCount: data.deliveredCount,
        completionPercentage: data.totalCount > 0 ? (data.deliveredCount / data.totalCount) * 100 : 0,
        addresses: Array.from(data.addresses),
      };
    });

    // Sort by total count descending
    return result.sort((a, b) => b.totalCount - a.totalCount);

  }, [shipments, governorates]);

  const handleOpenMap = (group: RouteGroup) => {
    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    // For simplicity, we'll just use the addresses as waypoints.
    // Google Maps API can handle address strings.
    const waypoints = group.addresses.map(addr => encodeURIComponent(`${addr}, ${group.governorateName}`)).join('|');
    const destination = encodeURIComponent(`${group.addresses[group.addresses.length - 1]}, ${group.governorateName}`);

    const mapsUrl = `${baseUrl}&destination=${destination}&waypoints=${waypoints}`;
    window.open(mapsUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (routeSummary.length === 0) {
      return (
        <div className="p-4 sm:p-6 md:p-8 text-center text-muted-foreground">
            <h1 className="text-2xl font-bold mb-4">موجز الخط السير</h1>
            <p>لا توجد شحنات نشطة لديك اليوم.</p>
        </div>
      )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h1 className="text-2xl font-bold mb-2">موجز خط السير</h1>
      <p className="text-muted-foreground mb-6">
        ملخص يومي للمناطق والعناوين المطلوبة، مرتبة حسب عدد الشحنات.
      </p>

      <div className="space-y-4">
        {routeSummary.map(group => (
          <Card key={group.governorateId}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span className="flex items-center gap-2">
                  {group.governorateName} ({group.totalCount} شحنات)
                  {group.totalCount > 10 && (
                      <span title="ضغط عالي" className="text-destructive">⚠️</span>
                  )}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleOpenMap(group)}>
                   <Map className="me-2 h-4 w-4" />
                   عرض خط السير على الخريطة
                </Button>
              </CardTitle>
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-muted-foreground">نسبة الإنجاز</span>
                    <span className="text-sm font-bold text-primary">{Math.round(group.completionPercentage)}%</span>
                </div>
                <Progress value={group.completionPercentage} />
                 <p className="text-xs text-muted-foreground mt-1">
                    تم تسليم {group.deliveredCount} من أصل {group.totalCount}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="addresses">
                  <AccordionTrigger>العناوين التفصيلية ({group.addresses.length})</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pe-6 space-y-1 text-sm text-muted-foreground">
                      {group.addresses.map((address, index) => (
                        <li key={index}>{address}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
