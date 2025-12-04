

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
import type { Company, Governorate, User } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

// Schema for user creation/editing
const baseUserSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  phone: z.string().optional(),
  password: z.string().optional(),
  role: z.enum(["courier", "admin", "company", "customer-service"], { required_error: "الدور مطلوب" }),
  commissionRate: z.coerce.number().optional(),
  governorateCommissions: z.record(z.coerce.number().optional()).optional(),
});


type UserFormSheetProps = {
    children?: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: z.infer<typeof baseUserSchema>, userId?: string) => void;
    user?: User;
    companyDetails?: Company;
}

export function UserFormSheet({ children, open, onOpenChange, onSave, user, companyDetails }: UserFormSheetProps) {
  const isEditing = !!user;
  const firestore = useFirestore();

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'governorates');
  }, [firestore]);
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

  const formSchemaForMode = baseUserSchema.superRefine((data, ctx) => {
      if (!isEditing && (!data.password || data.password.length < 6)) {
           ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
              path: ["password"],
          });
      }
      // When editing, password is optional, but if provided, it must be valid
      if (isEditing && data.password && data.password.length > 0 && data.password.length < 6) {
           ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",
              path: ["password"],
          });
      }
      if (data.role === 'company' && !data.name) {
           ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "اسم الشركة مطلوب",
              path: ["name"],
          });
      }
  });


  const form = useForm<z.infer<typeof formSchemaForMode>>({
    resolver: zodResolver(formSchemaForMode),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      role: 'courier',
      commissionRate: 0,
      governorateCommissions: {},
    },
  });
  

  React.useEffect(() => {
    if (open) {
      if (isEditing && user) {
        form.reset({
          name: user.name ?? '',
          email: user.email ?? '',
          phone: user.phone ?? '',
          role: user.role ?? 'courier',
          password: "", // Always reset password field
          commissionRate: user.commissionRate ?? 0,
          governorateCommissions: companyDetails?.governorateCommissions ?? {},
        });
      } else {
        form.reset({
          name: "",
          email: "",
          phone: "",
          password: "",
          role: 'courier',
          commissionRate: 0,
          governorateCommissions: {},
        });
      }
    }
  }, [open, user, isEditing, form, companyDetails]);

  const onSubmit = (values: z.infer<typeof baseUserSchema>) => {
    // Filter out empty/zero values from governorateCommissions before saving
    if (values.governorateCommissions) {
        const cleanCommissions: { [key: string]: number } = {};
        for (const [key, value] of Object.entries(values.governorateCommissions)) {
            if (value !== undefined && value > 0) {
                cleanCommissions[key] = value;
            }
        }
        values.governorateCommissions = cleanCommissions;
    }
    onSave(values, user?.id);
  };
  
  const selectedRole = form.watch("role");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>
        {children}
      </SheetTrigger>}
      <SheetContent className="sm:max-w-2xl" dir="rtl">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                <SheetHeader>
                    <SheetTitle>{isEditing ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</SheetTitle>
                    <SheetDescription>
                        {isEditing ? "قم بتحديث بيانات المستخدم. اترك كلمة المرور فارغة لعدم تغييرها." : "أدخل تفاصيل المستخدم الجديد ودوره في النظام."}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 -mr-6">
                <div className="grid gap-4 py-4 pr-6 pl-6">
                     <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">{selectedRole === 'company' ? 'اسم الشركة' : 'الاسم'}</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} value={field.value ?? ''}/>
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
                                    <Input type="email" {...field} disabled={isEditing} value={field.value ?? ''}/>
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">رقم الهاتف</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input type="tel" {...field} value={field.value ?? ''} />
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
                                <FormLabel className="text-right">{isEditing ? "كلمة المرور الجديدة" : "كلمة المرور"}</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input type="password" {...field} placeholder={isEditing ? 'اتركه فارغاً لعدم التغيير' : ''} value={field.value ?? ''}/>
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
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الدور" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="courier">مندوب</SelectItem>
                                        <SelectItem value="company">شركة شحن</SelectItem>
                                        <SelectItem value="customer-service">خدمة عملاء</SelectItem>
                                        <SelectItem value="admin">مسؤول</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     {selectedRole === 'courier' && (
                         <FormField
                            control={form.control}
                            name="commissionRate"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">عمولة التوصيل</FormLabel>
                                    <FormControl className="col-span-3">
                                        <Input type="number" {...field} placeholder="عمولة ثابتة لكل توصيلة" value={field.value ?? 0}/>
                                    </FormControl>
                                    <FormMessage className="col-span-4" />
                                </FormItem>
                            )}
                        />
                     )}
                     {selectedRole === 'company' && (
                        <div className="col-span-4">
                            <h4 className="font-medium text-lg mb-2">عمولات المحافظات</h4>
                            <div className="space-y-3">
                            {governoratesLoading && <p>جاري تحميل المحافظات...</p>}
                            {governorates?.map(gov => (
                                <FormField
                                    key={gov.id}
                                    control={form.control}
                                    name={`governorateCommissions.${gov.id}` as const}
                                    render={({ field }) => (
                                        <FormItem className="grid grid-cols-4 items-center gap-4">
                                            <FormLabel className="text-right">{gov.name}</FormLabel>
                                            <FormControl className="col-span-3">
                                                <Input 
                                                    type="number" 
                                                    {...field} 
                                                    placeholder="أدخل العمولة" 
                                                    value={field.value || ''}
                                                    onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            ))}
                            </div>
                        </div>
                     )}
                </div>
                </ScrollArea>
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
