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
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Shipment, ShipmentStatus, Governorate, Company, SubClient, Courier, Role } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { Textarea } from '../ui/textarea';

const shipmentSchema = z.object({
  shipmentCode: z.string().optional(),
  orderNumber: z.string().min(1, "رقم الطلب مطلوب"),
  trackingNumber: z.string().optional(),
  recipientName: z.string().min(1, "اسم المرسل إليه مطلوب"),
  recipientPhone: z.string().min(10, "رقم هاتف المستلم غير صحيح"),
  governorateId: z.string().min(1, "المحافظة مطلوبة"),
  address: z.string().min(1, "العنوان مطلوب"),
  totalAmount: z.coerce.number().min(0, "المبلغ يجب أن يكون إيجابي"),
  paidAmount: z.coerce.number().optional(),
  status: z.enum(["Pending", "In-Transit", "Delivered", "Cancelled", "Returned"]),
  companyId: z.string().min(1, "الشركة مطلوبة"),
  subClientId: z.string().optional().nullable(),
  reason: z.string().optional(),
  deliveryDate: z.date().optional(),
  assignedCourierId: z.string().optional(),
});


type ShipmentFormSheetProps = {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shipment?: Shipment;
    onSave: (data: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => void;
    governorates: Governorate[];
    companies: Company[];
    subClients: SubClient[];
    couriers: Courier[];
    role: Role | null;
}

export function ShipmentFormSheet({ children, open, onOpenChange, shipment, onSave, governorates, companies, subClients, couriers, role }: ShipmentFormSheetProps) {
  const isEditing = !!shipment;
  const isCourier = role === 'courier';

  const form = useForm<z.infer<typeof shipmentSchema>>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: isEditing ? shipment : {
      orderNumber: "",
      trackingNumber: "",
      recipientName: "",
      recipientPhone: "",
      governorateId: "",
      address: "",
      totalAmount: 0,
      paidAmount: 0,
      status: "Pending",
      companyId: "",
      subClientId: null,
      shipmentCode: `SH-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    },
  });
  
  React.useEffect(() => {
    if (open) {
        const defaultValues = isEditing ? { 
          ...shipment,
          deliveryDate: shipment.deliveryDate ? (shipment.deliveryDate as any).toDate() : undefined,
         } : {
            orderNumber: "",
            trackingNumber: "",
            recipientName: "",
            recipientPhone: "",
            governorateId: "",
            address: "",
            totalAmount: 0,
            paidAmount: 0,
            status: "Pending",
            companyId: "",
            subClientId: null,
            shipmentCode: `SH-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        };
        form.reset(defaultValues as any);
    }
  }, [open, shipment, form, isEditing]);

  const onSubmit = (values: z.infer<typeof shipmentSchema>) => {
    const dataToSave = Object.fromEntries(
        Object.entries(values).filter(([_, v]) => v !== undefined)
    );
    onSave(dataToSave as Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>, shipment?.id);
  };
  
  const selectedCompanyId = form.watch("companyId");
  const filteredSubClients = subClients.filter(sc => sc.companyId === selectedCompanyId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl" dir="rtl">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                <SheetHeader>
                <SheetTitle>{isEditing ? "تعديل شحنة" : "إضافة شحنة جديدة"}</SheetTitle>
                <SheetDescription>
                    {isEditing ? "قم بتحديث تفاصيل الشحنة هنا." : "أدخل تفاصيل الشحنة الجديدة ليتم إنشاؤها."}
                </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6">
                    {/* Form Fields */}
                     <FormField
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
                    />
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
                    <FormField
                        control={form.control}
                        name="companyId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الشركة</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value} disabled={isCourier}>
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
                    />
                    {filteredSubClients.length > 0 && (
                        <FormField
                            control={form.control}
                            name="subClientId"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">العميل الفرعي</FormLabel>
                                    <Select dir="rtl" onValueChange={field.onChange} value={field.value || ''} disabled={isCourier}>
                                        <FormControl className="col-span-3">
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر العميل الفرعي" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {filteredSubClients.map(sc => <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage className="col-span-4" />
                                </FormItem>
                            )}
                        />
                    )}
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
                                        <SelectItem value="Delivered">تم التوصيل</SelectItem>
                                        <SelectItem value="Cancelled">تم الإلغاء</SelectItem>
                                        <SelectItem value="Returned">مرتجع</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
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
                    <FormField
                        control={form.control}
                        name="orderNumber"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">رقم الطلب</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled={isCourier} />
                                </FormControl>
                                <FormMessage className="col-span-4" />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="trackingNumber"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">رقم الشحنة</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled={isCourier} />
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
                    <Button type="submit">حفظ التغييرات</Button>
                </SheetFooter>
            </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
