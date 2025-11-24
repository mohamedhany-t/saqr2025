
"use client";
import React, { useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import type { Governorate, CustomStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Input } from '../ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Pencil, Trash2, Settings } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Switch } from '../ui/switch';

// --- Governorate Management ---
const governorateSchema = z.object({
  name: z.string().min(1, 'اسم المحافظة مطلوب'),
});

const GovernorateForm = ({ onSave, governorate }: { onSave: (name: string, id?: string) => void, governorate?: Governorate }) => {
  const form = useForm<z.infer<typeof governorateSchema>>({
    resolver: zodResolver(governorateSchema),
    defaultValues: { name: governorate?.name || '' },
  });

  useEffect(() => {
    form.reset({ name: governorate?.name || '' });
  }, [governorate, form]);

  const onSubmit = (values: z.infer<typeof governorateSchema>) => {
    onSave(values.name, governorate?.id);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>{governorate ? 'تعديل محافظة' : 'إضافة محافظة جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>اسم المحافظة</FormLabel>
                <FormControl>
                  <Input {...field} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">إلغاء</Button></DialogClose>
          <Button type="submit">حفظ</Button>
        </DialogFooter>
      </form>
    </Form>
  );
};


// --- Custom Status Management ---
const customStatusSchema = z.object({
  name: z.string().min(2, "اسم الحالة مطلوب"),
  hasCommission: z.boolean().default(false),
});

const CustomStatusForm = ({ onSave, status }: { onSave: (data: z.infer<typeof customStatusSchema>, id?: string) => void, status?: CustomStatus }) => {
    const form = useForm<z.infer<typeof customStatusSchema>>({
        resolver: zodResolver(customStatusSchema),
        defaultValues: { name: status?.name || '', hasCommission: status?.hasCommission || false },
    });

    useEffect(() => {
        form.reset({ name: status?.name || '', hasCommission: status?.hasCommission || false });
    }, [status, form]);

    const onSubmit = (values: z.infer<typeof customStatusSchema>) => {
        onSave(values, status?.id);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <DialogHeader>
                    <DialogTitle>{status ? 'تعديل حالة' : 'إضافة حالة جديدة'}</DialogTitle>
                </DialogHeader>
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>اسم الحالة</FormLabel>
                            <FormControl><Input {...field} autoFocus /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="hasCommission"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel>تستحق عمولة؟</FormLabel>
                                <FormDescription>هل يتم احتساب عمولة للمندوب عند اختيار هذه الحالة؟</FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">إلغاء</Button></DialogClose>
                    <Button type="submit">حفظ</Button>
                </DialogFooter>
            </form>
        </Form>
    )
};


// --- Main Settings Page Component ---
export function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  // Governorates State
  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'governorates');
  }, [firestore]);
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);
  const [isGovFormOpen, setIsGovFormOpen] = useState(false);
  const [editingGovernorate, setEditingGovernorate] = useState<Governorate | undefined>(undefined);
  const [deletingGovernorate, setDeletingGovernorate] = useState<Governorate | null>(null);
  
  // Custom Statuses State
  const customStatusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'custom_statuses');
  }, [firestore]);
  const { data: customStatuses, isLoading: statusesLoading } = useCollection<CustomStatus>(customStatusesQuery);
  const [isStatusFormOpen, setIsStatusFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<CustomStatus | undefined>(undefined);
  const [deletingStatus, setDeletingStatus] = useState<CustomStatus | null>(null);


  const handleSaveGovernorate = async (name: string, id?: string) => {
    if (!firestore) return;
    try {
      if (id) {
        await updateDoc(doc(firestore, 'governorates', id), { name });
        toast({ title: 'تم التحديث بنجاح' });
      } else {
        await addDoc(collection(firestore, 'governorates'), { name });
        toast({ title: 'تمت الإضافة بنجاح' });
      }
      setIsGovFormOpen(false);
    } catch (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
  };

  const handleDeleteGovernorate = async () => {
    if (!firestore || !deletingGovernorate) return;
    try {
      await deleteDoc(doc(firestore, 'governorates', deletingGovernorate.id));
      toast({ title: 'تم الحذف بنجاح' });
    } catch (error) {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    } finally {
      setDeletingGovernorate(null);
    }
  };
  
  const handleSaveCustomStatus = async (data: z.infer<typeof customStatusSchema>, id?: string) => {
    if (!firestore) return;
    try {
        if (id) {
            await updateDoc(doc(firestore, 'custom_statuses', id), data);
            toast({ title: 'تم تحديث الحالة بنجاح' });
        } else {
            await addDoc(collection(firestore, 'custom_statuses'), data);
            toast({ title: 'تمت إضافة الحالة بنجاح' });
        }
        setIsStatusFormOpen(false);
    } catch(error) {
        toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
  };

  const handleDeleteCustomStatus = async () => {
    if (!firestore || !deletingStatus) return;
    try {
        await deleteDoc(doc(firestore, 'custom_statuses', deletingStatus.id));
        toast({ title: 'تم حذف الحالة بنجاح' });
    } catch (error) {
        toast({ title: 'حدث خطأ', variant: 'destructive' });
    } finally {
        setDeletingStatus(null);
    }
  };


  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Settings className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold font-headline">الإعدادات العامة</h1>
          <p className="text-muted-foreground">تحكم في الخيارات الأساسية للنظام من مكان واحد.</p>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['governorates', 'custom_statuses']} className="w-full space-y-4">
        <AccordionItem value="governorates">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-right">
                <CardTitle>إدارة المحافظات</CardTitle>
                <CardDescription className="pt-1">إضافة، تعديل، وحذف المحافظات المستخدمة في النظام.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent className="p-6 pt-0">
              <div className="flex justify-end mb-4">
                <Dialog open={isGovFormOpen} onOpenChange={setIsGovFormOpen}>
                  <DialogTrigger asChild><Button onClick={() => { setEditingGovernorate(undefined); setIsGovFormOpen(true); }}><PlusCircle className="me-2 h-4 w-4" /> إضافة محافظة</Button></DialogTrigger>
                  <DialogContent><GovernorateForm onSave={handleSaveGovernorate} governorate={editingGovernorate} /></DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>اسم المحافظة</TableHead><TableHead className="text-left w-[100px]">إجراءات</TableHead></TableRow></TableHeader>
                <TableBody>
                  {governoratesLoading ? <TableRow><TableCell colSpan={2}><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow> :
                   governorates?.map(gov => (
                    <TableRow key={gov.id}>
                      <TableCell className="font-medium">{gov.name}</TableCell>
                      <TableCell className="text-left">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingGovernorate(gov); setIsGovFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingGovernorate(gov)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </Card>
        </AccordionItem>

         <AccordionItem value="custom_statuses">
          <Card>
            <AccordionTrigger className="p-6">
              <CardHeader className="p-0 text-right">
                <CardTitle>إدارة حالات الشحن</CardTitle>
                <CardDescription className="pt-1">إضافة حالات مخصصة للشحنات وتحديد استحقاقها للعمولة.</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent className="p-6 pt-0">
                <div className="flex justify-end mb-4">
                    <Dialog open={isStatusFormOpen} onOpenChange={setIsStatusFormOpen}>
                        <DialogTrigger asChild><Button onClick={() => { setEditingStatus(undefined); setIsStatusFormOpen(true); }}><PlusCircle className="me-2 h-4 w-4" /> إضافة حالة</Button></DialogTrigger>
                        <DialogContent><CustomStatusForm onSave={handleSaveCustomStatus} status={editingStatus} /></DialogContent>
                    </Dialog>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>اسم الحالة</TableHead><TableHead>تستحق عمولة؟</TableHead><TableHead className="text-left w-[100px]">إجراءات</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {statusesLoading ? <TableRow><TableCell colSpan={3}><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow> :
                         customStatuses?.map(status => (
                            <TableRow key={status.id}>
                                <TableCell className="font-medium">{status.name}</TableCell>
                                <TableCell>{status.hasCommission ? "نعم" : "لا"}</TableCell>
                                <TableCell className="text-left">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingStatus(status); setIsStatusFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingStatus(status)}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                         ))}
                    </TableBody>
                </Table>
            </AccordionContent>
          </Card>
        </AccordionItem>

      </Accordion>

      <AlertDialog open={!!deletingGovernorate} onOpenChange={(open) => !open && setDeletingGovernorate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>هل تريد حذف محافظة "{deletingGovernorate?.name}"؟</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDeleteGovernorate} className="bg-destructive hover:bg-destructive/80">حذف</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={!!deletingStatus} onOpenChange={(open) => !open && setDeletingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>هل تريد حذف حالة "{deletingStatus?.name}"؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDeleteCustomStatus} className="bg-destructive hover:bg-destructive/80">حذف</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
