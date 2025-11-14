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
import type { Role, Shipment, Client, SubClient, Governorate, Company, Courier } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { Header } from "@/components/dashboard/header";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { mockUsers } from "@/lib/placeholder-data";

export default function DashboardPage() {
  const [role] = React.useState<Role>("admin");
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const shipmentsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'shipments') : null, [firestore]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const clientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'clients') : null, [firestore]);
  const { data: clients } = useCollection<Client>(clientsQuery);

  const subClientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'subclients') : null, [firestore]);
  const { data: subClients } = useCollection<SubClient>(subClientsQuery);

  const governoratesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const companiesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const couriersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'couriers') : null, [firestore]);
  const { data: couriers } = useCollection<Courier>(couriersQuery);


  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && firestore) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = utils.sheet_to_json<any>(worksheet);

          const batch = writeBatch(firestore);
          let importedCount = 0;
          const shipmentsCollection = collection(firestore, 'shipments');


          for (const row of json) {
            const shipmentCode = row['كود الشحنة'] || `SH-${Date.now()}-${importedCount}`;
            
            const newShipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'> = {
                shipmentCode: shipmentCode,
                orderNumber: row['رقم الطلب'] || `ORD-${Date.now()}-${importedCount}`,
                trackingNumber: row['رقم الشحنة'] || `TRK-${Date.now()}-${importedCount}`,
                recipientName: row['المرسل إليه'],
                recipientPhone: row['الهاتف']?.toString(),
                governorateId: governorates?.find(g => g.name === row['المحافظة'])?.id || '',
                address: row['العنوان'] || 'N/A',
                totalAmount: parseFloat(row['الإجمالي'] || 0),
                status: row['الحالة'] || 'Pending',
                deliveryDate: row['تاريخ التسليم'] ? new Date(row['تاريخ التسليم']) : new Date(),
                clientId: clients?.find(c => c.name === row['العميل'])?.id || 'imported',
                paidAmount: 0,
            };

            const docRef = doc(shipmentsCollection, shipmentCode);
            batch.set(docRef, {
                ...newShipment,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            importedCount++;
          }
          
          await batch.commit();

          toast({
            title: "تم الاستيراد بنجاح",
            description: `تمت إضافة ${importedCount} شحنة جديدة.`,
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

  const handleSaveShipment = async (shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>) => {
     if (!firestore) return;
     try {
        const shipmentsCollection = collection(firestore, 'shipments');
        
        await addDoc(shipmentsCollection, {
            ...shipment,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        
        toast({
            title: "تم حفظ الشحنة",
            description: `تم إنشاء الشحنة بنجاح`,
        });
        setShipmentSheetOpen(false);

     } catch(error) {
         console.error("Error adding document: ", error);
         toast({
            title: "خطأ",
            description: "لم يتم حفظ الشحنة. الرجاء المحاولة مرة أخرى",
            variant: "destructive"
         });
     }
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
              <ShipmentFormSheet
                open={isShipmentSheetOpen}
                onOpenChange={setShipmentSheetOpen}
                onSave={handleSaveShipment}
                governorates={governorates || []}
                clients={clients || []}
                subClients={subClients || []}
                couriers={couriers || []}
              >
                 <Button size="sm" className="h-8 gap-1" onClick={() => setShipmentSheetOpen(true)}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      شحنة جديدة
                    </span>
                  </Button>
              </ShipmentFormSheet>
            </div>
          </div>
          <StatsCards shipments={shipments || []} />
          <TabsContent value="all-shipments">
            <ShipmentsTable 
              shipments={shipments || []} 
              isLoading={shipmentsLoading}
              governorates={governorates || []}
              companies={companies || []}
              couriers={couriers || []}
            />
          </TabsContent>
          <TabsContent value="in-transit">
             <ShipmentsTable 
                shipments={(shipments || []).filter(s => s.status === 'In-Transit')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                couriers={couriers || []}
             />
          </TabsContent>
           <TabsContent value="delivered">
             <ShipmentsTable 
                shipments={(shipments || []).filter(s => s.status === 'Delivered')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                couriers={couriers || []}
             />
          </TabsContent>
           <TabsContent value="returned">
             <ShipmentsTable 
                shipments={(shipments || []).filter(s => s.status === 'Returned')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                couriers={couriers || []}
             />
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
