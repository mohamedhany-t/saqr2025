
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, writeBatch, doc } from 'firebase/firestore';
import type { Shipment, ShipmentStatusConfig, User, Company } from '@/lib/types';
import { Loader2, Copy, Merge, Trash2, Pencil, CheckCircle, Building, Truck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { statusVariants } from '@/components/dashboard/shipments-table';
import { useToast } from '@/hooks/use-toast';
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
import { cn } from '@/lib/utils';

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    if (date instanceof Date) return date;
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime()) ? parsedDate : null;
};

export default function DuplicatesPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
    const [groupToMerge, setGroupToMerge] = useState<Shipment[] | null>(null);

    const allShipmentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shipments'));
    }, [firestore]);
    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(allShipmentsQuery);

    const statusesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shipment_statuses'));
    }, [firestore]);
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);
    
    const companiesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'companies'));
    }, [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const couriersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'courier'));
    }, [firestore]);
    const { data: couriers, isLoading: couriersLoading } = useCollection<User>(couriersQuery);


    const duplicateShipments = useMemo(() => {
        if (!allShipments) return [];
        const shipmentGroups: { [key: string]: Shipment[] } = {};
        allShipments.forEach(s => {
            if (!s.recipientName || !s.recipientPhone || !s.address) return;
            const key = `${s.recipientName.trim()}-${s.recipientPhone.trim()}-${s.address.trim()}`.toLowerCase();
            if (!shipmentGroups[key]) {
                shipmentGroups[key] = [];
            }
            shipmentGroups[key].push(s);
        });

        return Object.values(shipmentGroups)
            .filter(group => group.length > 1)
            .sort((a, b) => b.length - a.length);
    }, [allShipments]);
    
    const handleDeleteShipment = () => {
        if (!firestore || !shipmentToDelete) return;
        const docRef = doc(firestore, 'shipments', shipmentToDelete.id);
        writeBatch(firestore).delete(docRef).commit()
            .then(() => toast({ title: "تم حذف الشحنة بنجاح" }))
            .catch(() => toast({ title: "فشل حذف الشحنة", variant: "destructive" }))
            .finally(() => setShipmentToDelete(null));
    };

    const handleMergeGroup = () => {
        if (!firestore || !groupToMerge) return;
        const sorted = [...groupToMerge].sort((a, b) => (getSafeDate(b.createdAt)?.getTime() || 0) - (getSafeDate(a.createdAt)?.getTime() || 0));
        const primaryShipment = sorted[0];
        const shipmentsToDelete = sorted.slice(1);

        const batch = writeBatch(firestore);
        shipmentsToDelete.forEach(s => {
            const docRef = doc(firestore, 'shipments', s.id);
            batch.delete(docRef);
        });

        batch.commit()
            .then(() => toast({ title: "تم الدمج بنجاح", description: `تم الإبقاء على الشحنة الأحدث وحذف ${shipmentsToDelete.length} شحنة.` }))
            .catch(() => toast({ title: "فشل الدمج", variant: "destructive" }))
            .finally(() => setGroupToMerge(null));
    };

    const isLoading = shipmentsLoading || statusesLoading || companiesLoading || couriersLoading;

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="mb-6">
                <h1 className="text-3xl font-bold font-headline flex items-center gap-2">
                    <Copy className="h-8 w-8 text-primary" />
                    الشحنات المكررة
                </h1>
                <p className="text-muted-foreground mt-2">
                    مراجعة ودمج الشحنات التي لها نفس بيانات العميل (الاسم، الهاتف، العنوان).
                </p>
            </div>

            <div className="space-y-6">
                {duplicateShipments.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-lg">
                        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                        <h3 className="text-2xl font-bold">لا توجد شحنات مكررة</h3>
                        <p className="mt-2">النظام نظيف حاليًا.</p>
                    </div>
                ) : (
                    duplicateShipments.map((group, index) => {
                        const companyName = companies?.find(c => c.id === group[0].companyId)?.name || 'غير محدد';
                        return (
                            <Card key={index} className="overflow-hidden">
                                <CardHeader className="bg-muted/50">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-lg">
                                            {group[0].recipientName}
                                            <span className="text-sm font-mono text-muted-foreground mx-2">{group[0].recipientPhone}</span>
                                        </CardTitle>
                                        <Badge variant="destructive">{group.length} شحنات مكررة</Badge>
                                    </div>
                                    <CardDescription>{group[0].address}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3">
                                    {group.map(shipment => {
                                        const shipmentCompany = companies?.find(c => c.id === shipment.companyId);
                                        const assignedCourier = couriers?.find(c => c.id === shipment.assignedCourierId);
                                        const isNewest = group.reduce((latest, s) => (getSafeDate(s.createdAt) || 0) > (getSafeDate(latest.createdAt) || 0) ? s : latest).id === shipment.id;

                                        return (
                                            <div key={shipment.id} className={cn("border p-3 rounded-md flex justify-between items-center bg-background", isNewest && "border-primary")}>
                                                <div>
                                                    <div className="flex items-center gap-4">
                                                        <p className="font-mono text-sm">الكود: {shipment.shipmentCode}</p>
                                                        <Badge variant={statusVariants[shipment.status] || 'secondary'}>{statuses?.find(s => s.id === shipment.status)?.label || shipment.status}</Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                                        <p>التاريخ: {getSafeDate(shipment.createdAt)?.toLocaleDateString('ar-EG')}</p>
                                                        {shipmentCompany && <p className="flex items-center gap-1"><Building className="h-3 w-3" /> {shipmentCompany.name}</p>}
                                                        {assignedCourier && <p className="flex items-center gap-1"><Truck className="h-3 w-3" /> {assignedCourier.name}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="ghost" asChild>
                                                        <Link href={`/?tab=shipments&edit=${shipment.id}`} target="_blank">
                                                            <Pencil className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setShipmentToDelete(shipment)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                                <CardFooter className="bg-muted/50 p-3">
                                    <Button variant="outline" size="sm" onClick={() => setGroupToMerge(group)}>
                                        <Merge className="me-2 h-4 w-4"/>
                                        دمج (الإبقاء على الأحدث فقط)
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })
                )}
            </div>
            
            <AlertDialog open={!!shipmentToDelete} onOpenChange={() => setShipmentToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف الشحنة ({shipmentToDelete?.recipientName}) بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteShipment} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={!!groupToMerge} onOpenChange={() => setGroupToMerge(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد عملية الدمج</AlertDialogTitle>
                        <AlertDialogDescription>
                           سيتم الإبقاء على أحدث شحنة في هذه المجموعة وحذف باقي الشحنات المكررة ({groupToMerge ? groupToMerge.length - 1 : 0}). هل أنت متأكد؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleMergeGroup}>نعم، قم بالدمج</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
