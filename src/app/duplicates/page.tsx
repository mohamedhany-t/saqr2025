
'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, writeBatch, doc, where, getDocs } from 'firebase/firestore';
import type { Shipment, ShipmentStatusConfig, User, Company, Governorate } from '@/lib/types';
import { Loader2, Copy, Trash2, Pencil, CheckCircle, Building, Truck, Star, Search, Trash, History } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ShipmentFormSheet } from '@/components/shipments/shipment-form-sheet';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useFirebaseApp } from '@/firebase';
import { ShipmentDetailsDialog } from '@/components/shipments/shipment-details-dialog';

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    if (date instanceof Date) return date;
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime()) ? parsedDate : null;
};

export default function DuplicatesPage() {
    const firestore = useFirestore();
    const app = useFirebaseApp();
    const { user: authUser } = useUser();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingShipment, setEditingShipment] = useState<Shipment | undefined>(undefined);
    const [detailsShipment, setDetailsShipment] = useState<Shipment | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
    const [groupToDelete, setGroupToDelete] = useState<{ primary: Shipment, others: Shipment[] } | null>(null);
    const [primaryShipmentSelection, setPrimaryShipmentSelection] = useState<Record<string, string>>({}); // { [groupKey]: primaryShipmentId }

    // --- Data Fetching ---
    const allShipmentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]);
    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(allShipmentsQuery);

    const statusesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]);
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);
    
    const companiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const couriersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'courier'));
    }, [firestore]);
    const { data: couriers, isLoading: couriersLoading } = useCollection<User>(couriersQuery);

    const governoratesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'governorates')) : null, [firestore]);
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

    // --- Logic ---
    const duplicateShipmentGroups = useMemo(() => {
        if (!allShipments) return [];
        const shipmentGroups: { [key: string]: Shipment[] } = {};
        allShipments.forEach(s => {
            if (!s.recipientName || !s.recipientPhone || !s.address) return;
            const key = `${s.recipientName.trim()}-${s.recipientPhone.trim()}`.toLowerCase();
            if (!shipmentGroups[key]) shipmentGroups[key] = [];
            shipmentGroups[key].push(s);
        });

        const filteredGroups = Object.values(shipmentGroups)
            .filter(group => group.length > 1);

        if (!searchTerm) {
            return filteredGroups.sort((a, b) => b.length - a.length);
        }

        const lowercasedTerm = searchTerm.toLowerCase();
        return filteredGroups.filter(group => 
            group[0].recipientName.toLowerCase().includes(lowercasedTerm) ||
            group.some(s => s.shipmentCode?.toLowerCase().includes(lowercasedTerm))
        ).sort((a, b) => b.length - a.length);

    }, [allShipments, searchTerm]);

    const handleSaveShipment = useCallback(async (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
        if (!firestore || !authUser || !app || !id) return;
        try {
            const functions = getFunctions(app);
            const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');
            await handleShipmentUpdateFn({ shipmentId: id, ...data });
            toast({ title: 'تم تحديث الشحنة بنجاح' });
        } catch (error: any) {
            console.error("Error saving shipment:", error);
            toast({ title: "فشل تحديث الشحنة", description: error.message, variant: "destructive" });
        } finally {
            setIsSheetOpen(false);
        }
    }, [firestore, authUser, app, toast]);
    
    const handleDeleteShipment = () => {
        if (!firestore || !shipmentToDelete) return;
        const docRef = doc(firestore, 'shipments', shipmentToDelete.id);
        writeBatch(firestore).delete(docRef).commit()
            .then(() => toast({ title: "تم حذف الشحنة بنجاح" }))
            .catch(() => toast({ title: "فشل حذف الشحنة", variant: "destructive" }))
            .finally(() => setShipmentToDelete(null));
    };

    const handleDeleteRemaining = () => {
        if (!firestore || !groupToDelete) return;
        const batch = writeBatch(firestore);
        groupToDelete.others.forEach(s => {
            const docRef = doc(firestore, 'shipments', s.id);
            batch.delete(docRef);
        });

        batch.commit()
            .then(() => toast({ title: "تم حذف الشحنات بنجاح", description: `تم الإبقاء على الشحنة الأساسية وحذف ${groupToDelete.others.length} شحنة.` }))
            .catch(() => toast({ title: "فشل الحذف", variant: "destructive" }))
            .finally(() => setGroupToDelete(null));
    };

    const handleSelectPrimary = (groupKey: string, shipmentId: string) => {
        setPrimaryShipmentSelection(prev => ({
            ...prev,
            [groupKey]: shipmentId
        }));
    };

    const isLoading = shipmentsLoading || statusesLoading || companiesLoading || couriersLoading || governoratesLoading;

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
                    مراجعة وتنظيف الشحنات التي لها نفس بيانات العميل (الاسم والهاتف).
                </p>
                <div className="mt-4 max-w-lg relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="ابحث بالاسم أو بكود الشحنة..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <div className="space-y-6">
                {duplicateShipmentGroups.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground bg-muted/30 rounded-lg">
                        <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
                        <h3 className="text-2xl font-bold">{searchTerm ? 'لا توجد نتائج تطابق بحثك' : 'لا توجد شحنات مكررة'}</h3>
                        <p className="mt-2">{searchTerm ? 'جرب البحث باسم آخر.' : 'النظام نظيف حاليًا.'}</p>
                    </div>
                ) : (
                    duplicateShipmentGroups.map((group, index) => {
                        const groupKey = `${group[0].recipientName}-${group[0].recipientPhone}`;
                        const primaryId = primaryShipmentSelection[groupKey] || group[0].id;
                        
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
                                        const isPrimary = shipment.id === primaryId;

                                        return (
                                            <div key={shipment.id} className={cn("border p-3 rounded-md flex justify-between items-start gap-2", isPrimary ? "bg-primary/10 border-primary" : "bg-background")}>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-4 mb-2">
                                                        <p className="font-mono text-sm">الكود: {shipment.shipmentCode}</p>
                                                        <Badge variant={statusVariants[shipment.status] || 'secondary'}>{statuses?.find(s => s.id === shipment.status)?.label || shipment.status}</Badge>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground space-y-1">
                                                        <p>التاريخ: {getSafeDate(shipment.createdAt)?.toLocaleDateString('ar-EG')}</p>
                                                        {shipmentCompany && <p className="flex items-center gap-1"><Building className="h-3 w-3" /> {shipmentCompany.name}</p>}
                                                        {assignedCourier && <p className="flex items-center gap-1"><Truck className="h-3 w-3" /> {assignedCourier.name}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                     <Button size="sm" variant={isPrimary ? "default" : "outline"} onClick={() => handleSelectPrimary(groupKey, shipment.id)}>
                                                        <Star className="me-2 h-4 w-4"/>
                                                        {isPrimary ? "الأساسية" : "تحديد كأساسي"}
                                                    </Button>
                                                    <div className='flex gap-1'>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailsShipment(shipment)}>
                                                            <History className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingShipment(shipment); setIsSheetOpen(true); }}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setShipmentToDelete(shipment)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                                <CardFooter className="bg-muted/50 p-3">
                                    <Button 
                                        variant="destructive" 
                                        size="sm"
                                        onClick={() => {
                                            const primary = group.find(s => s.id === primaryId);
                                            const others = group.filter(s => s.id !== primaryId);
                                            if (primary) {
                                                setGroupToDelete({ primary, others });
                                            }
                                        }}
                                    >
                                        <Trash className="me-2 h-4 w-4"/>
                                        حذف الشحنات المتبقية ({group.length - 1})
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })
                )}
            </div>
            
            {/* Dialogs and Sheets */}
            {editingShipment && (
                <ShipmentFormSheet
                    open={isSheetOpen}
                    onOpenChange={setIsSheetOpen}
                    shipment={editingShipment}
                    onSave={handleSaveShipment}
                    governorates={governorates || []}
                    couriers={couriers || []}
                    companies={companies || []}
                    statuses={statuses || []}
                    role="admin"
                />
            )}
             {detailsShipment && (
                <ShipmentDetailsDialog
                    open={!!detailsShipment}
                    onOpenChange={(open) => !open && setDetailsShipment(null)}
                    shipment={detailsShipment}
                    company={companies?.find(c => c.id === detailsShipment.companyId)}
                    courier={couriers?.find(u => u.id === detailsShipment.assignedCourierId)}
                    governorate={governorates?.find(g => g.id === detailsShipment.governorateId)}
                />
            )}
            
            <AlertDialog open={!!shipmentToDelete} onOpenChange={() => setShipmentToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف الشحنة ({shipmentToDelete?.shipmentCode}) بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteShipment} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <AlertDialog open={!!groupToDelete} onOpenChange={() => setGroupToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد عملية الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                           سيتم الإبقاء على الشحنة الأساسية ({groupToDelete?.primary.shipmentCode}) وحذف باقي الشحنات المكررة ({groupToDelete?.others.length}). هل أنت متأكد؟
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteRemaining} className="bg-destructive hover:bg-destructive/90">نعم، قم بالحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
