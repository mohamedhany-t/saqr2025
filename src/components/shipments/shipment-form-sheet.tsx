"use client"

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
import { mockShipments } from "@/lib/placeholder-data"

type ShipmentFormSheetProps = {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shipment?: typeof mockShipments[0]
}

export function ShipmentFormSheet({ children, open, onOpenChange, shipment }: ShipmentFormSheetProps) {
  const isEditing = !!shipment;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? "تعديل شحنة" : "إضافة شحنة جديدة"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "قم بتحديث تفاصيل الشحنة هنا." : "أدخل تفاصيل الشحنة الجديدة ليتم إنشاؤها."}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="orderNumber" className="text-right">
              رقم الطلب
            </Label>
            <Input id="orderNumber" defaultValue={shipment?.orderNumber} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="trackingNumber" className="text-right">
              رقم الشحنة
            </Label>
            <Input id="trackingNumber" defaultValue={shipment?.trackingNumber} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recipientName" className="text-right">
              المرسل اليه
            </Label>
            <Input id="recipientName" defaultValue={shipment?.recipientName} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recipientPhone" className="text-right">
              تليفون المستلم
            </Label>
            <Input id="recipientPhone" defaultValue={shipment?.recipientPhone} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="governorate" className="text-right">
              المحافظة
            </Label>
            <Input id="governorate" defaultValue={shipment?.governorate} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recipientAddress" className="text-right">
              العنوان
            </Label>
            <Input id="recipientAddress" defaultValue={shipment?.recipientAddress} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="totalAmount" className="text-right">
              الإجمالي
            </Label>
            <Input id="totalAmount" type="number" defaultValue={shipment?.totalAmount} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              الحالة
            </Label>
             <Select dir="rtl" defaultValue={shipment?.status}>
                <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In-Transit">In-Transit</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                    <SelectItem value="Returned">Returned</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="submit">حفظ التغييرات</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
