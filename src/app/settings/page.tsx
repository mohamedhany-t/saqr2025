
'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, WithIdAndRef } from '@/firebase';
import { collection, doc, writeBatch, deleteDoc, DocumentReference } from 'firebase/firestore';
import type { ShipmentStatusConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Save, Trash2, MessageSquare } from 'lucide-react';
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
import Link from 'next/link';

const defaultStatuses: Partial<ShipmentStatusConfig>[] = [
    { id: 'Pending', label: 'قيد الانتظار', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, visibleToCourier: false, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: false },
    { id: 'In-Transit', label: 'قيد التوصيل', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: false },
    { id: 'Delivered', label: 'تم التسليم', affectsCourierBalance: true, affectsCompanyBalance: true, enabled: true, visibleToCourier: true, requiresFullCollection: true, requiresPartialCollection: false, isDeliveredStatus: true, isReturnedStatus: false },
    { id: 'Partially Delivered', label: 'تسليم جزئي', affectsCourierBalance: true, affectsCompanyBalance: true, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: true, isDeliveredStatus: true, isReturnedStatus: false },
    { id: 'Returned', label: 'مرتجع', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: true },
    { id: 'Cancelled', label: 'تم الإلغاء', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: true },
    { id: 'Postponed', label: 'مؤجل', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: false },
    { id: 'Returned to Sender', label: 'مرتجع للراسل', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, visibleToCourier: false, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: true },
    { id: 'Refused (Paid)', label: 'رفض ودفع الشحن', affectsCourierBalance: true, affectsCompanyBalance: true, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: true, isDeliveredStatus: true, isReturnedStatus: false },
    { id: 'Refused (Unpaid)', label: 'رفض ولم يدفع', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: true },
    { id: 'Evasion (Phone)', label: 'تهرب هاتفيًا', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: true },
    { id: 'Evasion (Delivery Attempt)', label: 'تهرب بعد الوصول', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: true },
    { id: 'PriceChangeRequested', label: 'طلب تعديل سعر', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, visibleToCourier: true, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: false },
    { id: 'PriceChangeRejected', label: 'مرفوض - تابع مع الإدارة', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, visibleToCourier: false, requiresFullCollection: false, requiresPartialCollection: false, isDeliveredStatus: false, isReturnedStatus: false },
];


export default function SettingsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const statusesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'shipment_statuses') : null, [firestore]);
    const { data: serverStatuses, isLoading } = useCollection<ShipmentStatusConfig>(statusesCollectionRef);

    const [localStatuses, setLocalStatuses] = useState<WithIdAndRef<ShipmentStatusConfig>[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [statusToToggle, setStatusToToggle] = useState<WithIdAndRef<ShipmentStatusConfig> | null>(null);
    const [statusToDelete, setStatusToDelete] = useState<WithIdAndRef<ShipmentStatusConfig> | null>(null);

    useEffect(() => {
        const syncStatuses = async () => {
            if (firestore && serverStatuses) {
                const existingStatusIds = new Set(serverStatuses.map(s => s.id));
                const missingStatuses = defaultStatuses.filter(ds => ds.id && !existingStatusIds.has(ds.id));

                if (missingStatuses.length > 0) {
                    console.log(`Found ${missingStatuses.length} missing statuses. Adding them now...`);
                    const batch = writeBatch(firestore);
                    missingStatuses.forEach(status => {
                        const docRef = doc(firestore, 'shipment_statuses', status.id!);
                        batch.set(docRef, status);
                    });
                    await batch.commit();
                    toast({ 
                        title: 'تم تحديث حالات النظام',
                        description: `تمت إضافة ${missingStatuses.length} حالة جديدة تلقائيًا.`
                    });
                    // The `useCollection` hook will re-fetch automatically after the write.
                } else {
                    // If no statuses are missing, just set the local state from server data.
                     const sortedStatuses = [...serverStatuses].sort((a, b) => a.label.localeCompare(b.label));
                     const initializedStatuses = sortedStatuses.map(s => ({
                        ...s,
                        requiresFullCollection: !!s.requiresFullCollection,
                        requiresPartialCollection: !!s.requiresPartialCollection,
                        isDeliveredStatus: !!s.isDeliveredStatus,
                        isReturnedStatus: !!s.isReturnedStatus,
                        visibleToCourier: s.visibleToCourier === undefined ? true : s.visibleToCourier,
                    }));
                    setLocalStatuses(initializedStatuses);
                }
            }
        };

        if (!isLoading && firestore) {
             syncStatuses();
        }
    }, [serverStatuses, isLoading, firestore, toast]);

    const handleFieldChange = (id: string, field: keyof ShipmentStatusConfig, value: any) => {
        setLocalStatuses(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleAddNewStatus = () => {
        if (!firestore) return;
        const newId = `custom_${Date.now()}`;
        const newStatusRef = doc(collection(firestore, 'shipment_statuses'), newId);
        const newStatus: WithIdAndRef<ShipmentStatusConfig> = {
            id: newId,
            label: 'حالة جديدة',
            affectsCourierBalance: false,
            affectsCompanyBalance: false,
            enabled: true,
            visibleToCourier: true,
            requiresFullCollection: false,
            requiresPartialCollection: false,
            isDeliveredStatus: false,
            isReturnedStatus: false,
            ref: newStatusRef as DocumentReference<ShipmentStatusConfig>,
        };
        setLocalStatuses(prev => [...prev, newStatus]);
    };
    
    const confirmToggleStatus = () => {
        if (!statusToToggle) return;
        handleFieldChange(statusToToggle.id, 'enabled', !statusToToggle.enabled);
        setStatusToToggle(null);
    };

    const confirmDeleteStatus = async () => {
        if (!statusToDelete || !firestore) return;

        // Prevent deletion of core statuses
        if (isCoreStatus(statusToDelete.id)) {
            toast({ title: 'لا يمكن حذف الحالات الأساسية', variant: 'destructive'});
            setStatusToDelete(null);
            return;
        }

        try {
            await deleteDoc(doc(firestore, 'shipment_statuses', statusToDelete.id));
            toast({ title: 'تم حذف الحالة بنجاح' });
            // The useCollection hook will automatically re-fetch and update the UI
        } catch (error) {
            console.error("Error deleting status:", error);
            toast({ title: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
        } finally {
            setStatusToDelete(null);
        }
    }

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const batch = writeBatch(firestore);

        localStatuses.forEach(status => {
            const docRef = doc(firestore, 'shipment_statuses', status.id);
            // Create a clean object without the 'ref' property before saving
            const { ref, ...statusToSave } = status;
            batch.set(docRef, statusToSave);
        });

        try {
            await batch.commit();
            toast({ title: 'تم حفظ التغييرات بنجاح' });
        } catch (error) {
            console.error("Error saving statuses:", error);
            toast({ title: 'حدث خطأ أثناء الحفظ', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const isCoreStatus = (id: string) => defaultStatuses.some(ds => ds.id === id);

    if (isLoading && localStatuses.length === 0) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">إعدادات النظام</h1>
                    <p className="text-muted-foreground mt-2">
                        تحكم في الجوانب المختلفة من نظام الشحن الخاص بك.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                    حفظ التغييرات
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>إعدادات رسائل واتساب</CardTitle>
                    <CardDescription>
                        تخصيص قوالب الرسائل التلقائية التي يتم إرسالها للعملاء عبر واتساب.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Link href="/settings/whatsapp" passHref>
                        <Button variant="outline">
                            <MessageSquare className="me-2 h-4 w-4" />
                            الانتقال إلى إعدادات الواتساب
                        </Button>
                    </Link>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>إدارة حالات الشحنات</CardTitle>
                    <CardDescription>
                        أضف أو عدّل حالات الشحنات وحدد أي منها يؤثر على الحسابات والتقارير.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">المفتاح (Key)</TableHead>
                                <TableHead>الاسم المعروض</TableHead>
                                <TableHead>تعتبر مُسلمة؟</TableHead>
                                <TableHead>تعتبر مرتجع؟</TableHead>
                                <TableHead>تحسب للمندوب</TableHead>
                                <TableHead>تحسب للشركة</TableHead>
                                <TableHead>الإجمالي = المدفوع</TableHead>
                                <TableHead>يسمح بالتحصيل الجزئي</TableHead>
                                <TableHead>مفعلة</TableHead>
                                <TableHead>يظهر للمندوب</TableHead>
                                <TableHead>إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {localStatuses.map(status => (
                                <TableRow key={status.id}>
                                    <TableCell>
                                        <Input
                                            value={status.id}
                                            onChange={e => handleFieldChange(status.id, 'id', e.target.value)}
                                            className="font-mono"
                                            disabled={isCoreStatus(status.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={status.label}
                                            onChange={e => handleFieldChange(status.id, 'label', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.isDeliveredStatus}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'isDeliveredStatus', !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.isReturnedStatus}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'isReturnedStatus', !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.affectsCourierBalance}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'affectsCourierBalance', !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.affectsCompanyBalance}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'affectsCompanyBalance', !!checked)}
                                        />
                                    </TableCell>
                                     <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.requiresFullCollection}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'requiresFullCollection', !!checked)}
                                        />
                                    </TableCell>
                                     <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.requiresPartialCollection}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'requiresPartialCollection', !!checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.enabled}
                                            onCheckedChange={() => setStatusToToggle(status)}
                                            disabled={isCoreStatus(status.id) && status.id === 'Delivered'}
                                        />
                                    </TableCell>
                                     <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.visibleToCourier}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'visibleToCourier', !!checked)}
                                        />
                                    </TableCell>
                                     <TableCell className="text-center">
                                        {!isCoreStatus(status.id) && (
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setStatusToDelete(status)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <Button variant="outline" className="mt-4" onClick={handleAddNewStatus}>
                        <PlusCircle className="me-2 h-4 w-4" />
                        إضافة حالة جديدة
                    </Button>
                </CardContent>
            </Card>
            
             <AlertDialog open={!!statusToToggle} onOpenChange={() => setStatusToToggle(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            {statusToToggle?.enabled ? "سيؤدي إلغاء تفعيل هذه الحالة إلى إخفائها من قوائم الاختيار، لكنه لن يؤثر على الشحنات الحالية التي تستخدم هذه الحالة." : "سيؤدي تفعيل هذه الحالة إلى إظهارها في جميع قوائم اختيار الحالة في النظام."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setStatusToToggle(null)}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmToggleStatus}>نعم، قم بالتغيير</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
             <AlertDialog open={!!statusToDelete} onOpenChange={() => setStatusToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                        <AlertDialogDescription>
                           سيتم حذف الحالة "{statusToDelete?.label}" بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setStatusToDelete(null)}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDeleteStatus}>حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
