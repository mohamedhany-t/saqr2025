
"use client";

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import type { Expense, User, ExpenseCategory } from '@/lib/types';
import { expenseCategories, expenseEntities } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const expenseSchema = z.object({
  description: z.string().min(1, "الوصف مطلوب"),
  amount: z.coerce.number().min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
  category: z.enum(Object.keys(expenseCategories) as [ExpenseCategory, ...ExpenseCategory[]]),
  entityType: z.enum(Object.keys(expenseEntities) as [keyof typeof expenseEntities]),
  relatedUserId: z.string().optional(),
  expenseDate: z.date(),
  notes: z.string().optional(),
  // receiptImageUrl: z.string().optional(), // File upload can be added later
}).refine(data => {
    if (data.entityType === 'courier' && !data.relatedUserId) {
        return false;
    }
    return true;
}, {
    message: "يجب اختيار مندوب عند تحديد الجهة كمندوب",
    path: ["relatedUserId"],
});

type ExpenseFormSheetProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    expense?: Expense;
    onSave: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>, id?: string) => void;
    couriers: User[];
}

export function ExpenseFormSheet({ open, onOpenChange, expense, onSave, couriers }: ExpenseFormSheetProps) {
  const isEditing = !!expense;

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
        description: "",
        amount: 0,
        category: 'transport',
        entityType: 'general',
        expenseDate: new Date(),
    },
  });

  React.useEffect(() => {
    if (open) {
      if (isEditing && expense) {
        // Handle both JS Date and Firestore Timestamp objects for expenseDate
        const expenseDateObject = expense.expenseDate instanceof Date
            ? expense.expenseDate
            : expense.expenseDate?.toDate?.() || new Date();
            
        form.reset({
          ...expense,
          expenseDate: expenseDateObject,
        });
      } else {
        form.reset({
            description: "",
            amount: 0,
            category: 'transport',
            entityType: 'general',
            relatedUserId: undefined,
            expenseDate: new Date(),
            notes: "",
        });
      }
    }
  }, [open, expense, isEditing, form]);

  const onSubmit = (values: z.infer<typeof expenseSchema>) => {
    onSave(values, expense?.id);
  };

  const entityType = form.watch('entityType');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md" dir="rtl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <SheetHeader>
              <SheetTitle>{isEditing ? "تعديل مصروف" : "إضافة مصروف جديد"}</SheetTitle>
              <SheetDescription>
                {isEditing ? "قم بتحديث تفاصيل المصروف." : "أدخل تفاصيل المصروف الجديد."}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6 mr-[-1.5rem] pl-6">
               <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">التاريخ</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl className="col-span-3">
                                    <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-right font-normal", !field.value && "text-muted-foreground")}
                                    >
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP", {locale: ar}) : <span>اختر تاريخ</span>}
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                         <FormMessage className="col-span-3 col-start-2" />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="entityType"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">الجهة/الشخص</FormLabel>
                        <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                            <FormControl className="col-span-3">
                                <SelectTrigger><SelectValue placeholder="اختر الجهة" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Object.entries(expenseEntities).map(([key, value]) => (
                                    <SelectItem key={key} value={key as keyof typeof expenseEntities}>{value}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage className="col-span-3 col-start-2" />
                        </FormItem>
                    )}
                />
                {entityType === 'courier' && (
                     <FormField
                        control={form.control}
                        name="relatedUserId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">اسم المندوب</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-3 col-start-2" />
                            </FormItem>
                        )}
                    />
                )}
                 <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">نوع المصروف</FormLabel>
                        <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                            <FormControl className="col-span-3">
                                <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Object.entries(expenseCategories).map(([key, value]) => (
                                    <SelectItem key={key} value={key as ExpenseCategory}>{value}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage className="col-span-3 col-start-2" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">قيمة المصروف</FormLabel>
                        <FormControl className="col-span-3">
                            <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage className="col-span-3 col-start-2" />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-4 items-center gap-4">
                        <FormLabel className="text-right">الوصف</FormLabel>
                        <FormControl className="col-span-3">
                            <Input {...field} />
                        </FormControl>
                        <FormMessage className="col-span-3 col-start-2" />
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
                            <Textarea {...field} placeholder="ملاحظات إضافية (اختياري)"/>
                        </FormControl>
                        <FormMessage className="col-span-3 col-start-2" />
                        </FormItem>
                    )}
                />
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">إلغاء</Button>
              </SheetClose>
              <Button type="submit">حفظ</Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
