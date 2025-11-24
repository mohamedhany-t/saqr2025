
"use client";
import React, { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import type { Governorate } from '@/lib/types';
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
import { Loader2, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const governorateSchema = z.object({
  name: z.string().min(1, 'اسم المحافظة مطلوب'),
});

const GovernorateForm = ({ onSave, governorate, onOpenChange }: { onSave: (name: string, id?: string) => void, governorate?: Governorate, onOpenChange: (open: boolean) => void }) => {
  const form = useForm<z.infer<typeof governorateSchema>>({
    resolver: zodResolver(governorateSchema),
    defaultValues: { name: governorate?.name || '' },
  });

  const onSubmit = (values: z.infer<typeof governorateSchema>) => {
    onSave(values.name, governorate?.id);
  };
  
  React.useEffect(() => {
    form.reset({ name: governorate?.name || '' });
  }, [governorate, form]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <DialogHeader>
          <DialogTitle>{governorate ? 'تعديل محافظة' : 'إضافة محافظة جديدة'}</DialogTitle>
          <DialogDescription>
            {governorate ? 'قم بتغيير اسم المحافظة.' : 'أدخل اسم المحافظة الجديدة.'}
          </DialogDescription>
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
            <DialogClose asChild>
                <Button type="button" variant="outline">إلغاء</Button>
            </DialogClose>
            <Button type="submit">حفظ</Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export function SettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const governoratesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]);
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGovernorate, setEditingGovernorate] = useState<Governorate | undefined>(undefined);
  const [deletingGovernorate, setDeletingGovernorate] = useState<Governorate | null>(null);


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
      setIsFormOpen(false);
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

  const openFormForNew = () => {
    setEditingGovernorate(undefined);
    setIsFormOpen(true);
  };
  
  const openFormForEdit = (gov: Governorate) => {
    setEditingGovernorate(gov);
    setIsFormOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
            <div>
                <CardTitle>إدارة المحافظات</CardTitle>
                <CardDescription>إضافة، تعديل، وحذف المحافظات المستخدمة في النظام.</CardDescription>
            </div>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                 <DialogTrigger asChild>
                    <Button onClick={openFormForNew}>
                        <PlusCircle className="me-2 h-4 w-4" />
                        إضافة محافظة
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <GovernorateForm onSave={handleSaveGovernorate} governorate={editingGovernorate} onOpenChange={setIsFormOpen} />
                </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم المحافظة</TableHead>
                <TableHead className="text-left w-[100px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {governoratesLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
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
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openFormForEdit(gov)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingGovernorate(gov)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center h-24">لا توجد محافظات.</TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

       <AlertDialog open={!!deletingGovernorate} onOpenChange={(open) => !open && setDeletingGovernorate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف محافظة "{deletingGovernorate?.name}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
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
