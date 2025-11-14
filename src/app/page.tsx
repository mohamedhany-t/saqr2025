"use client";
import React from "react";
import {
  Package,
  Home,
  Users2,
  LineChart,
  PlusCircle,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import { mockUsers, mockShipments } from "@/lib/placeholder-data";
import type { Role, Shipment } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { Header } from "@/components/dashboard/header";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [role] = React.useState<Role>("admin");
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [shipments, setShipments] = React.useState<Shipment[]>(mockShipments);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = utils.sheet_to_json<any>(worksheet);

          const newShipments: Shipment[] = json.map((row: any, index: number) => ({
            id: `imported_${Date.now()}_${index}`,
            shipmentCode: row['كود الشحنة'] || `SH-${Date.now()}-${index}`,
            orderNumber: row['رقم الطلب'] || `ORD-${Date.now()}-${index}`,
            trackingNumber: row['رقم الشحنة'] || `TRK-${Date.now()}-${index}`,
            recipientName: row['المرسل إليه'],
            recipientPhone: row['الهاتف'],
            governorate: row['المحافظة'],
            recipientAddress: row['العنوان'] || 'N/A',
            totalAmount: parseFloat(row['الإجمالي'] || 0),
            status: row['الحالة'] || 'Pending',
            createdAt: row['تاريخ الإنشاء'] ? new Date(row['تاريخ الإنشاء']) : new Date(),
            updatedAt: new Date(),
            deliveryDate: new Date(),
            client: 'Imported Client',
            paidAmount: 0,
          }));

          setShipments(prev => [...prev, ...newShipments]);
          toast({
            title: "تم الاستيراد بنجاح",
            description: `تمت إضافة ${newShipments.length} شحنة جديدة.`,
          });
        } catch (error) {
            console.error("Error importing file:", error);
            toast({
                title: "خطأ في الاستيراد",
                description: "حدث خطأ أثناء معالجة الملف. يرجى التأكد من أن الملف بالتنسيق الصحيح.",
                variant: "destructive"
            });
        }
      };
      reader.readAsBinaryString(file);
    }
  };


  const handleSaveShipment = (shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>) => {
     const newShipment: Shipment = {
      ...shipment,
      id: `new_${Date.now()}`,
      shipmentCode: `SH-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${String(shipments.length + 1).padStart(4, '0')}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setShipments(prev => [newShipment, ...prev]);
    toast({
        title: "تم حفظ الشحنة",
        description: `تم إنشاء الشحنة بنجاح برقم ${newShipment.shipmentCode}`,
    });
    setShipmentSheetOpen(false);
  }

  return (
    <div className="min-h-screen w-full bg-muted/30">
      <Header />
      <main className="p-4 sm:px-6 sm:py-0">
        <Tabs defaultValue="all-shipments">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="all-shipments">الكل</TabsTrigger>
              <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
              <TabsTrigger value="delivered">تم التوصيل</TabsTrigger>
              <TabsTrigger value="returned">مرتجعات</TabsTrigger>
            </TabsList>
            <div className="ms-auto flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx, .xls"
                />
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleImportClick}>
                <FileUp className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  استيراد
                </span>
              </Button>
              <ShipmentFormSheet open={isShipmentSheetOpen} onOpenChange={setShipmentSheetOpen} onSave={handleSaveShipment}>
                 <Button size="sm" className="h-8 gap-1" onClick={() => setShipmentSheetOpen(true)}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      شحنة جديدة
                    </span>
                  </Button>
              </ShipmentFormSheet>
            </div>
          </div>
          <StatsCards />
          <TabsContent value="all-shipments">
            <ShipmentsTable shipments={shipments} />
          </TabsContent>
          <TabsContent value="in-transit">
             <ShipmentsTable shipments={shipments.filter(s => s.status === 'In-Transit')} />
          </TabsContent>
           <TabsContent value="delivered">
             <ShipmentsTable shipments={shipments.filter(s => s.status === 'Delivered')} />
          </TabsContent>
           <TabsContent value="returned">
             <ShipmentsTable shipments={shipments.filter(s => s.status === 'Returned')} />
          </TabsContent>
        </Tabs>
         {role === "admin" && (
            <div className="mt-8">
                <h2 className="text-2xl font-headline font-semibold mb-4">إدارة المستخدمين</h2>
                <UsersTable users={mockUsers} />
            </div>
        )}
      </main>
    </div>
  );
}