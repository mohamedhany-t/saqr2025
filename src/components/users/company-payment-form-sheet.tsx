
"use client"

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Company, CompanyPayment } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '../ui/textarea';

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
  notes: z.string().optional(),
});

type CompanyPaymentFormSheetProps = {
    children?: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company?: Company;
    payment?: CompanyPayment;
    onSave: (data: {amount: number; notes?: string}, paymentId?: string) => void;
    netDue?: number;
}

export function CompanyPaymentFormSheet({ children, open, onOpenChange, company, payment, onSave, netDue }: CompanyPaymentFormSheetProps) {
  const isEditing = !!payment;

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
        amount: 0,
        notes: "",
    },
  });
  
  React.useEffect(() => {
    if (open) {
      if(isEditing && payment) {
        form.reset({
          amount: payment.amount ?? 0,
          notes: payment.notes ?? "",
        });
      } else {
        form.reset({
          amount: netDue && netDue > 0 ? netDue : 0,
          notes: "",
        });
      }
    }
  }, [open, form, isEditing, payment, netDue]);


  const onSubmit = (values: z.infer<typeof paymentSchema>) => {
    onSave(values, payment?.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>
        {children}
      </SheetTrigger>}
      <SheetContent className="sm:max-w-md" dir="rtl">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                <SheetHeader>
                <SheetTitle>{isEditing ? `تعديل دفعة لـ: ${company?.name}` : `تسوية حساب: ${company?.name}`}</SheetTitle>
                <SheetDescription>
                    {isEditing ? "قم بتعديل تفاصيل الدفعة." : "أدخل المبلغ الذي تم دفعه للشركة لتسوية حسابها."}
                </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6 mr-[-1.5rem] pl-6">
                    {netDue !== undefined && (
                        <div className="p-3 bg-muted/80 rounded-lg text-sm">
                            <span className="text-muted-foreground">المبلغ المستحق للدفع حالياً: </span>
                            <span className={`font-bold ${netDue > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                {netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                            </span>
                        </div>
                    )}
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المبلغ المدفوع</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">ملاحظات</FormLabel>
                                <FormControl className="col-span-3">
                                    <Textarea {...field} placeholder="ملاحظات حول عملية الدفع (اختياري)" />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                </div>
                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="outline">إلغاء</Button>
                    </SheetClose>
                    <Button type="submit">{isEditing ? 'حفظ التعديلات' : 'حفظ الدفعة'}</Button>
                </SheetFooter>
            </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
