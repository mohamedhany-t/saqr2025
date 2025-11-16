
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Company, User } from '@/lib/types';

// Schema for user creation/editing
const userSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().optional(),
  role: z.enum(["company", "courier", "admin"], { required_error: "الدور مطلوب" }),
  companyName: z.string().optional(),
  deliveryCompanyId: z.string().optional(),
  commissionRate: z.coerce.number().optional().default(0),
});


type UserFormSheetProps = {
    children?: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: z.infer<typeof userSchema>, userId?: string) => void;
    user?: User; // Make user optional for creating vs. editing
    deliveryCompanies: Company[];
}

export function UserFormSheet({ children, open, onOpenChange, onSave, user, deliveryCompanies }: UserFormSheetProps) {
  const isEditing = !!user;

    const formSchemaForMode = userSchema.superRefine((data, ctx) => {
        if (!isEditing && (!data.password || data.password.length < 6)) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
                path: ["password"],
            });
        }
        if (data.role === 'company' && (!data.companyName || data.companyName.trim().length === 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "اسم الشركة مطلوب عند اختيار دور 'شركة'",
                path: ["companyName"],
            });
        }
    });


  const form = useForm<z.infer<typeof formSchemaForMode>>({
    resolver: zodResolver(formSchemaForMode),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      companyName: "",
      deliveryCompanyId: "",
      commissionRate: 0,
    },
  });
  
  React.useEffect(() => {
    if (open) {
      if (isEditing) {
        form.reset({
          name: user.name || '',
          email: user.email,
          role: user.role,
          companyName: user.companyName || '',
          commissionRate: user.commissionRate || 0,
          deliveryCompanyId: user.deliveryCompanyId || '',
        });
      } else {
        form.reset({
          name: "",
          email: "",
          password: "",
          role: undefined,
          companyName: "",
          deliveryCompanyId: "",
          commissionRate: 0,
        });
      }
    }
  }, [open, user, isEditing, form]);

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    onSave(values, user?.id);
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
                    <SheetTitle>{isEditing ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</SheetTitle>
                    <SheetDescription>
                        {isEditing ? "قم بتحديث بيانات المستخدم." : "أدخل تفاصيل المستخدم الجديد ودوره في النظام."}
                    </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6">
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
                                    <Input type="email" {...field} disabled={isEditing} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     {!isEditing && <FormField
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
                    />}
                     <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الدور</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value} disabled={isEditing}>
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
                            name="companyName"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">اسم الشركة</FormLabel>
                                    <FormControl className="col-span-3">
                                        <Input {...field} placeholder="ادخل اسم شركة العميل"/>
                                    </FormControl>
                                    <FormMessage className="col-span-4" />
                                </FormItem>
                            )}
                        />
                     )}
                     {selectedRole === 'courier' && (
                        <>
                            <FormField
                                control={form.control}
                                name="deliveryCompanyId"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">شركة التوصيل</FormLabel>
                                    <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                        <FormControl className="col-span-3">
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر شركة التوصيل (اختياري)" />
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
                             <FormField
                                control={form.control}
                                name="commissionRate"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-4 items-center gap-4">
                                        <FormLabel className="text-right">عمولة التوصيل</FormLabel>
                                        <FormControl className="col-span-3">
                                            <Input type="number" {...field} placeholder="عمولة ثابتة لكل توصيلة"/>
                                        </FormControl>
                                        <FormMessage className="col-span-4" />
                                    </FormItem>
                                )}
                            />
                        </>
                     )}
                </div>
                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="outline">إلغاء</Button>
                    </SheetClose>
                    <Button type="submit">{isEditing ? "حفظ التعديلات" : "إنشاء مستخدم"}</Button>
                </SheetFooter>
            </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
