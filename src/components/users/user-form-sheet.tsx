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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Company, Role } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const userSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
  role: z.enum(["company", "courier"], { required_error: "الدور مطلوب" }),
  companyId: z.string().optional(),
  deliveryCompanyId: z.string().optional(),
}).refine(data => data.role !== 'company' || !!data.companyId, {
    message: "يجب اختيار شركة العميل",
    path: ["companyId"],
}).refine(data => data.role !== 'courier' || !!data.deliveryCompanyId, {
    message: "يجب اختيار شركة التوصيل",
    path: ["deliveryCompanyId"],
});


type UserFormSheetProps = {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: z.infer<typeof userSchema>) => void;
    companies: Company[];
    deliveryCompanies: Company[];
}

export function UserFormSheet({ children, open, onOpenChange, onSave, companies, deliveryCompanies }: UserFormSheetProps) {
  
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });
  
  React.useEffect(() => {
    if (open) {
        form.reset();
    }
  }, [open, form]);

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    onSave(values);
  };
  
  const selectedRole = form.watch("role");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="sm:max-w-md" dir="rtl">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                <SheetHeader>
                    <SheetTitle>إضافة مستخدم جديد</SheetTitle>
                    <SheetDescription>
                        أدخل تفاصيل المستخدم الجديد ودوره في النظام.
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6">
                    {/* Form Fields */}
                     <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الاسم</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">البريد الإلكتروني</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input type="email" {...field} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">كلمة المرور</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input type="password" {...field} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الدور</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الدور" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="company">شركة</SelectItem>
                                        <SelectItem value="courier">مندوب</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     {selectedRole === 'company' && (
                        <FormField
                            control={form.control}
                            name="companyId"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">الشركة</FormLabel>
                                    <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                        <FormControl className="col-span-3">
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر شركة العميل" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="col-span-4" />
                                </FormItem>
                            )}
                        />
                     )}
                     {selectedRole === 'courier' && (
                        <FormField
                            control={form.control}
                            name="deliveryCompanyId"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">شركة التوصيل</FormLabel>
                                    <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                        <FormControl className="col-span-3">
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر شركة التوصيل" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {deliveryCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="col-span-4" />
                                </FormItem>
                            )}
                        />
                     )}
                </div>
                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="outline">إلغاء</Button>
                    </SheetClose>
                    <Button type="submit">إنشاء مستخدم</Button>
                </SheetFooter>
            </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
