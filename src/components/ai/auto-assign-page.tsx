
'use client';
import React, { useState } from 'react';
import type { Shipment, User, Governorate } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Bot, Loader2, Package, Truck, MapPin } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { suggestAssignments } from '@/ai/flows/assignment-flow';

interface AutoAssignPageProps {
  unassignedShipments: Shipment[];
  couriers: User[];
  governorates: Governorate[];
  isLoading: boolean;
}

const AutoAssignPage: React.FC<AutoAssignPageProps> = ({ unassignedShipments, couriers, governorates, isLoading }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const couriersWithStats = couriers.map(courier => {
      // In a real app, you'd calculate this from the main shipments list
      const activeShipments = 0; // Placeholder
      return { ...courier, activeShipments };
  });

  const handleSuggestAssignments = async () => {
    setIsProcessing(true);
    toast({
      title: "جاري تحليل البيانات...",
      description: "يقوم الذكاء الاصطناعي بتحليل الشحنات والمناديب لاقتراح أفضل توزيع.",
    });

    try {
        const result = await suggestAssignments({
            shipments: unassignedShipments,
            couriers: couriersWithStats,
        });
        console.log("Assignment suggestions:", result);
        toast({
            title: "تم إنشاء الاقتراحات بنجاح!",
            description: "الاقتراحات جاهزة للمراجعة والتنفيذ.",
        });
    } catch (error) {
        console.error("Error suggesting assignments:", error);
        toast({
            title: "حدث خطأ",
            description: "فشل في إنشاء اقتراحات التوزيع. يرجى المحاولة مرة أخرى.",
            variant: "destructive",
        });
    } finally {
        setIsProcessing(false);
    }
  };

  if (isLoading) {
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
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            <span>مساعد التعيين الذكي</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            استخدم الذكاء الاصطناعي لتحليل الشحنات غير المعينة واقتراح أفضل مندوب لكل شحنة بناءً على عبء العمل والموقع الجغرافي.
          </p>
        </div>
        <Button onClick={handleSuggestAssignments} disabled={isProcessing || unassignedShipments.length === 0}>
          {isProcessing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Bot className="me-2 h-4 w-4" />}
          {isProcessing ? 'جاري المعالجة...' : 'اقتراح التوزيع'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Package className="w-6 h-6 text-primary"/>
                <span>الشحنات غير المعينة ({unassignedShipments.length})</span>
            </CardTitle>
            <CardDescription>هذه الشحنات جاهزة للتوزيع على المناديب.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
                {unassignedShipments.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        لا توجد شحنات غير معينة حاليًا.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {unassignedShipments.map(shipment => (
                            <div key={shipment.id} className="p-3 border rounded-lg bg-muted/20">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">{shipment.recipientName}</p>
                                    <Badge variant="secondary">{governorates.find(g => g.id === shipment.governorateId)?.name || 'غير محدد'}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{shipment.address}</p>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Truck className="w-6 h-6 text-primary"/>
                <span>المناديب المتاحون ({couriersWithStats.length})</span>
            </CardTitle>
             <CardDescription>قائمة بالمناديب وعبء العمل الحالي لديهم.</CardDescription>
          </CardHeader>
          <CardContent>
             <ScrollArea className="h-96">
                 {couriersWithStats.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        لا يوجد مناديب متاحون.
                    </div>
                ) : (
                     <div className="space-y-3">
                        {couriersWithStats.map(courier => (
                            <div key={courier.id} className="p-3 border rounded-lg bg-muted/20">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">{courier.name}</p>
                                    <Badge variant="outline">نشط: {courier.activeShipments}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                    <MapPin className="w-3 h-3"/>
                                    <span>يعمل بشكل أساسي في: [سيتم تحديده لاحقًا]</span>
                                </p>
                            </div>
                        ))}
                    </div>
                )}
             </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AutoAssignPage;
