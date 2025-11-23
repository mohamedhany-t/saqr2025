
'use client';
import React, { useState } from 'react';
import type { Shipment, User, Governorate } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Bot, Loader2, Package, Truck, MapPin, Sparkles, Wand, ArrowLeft, Send } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { suggestAssignments, type AssignmentOutput } from '@/ai/flows/assignment-flow';
import { useFirestore } from '@/firebase';
import { writeBatch, doc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sendPushNotification } from '@/lib/actions';

interface AutoAssignPageProps {
  shipments: Shipment[]; // Pass all shipments to calculate active count
  unassignedShipments: Shipment[];
  couriers: User[];
  governorates: Governorate[];
  isLoading: boolean;
}

const AutoAssignPage: React.FC<AutoAssignPageProps> = ({ shipments, unassignedShipments, couriers, governorates, isLoading }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [suggestions, setSuggestions] = useState<AssignmentOutput['assignments'] | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const couriersWithStats = couriers.map(courier => {
      // Calculate the number of active shipments for each courier from the main list
      const activeShipments = shipments.filter(s => s.assignedCourierId === courier.id && !s.isArchived).length;
      return { ...courier, activeShipments };
  });

  const handleSuggestAssignments = async () => {
    setIsProcessing(true);
    setSuggestions(null);
    toast({
      title: "جاري تحليل البيانات...",
      description: "يقوم الذكاء الاصطناعي بتحليل الشحنات والمناديب لاقتراح أفضل توزيع.",
    });

    try {
        const result = await suggestAssignments({
            shipments: unassignedShipments,
            couriers: couriersWithStats,
        });
        
        if (!result || result.assignments.length === 0) {
            toast({
                title: "لم يتم العثور على اقتراحات",
                description: "لم يتمكن الذكاء الاصطناعي من إنشاء اقتراحات. قد لا يكون هناك عدد كافٍ من الشحنات أو المناديب.",
                variant: "destructive",
            });
        } else {
             setSuggestions(result.assignments);
            toast({
                title: "تم إنشاء الاقتراحات بنجاح!",
                description: "الاقتراحات جاهزة للمراجعة والتنفيذ.",
            });
        }
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
  
   const handleExecuteAssignments = async () => {
    if (!suggestions || !firestore) return;

    setIsAssigning(true);
    toast({ title: "جاري تنفيذ التعيينات..." });

    const batch = writeBatch(firestore);
    const notificationsToSend: { [courierId: string]: number } = {};

    suggestions.forEach(suggestion => {
        const shipmentRef = doc(firestore, 'shipments', suggestion.shipmentId);
        batch.update(shipmentRef, { assignedCourierId: suggestion.courierId });

        if (notificationsToSend[suggestion.courierId]) {
            notificationsToSend[suggestion.courierId]++;
        } else {
            notificationsToSend[suggestion.courierId] = 1;
        }
    });

    try {
        await batch.commit();

        // Send notifications
        const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
        for (const [courierId, count] of Object.entries(notificationsToSend)) {
            await sendPushNotification({
                recipientId: courierId,
                title: 'شحنات جديدة',
                body: `تم تعيين ${count} شحنة جديدة لك.`,
                url: notificationUrl,
            });
        }

        toast({
            title: "تم تعيين الشحنات بنجاح!",
            description: `تم تحديث ${suggestions.length} شحنة وإرسال الإشعارات للمناديب.`,
        });
        setSuggestions(null); // Clear suggestions after execution
    } catch (error) {
        console.error("Error executing assignments:", error);
        toast({
            title: "خطأ في تنفيذ التعيينات",
            description: "فشل تحديث الشحنات. يرجى التحقق من صلاحياتك والمحاولة مرة أخرى.",
            variant: "destructive",
        });
    } finally {
        setIsAssigning(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if(suggestions) {
    return (
        <div className="p-4 sm:p-6 md:p-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Sparkles className="w-8 h-8 text-primary" />
                        <span>الاقتراحات الذكية</span>
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        راجع الاقتراحات التي قدمها الذكاء الاصطناعي. يمكنك تنفيذها كلها بضغطة زر.
                    </p>
                </div>
                <div className="flex gap-2">
                     <Button variant="outline" onClick={() => setSuggestions(null)}>
                        <ArrowLeft className="me-2 h-4 w-4" />
                        العودة
                    </Button>
                    <Button onClick={handleExecuteAssignments} disabled={isAssigning}>
                        {isAssigning ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                        {isAssigning ? 'جاري التنفيذ...' : 'تنفيذ التعيينات'}
                    </Button>
                </div>
             </div>
             <Card>
                <CardHeader>
                    <CardTitle>جدول التوزيع المقترح</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الشحنة (المرسل إليه)</TableHead>
                                <TableHead>المحافظة</TableHead>
                                <TableHead>المندوب المقترح</TableHead>
                                <TableHead>سبب الاختيار</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suggestions.map(s => {
                                const shipment = unassignedShipments.find(ship => ship.id === s.shipmentId);
                                const courier = couriers.find(c => c.id === s.courierId);
                                if (!shipment || !courier) return null;
                                return (
                                    <TableRow key={s.shipmentId}>
                                        <TableCell className="font-medium">{shipment.recipientName}</TableCell>
                                        <TableCell>{governorates.find(g => g.id === shipment.governorateId)?.name || 'N/A'}</TableCell>
                                        <TableCell>{courier.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{s.reasoning}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        </div>
    )
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
          {isProcessing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Wand className="me-2 h-4 w-4" />}
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
                                    <Badge variant="outline">شحنات نشطة: {courier.activeShipments}</Badge>
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
