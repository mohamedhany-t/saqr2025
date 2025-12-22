

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
import type { Shipment, Governorate, Company, Role, User, ShipmentStatusConfig } from '@/lib/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { RefreshCw } from 'lucide-react';

const shipmentSchema = z.object({
  shipmentCode: z.string().optional(),
  senderName: z.string().optional(),
  orderNumber: z.string().optional(),
  recipientName: z.string().min(1, "اسم المرسل إليه مطلوب"),
  recipientPhone: z.string().optional(), // Made optional
  governorateId: z.string().optional(),
  address: z.string().min(1, "العنوان مطلوب"),
  totalAmount: z.coerce.number().min(0, "المبلغ يجب أن يكون إيجابي"),
  paidAmount: z.coerce.number().optional(),
  status: z.string(), // Changed to string to accept any status
  reason: z.string().optional(),
  deliveryDate: z.date().optional(),
  assignedCourierId: z.string().optional(),
  companyId: z.string().optional(),
  collectedAmount: z.coerce.number().optional(),
  requestedAmount: z.coerce.number().optional(),
  amountChangeReason: z.string().optional(),
  courierCommission: z.coerce.number().optional(),
  companyCommission: z.coerce.number().optional(),
  isWarehouseReturn: z.boolean().optional(),
  isReturningToCompany: z.boolean().optional(),
  isReturnedToCompany: z.boolean().optional(),
  isExchange: z.boolean().optional(),
  isUrgent: z.boolean().optional(),
  isCustomReturn: z.boolean().optional(),
  retryAttempt: z.boolean().optional(),
  isLabelPrinted: z.boolean().optional(),
});

const cancellationReasons = [
    "عدم رد",
    "مغلق",
    "مشغول",
    "بريد صوتي",
    "رقم خطأ",
    "تهرب هاتفيا",
    "مكرر",
    "منطقه غير مخدومه",
    "تم الالغاء من طرف المستلم",
    "لم يطلب شئ",
];


type ShipmentFormSheetProps = {
    children?: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shipment?: Shipment;
    onSave: (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => void;
    governorates: Governorate[];
    couriers: User[];
    companies?: Company[];
    statuses: ShipmentStatusConfig[];
    role: Role | null;
}

const generateShipmentCode = () => {
    const date = new Date();
    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `SK-${dateString}-${randomNum}`;
};

export function ShipmentFormSheet({ children, open, onOpenChange, shipment, onSave, governorates, couriers, companies, statuses, role }: ShipmentFormSheetProps) {
  const isEditing = !!shipment;
  const isCourier = role === 'courier';
  const isAdmin = role === 'admin';
  const isCompany = role === 'company';
  const isCustomerService = role === 'customer-service';
  
  const formSchema = shipmentSchema.superRefine((data, ctx) => {
    const selectedStatusConfig = statuses.find(s => s.id === data.status);
    if (selectedStatusConfig?.requiresPartialCollection && (data.collectedAmount === undefined || isNaN(data.collectedAmount))) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "المبلغ المحصّل مطلوب في هذه الحالة",
            path: ["collectedAmount"],
        });
    }
     if (isCourier && data.status === 'PriceChangeRequested' && (data.requestedAmount === undefined || data.requestedAmount <= 0)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "السعر المقترح مطلوب ويجب أن يكون أكبر من صفر.",
            path: ["requestedAmount"],
        });
    }
  });


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recipientName: "",
      address: "",
      totalAmount: 0,
      status: "Pending",
      shipmentCode: undefined,
      senderName: undefined,
      orderNumber: undefined,
      recipientPhone: undefined,
      governorateId: undefined,
      paidAmount: undefined,
      reason: "",
      deliveryDate: undefined,
      assignedCourierId: undefined,
      companyId: undefined,
      collectedAmount: undefined,
      requestedAmount: undefined,
      amountChangeReason: "",
      courierCommission: undefined,
      companyCommission: undefined,
      isWarehouseReturn: false,
      isReturningToCompany: false,
      isReturnedToCompany: false,
      isExchange: false,
      isUrgent: false,
      isCustomReturn: false,
      retryAttempt: false,
      isLabelPrinted: false,
    },
  });
  
  React.useEffect(() => {
    if (open) {
      if (isEditing && shipment) {
        const deliveryDateValue = shipment.deliveryDate 
            ? (shipment.deliveryDate as any).toDate 
                ? (shipment.deliveryDate as any).toDate() 
                : new Date(shipment.deliveryDate)
            : undefined;

        form.reset({
          ...shipment,
          shipmentCode: shipment.shipmentCode ?? '',
          senderName: shipment.senderName ?? '',
          orderNumber: shipment.orderNumber ?? '',
          recipientName: shipment.recipientName ?? '',
          recipientPhone: shipment.recipientPhone ?? '',
          governorateId: shipment.governorateId ?? '',
          address: shipment.address ?? '',
          totalAmount: shipment.totalAmount ?? 0,
          paidAmount: shipment.paidAmount ?? 0,
          status: shipment.status ?? 'Pending',
          reason: shipment.reason ?? '',
          deliveryDate: deliveryDateValue,
          assignedCourierId: shipment.assignedCourierId ?? '',
          companyId: shipment.companyId ?? '',
          collectedAmount: shipment.collectedAmount ?? 0,
          requestedAmount: shipment.requestedAmount ?? undefined,
          amountChangeReason: shipment.amountChangeReason ?? '',
          courierCommission: shipment.courierCommission ?? 0,
          companyCommission: shipment.companyCommission ?? 0,
          isWarehouseReturn: shipment.isWarehouseReturn ?? false,
          isReturningToCompany: shipment.isReturningToCompany ?? false,
          isReturnedToCompany: shipment.isReturnedToCompany ?? false,
          isExchange: shipment.isExchange ?? false,
          isUrgent: shipment.isUrgent ?? false,
          isCustomReturn: shipment.isCustomReturn ?? false,
          retryAttempt: shipment.retryAttempt ?? false,
          isLabelPrinted: shipment.isLabelPrinted ?? false,
        });
      } else {
        form.reset({
          shipmentCode: generateShipmentCode(),
          senderName: "",
          orderNumber: "",
          recipientName: "",
          recipientPhone: "",
          governorateId: "",
          address: "",
          totalAmount: 0,
          paidAmount: 0,
          status: "Pending",
          reason: "",
          deliveryDate: undefined,
          assignedCourierId: "",
          companyId: "",
          collectedAmount: 0,
          requestedAmount: undefined,
          amountChangeReason: '',
          isWarehouseReturn: false,
          isReturningToCompany: false,
          isReturnedToCompany: false,
          isExchange: false,
          isUrgent: false,
          isCustomReturn: false,
          retryAttempt: false,
          isLabelPrinted: false,
        });
      }
    }
  }, [open, shipment, isEditing, form, role]);


  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onSave(values, shipment?.id);
  };
  
  const selectedStatus = form.watch("status");
  const selectedStatusConfig = statuses.find(s => s.id === selectedStatus);
  const isPriceChangeRequest = selectedStatus === 'PriceChangeRequested';
  const isCancelledStatus = selectedStatus === 'Cancelled';

  const courierAllowedStatuses = statuses.filter(s => {
    // General filters for courier
    if (isCourier) {
      if (!s.enabled || !s.visibleToCourier) return false;
      // Hide 'PriceChangeRejected' unless it's the current status
      if (s.id === 'PriceChangeRejected' && shipment?.status !== 'PriceChangeRejected') return false;
      // If the shipment is currently in 'PriceChangeRequested' state, only allow that status to be selected
      if (shipment?.status === 'PriceChangeRequested' && s.id !== 'PriceChangeRequested') return false;
    } else {
      // General filter for others (admin/company)
      if (!s.enabled) return false;
    }
    
    return true;
  });


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
                    {isCourier ? "قم بتحديث حالة الشحنة أو طلب تعديل السعر." : isEditing ? "قم بتحديث تفاصيل الشحنة هنا." : "أدخل تفاصيل الشحنة الجديدة ليتم إنشاؤها."}
                </SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-6 mr-[-1.5rem] pl-6">
                    <FormField
                        control={form.control}
                        name="recipientName"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المرسل اليه</FormLabel>
                                <FormControl className="col-span-3">
                                    <Input {...field} disabled={isCourier} />
                                </FormControl>
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
                                    <Input type="number" {...field} disabled={isCourier && !isPriceChangeRequest} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {(isAdmin || isCompany || isCustomerService) && <>
                      <FormField
                        control={form.control}
                        name="shipmentCode"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">كود الشحنة</FormLabel>
                                <div className="col-span-3 flex items-center gap-2">
                                  <FormControl>
                                      <Input {...field} />
                                  </FormControl>
                                  <Button type="button" variant="outline" size="icon" onClick={() => field.onChange(generateShipmentCode())}>
                                      <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </div>
                            </FormItem>
                        )}
                      />
                      <FormField
                          control={form.control}
                          name="senderName"
                          render={({ field }) => (
                              <FormItem className="grid grid-cols-4 items-center gap-4">
                                  <FormLabel className="text-right">الراسل</FormLabel>
                                  <FormControl className="col-span-3">
                                      <Input {...field} />
                                  </FormControl>
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
                                      <Input {...field} />
                                  </FormControl>
                              </FormItem>
                          )}
                      />
                      <FormField
                        control={form.control}
                        name="governorateId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المحافظة</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر المحافظة" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {governorates.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                      />
                    </>}

                    {isAdmin && (
                        <FormField
                            control={form.control}
                            name="paidAmount"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">المدفوع (يدوي)</FormLabel>
                                    <FormControl className="col-span-3">
                                        <Input type="number" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                    {(isAdmin || isCustomerService) && companies && companies.length > 0 && <FormField
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
                            </FormItem>
                        )}
                    />}
                     {(isAdmin || isCompany || isCustomerService) && <FormField
                        control={form.control}
                        name="assignedCourierId"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">المندوب</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر المندوب" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />}
                    
                    {/* Fields editable by everyone */}
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">الحالة</FormLabel>
                                <Select dir="rtl" onValueChange={field.onChange} value={field.value} disabled={isCourier && shipment?.status === 'PriceChangeRequested' && field.value === 'PriceChangeRequested'}>
                                    <FormControl className="col-span-3">
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الحالة" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {courierAllowedStatuses.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage className="col-span-3 col-start-2" />
                            </FormItem>
                        )}
                    />

                    {isPriceChangeRequest && (
                         <FormField
                            control={form.control}
                            name="requestedAmount"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">السعر المقترح</FormLabel>
                                    <FormControl className="col-span-3">
                                        <Input type="number" step="any" {...field} placeholder="أدخل السعر الجديد المقترح" value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage className="col-span-3 col-start-2" />
                                </FormItem>
                            )}
                        />
                    )}

                    {selectedStatusConfig?.requiresPartialCollection && (
                        <FormField
                            control={form.control}
                            name="collectedAmount"
                            render={({ field }) => (
                                <FormItem className="grid grid-cols-4 items-center gap-4">
                                    <FormLabel className="text-right">المبلغ المحصّل</FormLabel>
                                    <FormControl className="col-span-3">
                                        <Input type="number" step="any" {...field} placeholder="أدخل المبلغ المحصل (يمكن أن يكون سالبًا)" value={field.value ?? ''} />
                                    </FormControl>
                                    <FormMessage className="col-span-3 col-start-2" />
                                </FormItem>
                            )}
                        />
                    )}

                     <FormField
                        control={form.control}
                        name={isPriceChangeRequest ? "amountChangeReason" : "reason"}
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <FormLabel className="text-right">{isPriceChangeRequest ? "سبب طلب التعديل" : "السبب/ملاحظات"}</FormLabel>
                                <FormControl className="col-span-3">
                                    {isCourier && isCancelledStatus ? (
                                        <Select dir="rtl" onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="اختر سبب الإلغاء..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cancellationReasons.map(reason => (
                                                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <Textarea {...field} value={field.value ?? ''} />
                                    )}
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {/* Fields hidden for couriers */}
                     {(isAdmin || isCompany || isCustomerService) && <>
                      <div className="grid grid-cols-4 items-center gap-4">
                          <FormLabel className="text-right">خيارات إضافية</FormLabel>
                          <div className="col-span-3 flex items-center gap-4 flex-wrap">
                            <FormField
                                control={form.control}
                                name="retryAttempt"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="retryAttempt" />
                                        </FormControl>
                                        <Label htmlFor="retryAttempt">إعادة محاولة</Label>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="isUrgent"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="isUrgent" />
                                        </FormControl>
                                        <Label htmlFor="isUrgent">شحنة مستعجلة</Label>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="isExchange"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} id="isExchange" />
                                        </FormControl>
                                        <Label htmlFor="isExchange">شحنة استبدال</Label>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="isCustomReturn"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                           <Checkbox checked={field.value} onCheckedChange={field.onChange} id="isCustomReturn" />
                                        </FormControl>
                                        <Label htmlFor="isCustomReturn">استرجاع مخصص</Label>
                                    </FormItem>
                                )}
                              />
                          </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="isWarehouseReturn"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="isWarehouseReturn" className="text-right">مرتجع للمخزن؟</Label>
                                <FormControl className="col-span-3">
                                   <Checkbox
                                        id="isWarehouseReturn"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="isReturningToCompany"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="isReturningToCompany" className="text-right">قيد التوصيل للشركة؟</Label>
                                <FormControl className="col-span-3">
                                   <Checkbox
                                        id="isReturningToCompany"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="isReturnedToCompany"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="isReturnedToCompany" className="text-right">تم الرجوع للشركة؟</Label>
                                <FormControl className="col-span-3">
                                   <Checkbox
                                        id="isReturnedToCompany"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
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
                                    <Input {...field} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                     </>}
                     {(isAdmin || isCustomerService) && (
                        <FormField
                        control={form.control}
                        name="isLabelPrinted"
                        render={({ field }) => (
                            <FormItem className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="isLabelPrinted" className="text-right">تمت طباعة الملصق؟</Label>
                                <FormControl className="col-span-3">
                                   <Checkbox
                                        id="isLabelPrinted"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                     )}
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
