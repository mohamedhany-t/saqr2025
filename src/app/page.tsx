"use client";
import React from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Home,
  Users2,
  LineChart,
  PlusCircle,
  FileUp,
  Building,
  DatabaseZap,
  Loader2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, SubClient, Governorate, Courier, User } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { Header } from "@/components/dashboard/header";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDoc } from "firebase/firestore";
import { EGYPTIAN_GOVERNORATES } from "@/lib/governorates";

export default function DashboardPage() {
  const [role, setRole] = React.useState<Role | null>(null);
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    let q = collection(firestore, 'shipments');
    // We will add role based queries later
    return q;
  }, [firestore, user, role]);

  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const companiesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const subClientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'subclients') : null, [firestore]);
  const { data: subClients } = useCollection<SubClient>(subClientsQuery);

  const governoratesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const deliveryCompaniesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'deliveryCompanies') : null, [firestore]);
  const { data: deliveryCompanies } = useCollection<Company>(deliveryCompaniesQuery);

  const couriersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'couriers') : null, [firestore]);
  const { data: couriers } = useCollection<Courier>(couriersQuery);
  
  const usersQuery = useMemoFirebase(() => {
     if (!firestore || role !== 'admin') return null;
     // In a real app, you'd probably fetch from a single 'users' collection 
     // and the roles would be a field on the user document.
     // For now, we'll fetch all users if the role is admin.
     // This is not optimal and should be refactored.
     return collection(firestore, 'users');
  }, [firestore, role]);
  const { data: users } = useCollection<User>(usersQuery);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  React.useEffect(() => {
    if (user && firestore) {
      const checkRole = async () => {
        if (user.email === "mhanyt21@gmail.com") {
          setRole('admin');
          return;
        }

        const adminDoc = doc(firestore, `roles_admin/${user.uid}`);
        const companyDoc = doc(firestore, `roles_company/${user.uid}`);
        const courierDoc = doc(firestore, `roles_courier/${user.uid}`);
        
        const [adminSnap, companySnap, courierSnap] = await Promise.all([
          getDoc(adminDoc),
          getDoc(companyDoc),
          getDoc(courierDoc)
        ]);
        
        if (adminSnap.exists()) {
          setRole('admin');
        } else if (companySnap.exists()) {
          setRole('company');
        } else if (courierSnap.exists()) {
          setRole('courier');
        } else {
          setRole(null); // No specific role found
        }
      };

      checkRole();
    }
  }, [user, firestore]);

  if (isUserLoading || (user && !role)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const parseExcelDate = (excelDate: any): Date | null => {
    if (!excelDate) return null;
    if (excelDate instanceof Date && !isNaN(excelDate.getTime())) {
      return excelDate;
    }
    if (typeof excelDate === 'number') {
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    if (typeof excelDate === 'string') {
      const date = new Date(excelDate);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
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
            const shipmentCode = row['رقم الشحنة']?.toString() || `SH-${Date.now()}-${importedCount}`;
            const deliveryDate = parseExcelDate(row['تاريخ التسليم للمندوب']);
            const creationDate = parseExcelDate(row['التاريخ']);
            
            const newShipment: Omit<Shipment, 'id'> = {
                shipmentCode: shipmentCode,
                orderNumber: row['رقم الطلب']?.toString() || `ORD-${Date.now()}-${importedCount}`,
                trackingNumber: row['رقم الشحنة']?.toString() || `TRK-${Date.now()}-${importedCount}`,
                recipientName: row['المرسل اليه'],
                recipientPhone: row['التليفون']?.toString(),
                governorateId: governorates?.find(g => g.name === row['المحافظة'])?.id || '',
                address: row['العنوان'] || 'N/A',
                totalAmount: parseFloat(row['الاجمالي'] || 0),
                paidAmount: parseFloat(row['المدفوع'] || 0),
                status: row['حالة الأوردر'] || 'Pending',
                reason: row['السبب'] || '',
                deliveryDate: deliveryDate || new Date(),
                companyId: companies?.find(c => c.name === row['العميل'])?.id || 'imported',
                subClientId: subClients?.find(sc => sc.name === row['العميل الفرعي'])?.id,
                createdAt: creationDate || serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            
            const cleanShipment: { [key: string]: any } = {};
            for (const key in newShipment) {
              const value = (newShipment as any)[key];
              if (value !== undefined && value !== null && value !== '') {
                cleanShipment[key] = value;
              }
            }
            
            if (!cleanShipment.subClientId) {
                cleanShipment.subClientId = null;
            }

            const docRef = doc(shipmentsCollection);
            batch.set(docRef, cleanShipment);
            importedCount++;
          }
          
          batch.commit().catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: 'shipments',
                operation: 'write',
                requestResourceData: {note: "Batch import operation"}
            });
            errorEmitter.emit('permission-error', permissionError);
          });

          toast({
            title: "تم الاستيراد بنجاح",
            description: `تمت إضافة ${importedCount} شحنة جديدة.`,
          });
        } catch (error: any) {
            console.error("Error importing file:", error);
            toast({
                title: "خطأ في الاستيراد",
                description: error.message || "حدث خطأ أثناء معالجة الملف. يرجى التأكد من أن الملف بالتنسيق الصحيح.",
                variant: "destructive"
            });
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleSaveShipment = (shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>) => {
     if (!firestore) return;
    const shipmentsCollection = collection(firestore, 'shipments');

    const shipmentData = {
      ...shipment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const cleanShipmentData: { [key: string]: any } = {};
    for (const key in shipmentData) {
        const value = (shipmentData as any)[key];
        if (value !== undefined && value !== null && value !== '') {
            cleanShipmentData[key] = value;
        }
    }
    
    if (!cleanShipmentData.subClientId) {
        cleanShipmentData.subClientId = null;
    }

    addDoc(shipmentsCollection, cleanShipmentData)
      .then(() => {
        toast({
            title: "تم حفظ الشحنة",
            description: `تم إنشاء الشحنة بنجاح`,
        });
        setShipmentSheetOpen(false);
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: shipmentsCollection.path,
          operation: 'create',
          requestResourceData: cleanShipmentData
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const seedDatabase = async () => {
    if (!firestore) return;

    try {
      const batch = writeBatch(firestore);

      // Seed Governorates
      const governoratesCol = collection(firestore, 'governorates');
      EGYPTIAN_GOVERNORATES.forEach(name => {
        const docRef = doc(governoratesCol);
        batch.set(docRef, { name });
      });

      // Seed Companies
      const companiesCol = collection(firestore, 'companies');
      ["تليجراف", "شركة النخبة", "شركة الأمانة", "شركة المستقبل"].forEach(name => {
        const docRef = doc(companiesCol);
        batch.set(docRef, { name });
      });

      // Seed Delivery Companies
      const deliveryCompaniesCol = collection(firestore, 'deliveryCompanies');
      ["Aramex", "FedEx", "DHL"].forEach(name => {
        const docRef = doc(deliveryCompaniesCol);
        batch.set(docRef, { name });
      });

      // Seed Couriers
      const couriersCol = collection(firestore, 'couriers');
      [
        { name: "أحمد محمود", companyId: "Aramex" },
        { name: "محمد علي", companyId: "FedEx" },
        { name: "سارة حسين", companyId: "DHL" },
      ].forEach(courier => {
        const docRef = doc(couriersCol);
        batch.set(docRef, courier);
      });

      await batch.commit();

      toast({
        title: 'تم',
        description: 'تمت إضافة البيانات الأولية بنجاح إلى قاعدة البيانات.',
      });
    } catch (error) {
      console.error('Error seeding database:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة البيانات الأولية.',
        variant: 'destructive',
      });
    }
  };


  return (
    <div className="min-h-screen w-full bg-muted/30">
      <Header />
      <main className="p-4 sm:px-6 sm:py-0">
        <Tabs defaultValue="all-shipments">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="all-shipments">الكل</TabsTrigger>
              <TabsTrigger value="in-transit" className="hidden sm:flex">قيد التوصيل</TabsTrigger>
              <TabsTrigger value="delivered" className="hidden sm:flex">تم التوصيل</TabsTrigger>
              <TabsTrigger value="returned" className="hidden sm:flex">مرتجعات</TabsTrigger>
              {role === "admin" && <TabsTrigger value="management">الإدارة</TabsTrigger>}
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
                companies={companies || []}
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
              deliveryCompanies={deliveryCompanies || []}
              couriers={couriers || []}
              subClients={subClients || []}
            />
          </TabsContent>
          <TabsContent value="in-transit">
             <ShipmentsTable 
                shipments={(shipments || []).filter(s => s.status === 'In-Transit')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                deliveryCompanies={deliveryCompanies || []}
                couriers={couriers || []}
                subClients={subClients || []}
             />
          </TabsContent>
           <TabsContent value="delivered">
             <ShipmentsTable 
                shipments={(shipments || []).filter(s => s.status === 'Delivered')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                deliveryCompanies={deliveryCompanies || []}
                couriers={couriers || []}
                subClients={subClients || []}
             />
          </TabsContent>
           <TabsContent value="returned">
             <ShipmentsTable 
                shipments={(shipments || []).filter(s => s.status === 'Returned')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                deliveryCompanies={deliveryCompanies || []}
                couriers={couriers || []}
                subClients={subClients || []}
             />
          </TabsContent>
          {role === 'admin' && (
            <TabsContent value="management">
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-2xl font-headline font-semibold">إدارة المستخدمين</h2>
                      <div className="flex items-center gap-2">
                         <Button variant="outline">
                            <Users className="me-2 h-4 w-4" />
                            إضافة مستخدم
                          </Button>
                          <Button onClick={seedDatabase} variant="outline">
                            <DatabaseZap className="me-2 h-4 w-4" />
                            إضافة بيانات أولية
                          </Button>
                      </div>
                    </div>
                    <UsersTable users={users || []} />
                </div>
           </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
