
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
import type { User, CourierPayment } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '../ui/textarea';

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
  notes: z.string().optional(),
});

type CourierPaymentFormSheetProps = {
    children?: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    courier?: User;
    payment?: CourierPayment;
    onSave: (data: {amount: number; notes?: string}, paymentId?: string) => void;
    netDue?: number;
}

export function CourierPaymentFormSheet({ children, open, onOpenChange, courier, payment, onSave, netDue }: CourierPaymentFormSheetProps) {
  const isEditing = !!payment;

  const formSchemaForMode = paymentSchema.superRefine((data, ctx) => {
    if (netDue !== undefined && !isEditing && data.amount > netDue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `المبلغ المدفوع لا يمكن أن يكون أكبر من المبلغ المستحق (${netDue.toLocaleString('ar-EG', {style: 'currency', currency: 'EGP'})})`,
        path: ["amount"],
      });
    }
  });

  const form = useForm<z.infer<typeof formSchemaForMode>>({
    resolver: zodResolver(formSchemaForMode),
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
                <SheetTitle>{isEditing ? `تعديل دفعة لـ: ${courier?.name}` : `تسوية حساب: ${courier?.name}`}</SheetTitle>
                <SheetDescription>
                    {isEditing ? "قم بتعديل تفاصيل الدفعة." : "أدخل المبلغ الذي تم استلامه من المندوب لتسوية حسابه."}
                </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6 mr-[-1.5rem] pl-6">
                    {!isEditing && netDue !== undefined && (
                        <div className="p-3 bg-muted/80 rounded-lg text-sm">
                            <span className="text-muted-foreground">المبلغ المستحق حالياً: </span>
                            <span className={`font-bold ${netDue > 0 ? 'text-destructive' : 'text-green-600'}`}>
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
