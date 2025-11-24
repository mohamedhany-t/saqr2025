
"use client";
import React, { useState, useEffect } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import type { Governorate, SystemSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '../ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Input } from '../ui/input';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Pencil, Trash2, XIcon, Settings } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { getSettings, updateSettings } from '@/firebase/settings';
import { Textarea } from '../ui/textarea';

// --- Governorate Management ---
const governorateSchema = z.object({
  name: z.string().min(1, 'اسم المحافظة مطلوب'),
});

const GovernorateForm = ({ onSave, governorate }: { onSave: (name: string, id?: string) => void, governorate?: Governorate }) => {
  const form = useForm<z.infer<typeof governorateSchema>>({
    resolver: zodResolver(governorateSchema),
    defaultValues: { name: governorate?.name || '' },
  });

  const onSubmit = (values: z.infer<typeof governorateSchema>) => {
    onSave(values.name, governorate?.id);
  };
  
  useEffect(() => {
    form.reset({ name: governorate?.name || '' });
  }, [governorate, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>{governorate ? 'تعديل محافظة' : 'إضافة محافظة جديدة'}</DialogTitle>
          <DialogDescription>
            {governorate ? 'قم بتغيير اسم المحافظة.' : 'أدخل اسم المحافظة الجديدة.'}
          </Description>
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


// --- Return Reasons Management ---
const returnReasonsSchema = z.object({
    reasons: z.array(z.object({ value: z.string().min(1, "السبب لا يمكن أن يكون فارغًا") })),
});

const ReturnReasonsForm = ({ settings, onSave }: { settings: SystemSettings | null, onSave: (data: Partial<SystemSettings>) => Promise<void> }) => {
    const form = useForm<z.infer<typeof returnReasonsSchema>>({
        resolver: zodResolver(returnReasonsSchema),
        defaultValues: { reasons: settings?.returnReasons?.map(r => ({ value: r })) || [] },
    });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: "reasons" });
    const { toast } = useToast();

    const onSubmit = async (values: z.infer<typeof returnReasonsSchema>) => {
        await onSave({ returnReasons: values.reasons.map(r => r.value) });
        toast({ title: 'تم حفظ أسباب الإرجاع بنجاح' });
    };

    useEffect(() => {
        form.reset({ reasons: settings?.returnReasons?.map(r => ({ value: r })) || [] });
    }, [settings, form]);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <CardTitle>إدارة أسباب الإرجاع</CardTitle>
                <CardDescription>
                    قم بإدارة القائمة المنسدلة لأسباب إرجاع الشحنات التي تظهر للمندوب.
                </CardDescription>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                    {fields.map((field, index) => (
                        <FormField
                            key={field.id}
                            control={form.control}
                            name={`reasons.${index}.value`}
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <XIcon className="h-4 w-4 text-destructive" />
                                    </Button>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ value: "" })}>
                        <PlusCircle className="me-2 h-4 w-4" /> إضافة سبب
                    </Button>
                    <Button type="submit" size="sm">حفظ الأسباب</Button>
                </div>
            </form>
        </Form>
    );
};


// --- WhatsApp Template Management ---
const whatsappTemplateSchema = z.object({
  template: z.string().min(10, 'القالب قصير جدًا'),
});

const WhatsAppTemplateForm = ({ settings, onSave }: { settings: SystemSettings | null, onSave: (data: Partial<SystemSettings>) => Promise<void> }) => {
    const form = useForm<z.infer<typeof whatsappTemplateSchema>>({
        resolver: zodResolver(whatsappTemplateSchema),
        defaultValues: { template: settings?.whatsappTemplate || '' },
    });
    const { toast } = useToast();

    useEffect(() => {
        form.reset({ template: settings?.whatsappTemplate || '' });
    }, [settings, form]);

    const onSubmit = async (values: z.infer<typeof whatsappTemplateSchema>) => {
        await onSave({ whatsappTemplate: values.template });
        toast({ title: 'تم حفظ قالب واتساب بنجاح' });
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <CardTitle>قالب رسالة واتساب</CardTitle>
                 <CardDescription>
                    قم بتخصيص الرسالة الافتراضية التي يرسلها المندوب للعميل. يمكنك استخدام المتغيرات التالية:
                    <code className="block bg-muted p-2 rounded-md my-2 text-sm text-foreground ltr text-left">
                        {'{customerName}'} {'{courierName}'} {'{orderAmount}'} {'{fullAddress}'}
                    </code>
                 </CardDescription>
                 <FormField
                    control={form.control}
                    name="template"
                    render={({ field }) => (
                        <FormItem>
                            <FormControl>
                                <Textarea {...field} rows={6} className="text-right" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                 />
                 <Button type="submit" size="sm">حفظ القالب</Button>
            </form>
        </Form>
    );
};


// --- Main Settings Page Component ---
export function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  const governoratesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]);
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

  const [isGovFormOpen, setIsGovFormOpen] = useState(false);
  const [editingGovernorate, setEditingGovernorate] = useState<Governorate | undefined>(undefined);
  const [deletingGovernorate, setDeletingGovernorate] = useState<Governorate | null>(null);

  useEffect(() => {
    if (firestore) {
        setSettingsLoading(true);
        getSettings(firestore).then(data => {
            setSettings(data);
        }).finally(() => setSettingsLoading(false));
    }
  }, [firestore]);

  const handleSaveSettings = async (data: Partial<SystemSettings>) => {
    if (!firestore) return;
    try {
      await updateSettings(firestore, data);
      setSettings(prev => prev ? { ...prev, ...data } : data as SystemSettings);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({ title: 'حدث خطأ', description: 'لم نتمكن من حفظ الإعدادات.', variant: 'destructive' });
    }
  };

  const handleSaveGovernorate = async (name: string, id?: string) => {
    if (!firestore) return;
    try {
      if (id) {
        await updateDoc(doc(firestore, 'governorates', id), { name });
        toast({ title: 'تم التحديث بنجاح', description: `تم تغيير اسم المحافظة إلى "${name}".` });
      } else {
        await addDoc(collection(firestore, 'governorates'), { name });
        toast({ title: 'تمت الإضافة بنجاح', description: `تمت إضافة محافظة "${name}".` });
      }
      setIsGovFormOpen(false);
      setEditingGovernorate(undefined);
    } catch (error) {
      console.error('Error saving governorate:', error);
      toast({ title: 'حدث خطأ', description: 'لم نتمكن من حفظ المحافظة.', variant: 'destructive' });
    }
  };

  const handleDeleteGovernorate = async () => {
    if (!firestore || !deletingGovernorate) return;
    try {
      await deleteDoc(doc(firestore, 'governorates', deletingGovernorate.id));
      toast({ title: 'تم الحذف بنجاح', description: `تم حذف محافظة "${deletingGovernorate.name}".` });
    } catch (error) {
      console.error('Error deleting governorate:', error);
      toast({ title: 'حدث خطأ', description: 'لم نتمكن من حذف المحافظة.', variant: 'destructive' });
    } finally {
        setDeletingGovernorate(null);
    }
  };

  const openGovFormForNew = () => {
    setEditingGovernorate(undefined);
    setIsGovFormOpen(true);
  };
  
  const openGovFormForEdit = (gov: Governorate) => {
    setEditingGovernorate(gov);
    setIsGovFormOpen(true);
  };

  if (settingsLoading) {
      return (
          <div className="flex h-64 w-full items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
        <div className="flex items-center gap-4 mb-6">
            <Settings className="w-8 h-8 text-primary" />
            <div>
                <h1 className="text-3xl font-bold font-headline">الإعدادات العامة</h1>
                <p className="text-muted-foreground">تحكم في الخيارات الأساسية للنظام من مكان واحد.</p>
            </div>
        </div>

        <Accordion type="multiple" defaultValue={['governorates', 'return-reasons', 'whatsapp-template']} className="w-full space-y-4">
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
                                 <DialogTrigger asChild>
                                    <Button onClick={openGovFormForNew}>
                                        <PlusCircle className="me-2 h-4 w-4" />
                                        إضافة محافظة
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <GovernorateForm onSave={handleSaveGovernorate} governorate={editingGovernorate} />
                                </DialogContent>
                            </Dialog>
                        </div>
                        <Table>
                            <TableHeader><TableRow><TableHead>اسم المحافظة</TableHead><TableHead className="text-left w-[100px]">إجراءات</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {governoratesLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : governorates && governorates.length > 0 ? (
                                    governorates.map(gov => (
                                        <TableRow key={gov.id}>
                                            <TableCell className="font-medium">{gov.name}</TableCell>
                                            <TableCell className="text-left">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openGovFormForEdit(gov)}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingGovernorate(gov)}><Trash2 className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={2} className="text-center h-24">لا توجد محافظات.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </AccordionContent>
                </Card>
            </AccordionItem>
            
             <AccordionItem value="return-reasons">
                <Card>
                    <AccordionTrigger className="p-6">
                         <CardHeader className="p-0 text-right">
                             <CardTitle>إدارة أسباب الإرجاع</CardTitle>
                              <CardDescription className="pt-1">تحكم في قائمة أسباب إرجاع الشحنات التي تظهر للمندوب.</CardDescription>
                         </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <ReturnReasonsForm settings={settings} onSave={handleSaveSettings} />
                    </AccordionContent>
                </Card>
            </AccordionItem>

            <AccordionItem value="whatsapp-template">
                <Card>
                    <AccordionTrigger className="p-6">
                         <CardHeader className="p-0 text-right">
                             <CardTitle>تخصيص قالب واتساب</CardTitle>
                              <CardDescription className="pt-1">تعديل الرسالة الافتراضية التي يرسلها المندوب للعملاء.</CardDescription>
                         </WebA>
                    </AccordionTrigger>
                    <AccordionContent className="p-6 pt-0">
                        <WhatsAppTemplateForm settings={settings} onSave={handleSaveSettings} />
                    </AccordionContent>
                </Card>
            </AccordionItem>

        </Accordion>
      
       <AlertDialog open={!!deletingGovernorate} onOpenChange={(open) => !open && setDeletingGovernorate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>هل تريد حذف محافظة "{deletingGovernorate?.name}"؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGovernorate} className="bg-destructive hover:bg-destructive/80">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

    