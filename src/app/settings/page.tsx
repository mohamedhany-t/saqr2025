
'use client';
import React, { useEffect, useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { ShipmentStatusConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Save } from 'lucide-react';
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

const defaultStatuses: ShipmentStatusConfig[] = [
    { id: 'Pending', label: 'قيد الانتظار', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: false },
    { id: 'In-Transit', label: 'قيد التوصيل', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: false },
    { id: 'Delivered', label: 'تم التسليم', affectsCourierBalance: true, affectsCompanyBalance: true, enabled: true, isConsideredDelivered: true, isConsideredReturned: false },
    { id: 'Partially Delivered', label: 'تسليم جزئي', affectsCourierBalance: true, affectsCompanyBalance: true, enabled: true, isConsideredDelivered: true, isConsideredReturned: false },
    { id: 'Returned', label: 'مرتجع', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: true },
    { id: 'Cancelled', label: 'تم الإلغاء', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: true },
    { id: 'Postponed', label: 'مؤجل', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: false },
    { id: 'Returned to Sender', label: 'مرتجع للراسل', affectsCourierBalance: false, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: true },
    { id: 'Refused (Paid)', label: 'رفض ودفع الشحن', affectsCourierBalance: true, affectsCompanyBalance: true, enabled: true, isConsideredDelivered: true, isConsideredReturned: false },
    { id: 'Refused (Unpaid)', label: 'رفض ولم يدفع', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: true },
    { id: 'Evasion (Phone)', label: 'تهرب هاتفيًا', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: true },
    { id: 'Evasion (Delivery Attempt)', label: 'تهرب بعد الوصول', affectsCourierBalance: true, affectsCompanyBalance: false, enabled: true, isConsideredDelivered: false, isConsideredReturned: true },
];

export default function SettingsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const statusesCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'shipment_statuses') : null, [firestore]);
    const { data: serverStatuses, isLoading } = useCollection<ShipmentStatusConfig>(statusesCollectionRef);

    const [localStatuses, setLocalStatuses] = useState<ShipmentStatusConfig[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [statusToToggle, setStatusToToggle] = useState<ShipmentStatusConfig | null>(null);

    useEffect(() => {
        const seedDefaultStatuses = async () => {
            if (firestore && serverStatuses && serverStatuses.length === 0) {
                console.log("No statuses found, seeding default statuses...");
                const batch = writeBatch(firestore);
                defaultStatuses.forEach(status => {
                    const docRef = doc(firestore, 'shipment_statuses', status.id);
                    batch.set(docRef, status);
                });
                await batch.commit();
                toast({ title: 'تم إنشاء الحالات الافتراضية' });
            }
        };

        if (!isLoading && serverStatuses) {
            if (serverStatuses.length === 0) {
                seedDefaultStatuses();
            } else {
                setLocalStatuses(serverStatuses);
            }
        }
    }, [serverStatuses, isLoading, firestore, toast]);

    const handleFieldChange = (id: string, field: keyof ShipmentStatusConfig, value: any) => {
        setLocalStatuses(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleAddNewStatus = () => {
        const newId = `custom_${Date.now()}`;
        const newStatus: ShipmentStatusConfig = {
            id: newId,
            label: 'حالة جديدة',
            affectsCourierBalance: false,
            affectsCompanyBalance: false,
            enabled: true,
            isConsideredDelivered: false,
            isConsideredReturned: false,
        };
        setLocalStatuses(prev => [...prev, newStatus]);
    };
    
    const confirmToggleStatus = () => {
        if (!statusToToggle) return;
        handleFieldChange(statusToToggle.id, 'enabled', !statusToToggle.enabled);
        setStatusToToggle(null);
    };

    const handleSave = async () => {
        if (!firestore) return;
        setIsSaving(true);
        const batch = writeBatch(firestore);

        localStatuses.forEach(status => {
            // Sanitize ID: remove spaces and enforce English characters
            const sanitizedId = status.id.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_().-]/g, '');
            if (!sanitizedId) {
                toast({ title: 'خطأ في الحفظ', description: `المفتاح للحالة "${status.label}" غير صالح.`, variant: 'destructive'});
                setIsSaving(false);
                return;
            }
            const docRef = doc(firestore, 'shipment_statuses', sanitizedId);
            batch.set(docRef, { ...status, id: sanitizedId });
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

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
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
                    <CardTitle>إدارة حالات الشحنات</CardTitle>
                    <CardDescription>
                        أضف أو عدّل حالات الشحنات وحدد أي منها يؤثر على الحسابات المالية.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">المفتاح (Key)</TableHead>
                                <TableHead>الاسم المعروض</TableHead>
                                <TableHead>تحسب للمندوب</TableHead>
                                <TableHead>تحسب للشركة</TableHead>
                                <TableHead>تعتبر "مسلمة"</TableHead>
                                <TableHead>تعتبر "مرتجع"</TableHead>
                                <TableHead>مفعلة</TableHead>
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
                                            checked={status.affectsCourierBalance}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'affectsCourierBalance', checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.affectsCompanyBalance}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'affectsCompanyBalance', checked)}
                                        />
                                    </TableCell>
                                     <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.isConsideredDelivered}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'isConsideredDelivered', checked)}
                                        />
                                    </TableCell>
                                     <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.isConsideredReturned}
                                            onCheckedChange={checked => handleFieldChange(status.id, 'isConsideredReturned', checked)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Checkbox
                                            checked={status.enabled}
                                            onCheckedChange={() => setStatusToToggle(status)}
                                            disabled={isCoreStatus(status.id) && status.id === 'Delivered'}
                                        />
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
        </div>
    );
}
