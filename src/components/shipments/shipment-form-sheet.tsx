

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
import type { Shipment, ShipmentStatus, Governorate, Company, Courier, Role, User, CustomStatus } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '../ui/textarea';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

const shipmentSchema = z.object({
  shipmentCode: z.string().optional(),
  senderName: z.string().optional(),
  orderNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  recipientName: z.string().min(1, "اسم المرسل إليه مطلوب"),
  recipientPhone: z.string().min(10, "رقم هاتف المستلم غير صحيح"),
  governorateId: z.string().optional(),
  address: z.string().min(1, "العنوان مطلوب"),
  totalAmount: z.coerce.number().min(0, "المبلغ يجب أن يكون إيجابي"),
  paidAmount: z.coerce.number().optional(),
  status: z.string().min(1, "الحالة مطلوبة"),
  reason: z.string().optional(),
  deliveryDate: z.date().optional(),
  assignedCourierId: z.string().optional(),
  companyId: z.string().optional(),
  collectedAmount: z.coerce.number().optional(),
  courierCommission: z.coerce.number().optional(),
  companyCommission: z.coerce.number().optional(),
}).superRefine((data, ctx) => {
    if ((data.status === "Partially Delivered" || data.status === "Refused (Paid)") && (data.collectedAmount === undefined || data.collectedAmount <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "المبلغ المحصّل مطلوب في هذه الحالة",
            path: ["collectedAmount"],
        });
    }
});


type ShipmentFormSheetProps = {
    children?: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shipment?: Shipment;
    onSave: (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => void;
    governorates: Governorate[];
    couriers: User[];
    companies?: Company[];
    role: Role | null;
}

export function ShipmentFormSheet({ children, open, onOpenChange, shipment, onSave, governorates, couriers, companies, role }: ShipmentFormSheetProps) {
  const isEditing = !!shipment;
  const isCourier = role === 'courier';
  const isAdmin = role === 'admin';
  const isCompany = role === 'company';
  const firestore = useFirestore();

  const customStatusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'custom_statuses');
  }, [firestore]);
  const { data: customStatuses } = useCollection<CustomStatus>(customStatusesQuery);

  const form = useForm<z.infer<typeof shipmentSchema>>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {},
  });
  
  React.useEffect(() => {
    if (open) {
      if (isEditing && shipment) {
        const defaultValues = {
          ...shipment,
          deliveryDate: shipment.deliveryDate ? (shipment.deliveryDate as any).toDate() : undefined,
          collectedAmount: shipment.collectedAmount ?? 0,
          paidAmount: shipment.paidAmount ?? 0,
          totalAmount: shipment.totalAmount ?? 0,
          reason: shipment.reason ?? '',
          assignedCourierId: shipment.assignedCourierId ?? '',
        };
        form.reset(defaultValues as any);
      } else {
        const defaultValues = {
          senderName: "",
          orderNumber: "",
          trackingNumber: "",
          recipientName: "",
          recipientPhone: "",
          governorateId: "",
          address: "",
          totalAmount: 0,
          paidAmount: 0,
          status: "Pending",
          reason: "",
          collectedAmount: 0,
          assignedCourierId: "",
          shipmentCode: `SH-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        };
        form.reset(defaultValues);
      }
    }
  }, [open, shipment, isEditing, form, role]);


  const onSubmit = (values: z.infer<typeof shipmentSchema>) => {
    onSave(values, shipment?.id);
  };
  
  const selectedStatus = form.watch("status");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {children && <SheetTrigger asChild>
        {children}
      </SheetTrigger>}
      <SheetContent className="sm:max-w-2xl" dir="rtl">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                <SheetHeader>
                <SheetTitle>{isEditing ? "تعديل شحنة" : "إضافة شحنة جديدة"}</SheetTitle>
                <SheetDescription>
                    {isCourier ? "قم بتحديث حالة الشحنة." : isEditing ? "قم بتحديث تفاصيل الشحنة هنا." : "أدخل تفاصيل الشحنة الجديدة ليتم إنشاؤها."}
                </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6 mr-[-1.5rem] pl-6">
                    {(isAdmin || isCompany) && <FormField
                        control={form.control}
                        name="shipmentCode"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">كود الشحنة</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />}
                    {(isAdmin || isCompany) && <FormField
                        control={form.control}
                        name="senderName"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الراسل</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled={isCourier} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />}
                    <FormField
                        control={form.control}
                        name="recipientName"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المرسل اليه</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled={isCourier} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="recipientPhone"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">تليفون المستلم</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled={isCourier} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">العنوان</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled={isCourier} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="governorateId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المحافظة</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value} disabled={isCourier}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر المحافظة" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {governorates.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="totalAmount"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الإجمالي</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input type="number" {...field} disabled={isCourier} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                    {isAdmin && companies && companies.length > 0 && <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الشركة</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الشركة" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />}
                     {(isAdmin || isCompany) && <FormField
                        control={form.control}
                        name="assignedCourierId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المندوب</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر المندوب" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />}
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الحالة</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الحالة" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Pending">قيد الانتظار</SelectItem>
                                        <SelectItem value="In-Transit">قيد التوصيل</SelectItem>
                                        <SelectItem value="Delivered">تم التسليم</SelectItem>
                                        <SelectItem value="Partially Delivered">تم التسليم جزئياً</SelectItem>
                                        <SelectItem value="Postponed">مؤجل</SelectItem>
                                        <SelectItem value="Returned">مرتجع</SelectItem>
                                        <SelectItem value="Returned to Warehouse">تم الرجوع للمخزن</SelectItem>
                                        <SelectItem value="Returned to Sender">تم الرجوع للراسل</SelectItem>
                                        <SelectItem value="Refused (Paid)">رفض ودفع مصاريف شحن</SelectItem>
                                        <SelectItem value="Refused (Unpaid)">رفض ولم يدفع مصاريف شحن</SelectItem>
                                        <SelectItem value="Evasion (Phone)">تهرب هاتفيًا</SelectItem>
                                        <SelectItem value="Evasion (Delivery Attempt)">تهرب بعد الوصول</SelectItem>
                                        <SelectItem value="Cancelled">تم الإلغاء</SelectItem>
                                        {customStatuses?.map(status => (
                                            <SelectItem key={status.id} value={status.name}>{status.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                    {isCourier && (selectedStatus === 'Partially Delivered' || selectedStatus === 'Refused (Paid)') && (
                        <FormField
                            control={form.control}
                            name="collectedAmount"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">المبلغ المحصّل</FormLabel>
                                    <FormControl className="col-span-3">
                                        <Input type="number" {...field} placeholder="أدخل المبلغ المحصل" value={field.value ?? 0} />
                                    </FormControl>
                                    <FormMessage className="col-span-4" />
                                </FormItem>
                            )}
                        />
                    )}
                     <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">السبب</FormLabel>
                                <FormControl className="col-span-3">
                                    <Textarea {...field} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                     {(isAdmin || isCompany) && <FormField
                        control={form.control}
                        name="orderNumber"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">رقم الطلب</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />}
                    {(isAdmin || isCompany) && <FormField
                        control={form.control}
                        name="trackingNumber"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">رقم الشحنة</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />}
                </div>
                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="outline">إلغاء</Button>
                    </SheetClose>
                    <Button type="submit">حفظ التغييرات</Button>
                </SheetFooter>
            </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
