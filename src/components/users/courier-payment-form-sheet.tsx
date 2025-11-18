
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
    onSave: (data: {amount: number; notes?: string}) => void;
}

export function CourierPaymentFormSheet({ children, open, onOpenChange, courier, onSave }: CourierPaymentFormSheetProps) {
  
  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
        amount: 0,
        notes: "",
    },
  });
  
  React.useEffect(() => {
    if (open) {
      form.reset({
        amount: 0,
        notes: "",
      });
    }
  }, [open, form]);


  const onSubmit = (values: z.infer<typeof paymentSchema>) => {
    onSave(values);
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
                <SheetTitle>تسوية حساب المندوب: {courier?.name}</SheetTitle>
                <SheetDescription>
                    أدخل المبلغ الذي تم استلامه من المندوب لتسوية حسابه.
                </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6 mr-[-1.5rem] pl-6">
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المبلغ المدفوع</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input type="number" {...field} placeholder="0.00" />
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
                    <Button type="submit">حفظ الدفعة</Button>
                </SheetFooter>
            </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
