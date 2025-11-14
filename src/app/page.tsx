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
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDoc, setDoc, query, where, getDocs, updateDoc } from "firebase/firestore";
import { EGYPTIAN_GOVERNORATES } from "@/lib/governorates";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function DashboardPage() {
  const [role, setRole] = React.useState<Role | null>(null);
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    
    const shipmentsCollection = collection(firestore, 'shipments');
    
    if (role === 'company') {
      return query(shipmentsCollection, where("companyId", "==", user.uid));
    }
    if (role === 'courier') {
      return query(shipmentsCollection, where("assignedCourierId", "==", user.uid));
    }
    // Admin sees all
    return shipmentsCollection;

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
     return collection(firestore, 'users');
  }, [firestore, role]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);
  
  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };


  React.useEffect(() => {
    if (user && firestore) {
      const checkRole = async () => {
        const userDocRef = doc(firestore, `users/${user.uid}`);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setRole(userDocSnap.data().role);
          return;
        }

        if (user.email === "mhanyt21@gmail.com") {
          const adminData = {
            id: user.uid,
            email: user.email,
            role: 'admin',
            name: 'Admin',
            createdAt: serverTimestamp()
          };
          if (!userDocSnap.exists()){
            await setDoc(userDocRef, adminData);
            await setDoc(doc(firestore, 'roles_admin', user.uid), {email: user.email});
          }
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
        
        let userRole: Role | null = null;
        if (adminSnap.exists()) {
          userRole = 'admin';
        } else if (companySnap.exists()) {
          userRole = 'company';
        } else if (courierSnap.exists()) {
          userRole = 'courier';
        }

        if (userRole) {
           await setDoc(userDocRef, {
             id: user.uid,
             email: user.email,
             role: userRole,
             createdAt: serverTimestamp()
           });
           setRole(userRole);
        } else {
          setRole(null);
        }
      };

      checkRole();
    }
  }, [user, firestore]);

  if (isUserLoading || (user && !role && !usersLoading)) {
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
          let addedCount = 0;
          let updatedCount = 0;
          const shipmentsCollection = collection(firestore, 'shipments');

          for (const row of json) {
              const trackingNumber = row['رقم الشحنة']?.toString();
              if (!trackingNumber) continue;

              const deliveryDate = parseExcelDate(row['تاريخ التسليم للمندوب']);
              const creationDate = parseExcelDate(row['التاريخ']);

              const shipmentData: Partial<Shipment> = {
                  orderNumber: row['رقم الطلب']?.toString(),
                  recipientName: row['المرسل اليه'],
                  recipientPhone: row['التليفون']?.toString(),
                  governorateId: governorates?.find(g => g.name === row['المحافظة'])?.id || '',
                  address: row['العنوان'] || 'N/A',
                  totalAmount: parseFloat(String(row['الاجمالي'] || '0').replace(/[^0-9.]/g, '')),
                  paidAmount: parseFloat(String(row['المدفوع'] || '0').replace(/[^0-9.]/g, '')),
                  status: row['حالة الأوردر'] || 'Pending',
                  reason: row['السبب'] || '',
                  deliveryDate: deliveryDate || new Date(),
                  companyId: companies?.find(c => c.name === row['العميل'])?.id || 'imported',
                  subClientId: subClients?.find(sc => sc.name === row['العميل الفرعي'])?.id,
                  updatedAt: serverTimestamp(),
              };

              // Clean up undefined/null values
              const cleanShipmentData = Object.fromEntries(Object.entries(shipmentData).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
              if (!cleanShipmentData.subClientId) {
                cleanShipmentData.subClientId = null;
              }

              const q = query(shipmentsCollection, where("trackingNumber", "==", trackingNumber));
              const querySnapshot = await getDocs(q);

              if (querySnapshot.empty) {
                  const docRef = doc(shipmentsCollection);
                  batch.set(docRef, { 
                      ...cleanShipmentData, 
                      trackingNumber, 
                      shipmentCode: row['رقم الشحنة']?.toString() || `SH-${Date.now()}-${addedCount}`,
                      createdAt: creationDate || serverTimestamp()
                  });
                  addedCount++;
              } else {
                  const docRef = querySnapshot.docs[0].ref;
                  batch.update(docRef, cleanShipmentData);
                  updatedCount++;
              }
          }
          
          await batch.commit();

          let toastMessage = "";
          if (addedCount > 0) toastMessage += `تمت إضافة ${addedCount} شحنة جديدة. `;
          if (updatedCount > 0) toastMessage += `تم تحديث ${updatedCount} شحنة.`;
          
          toast({
            title: "اكتمل الاستيراد بنجاح",
            description: toastMessage.trim() || "لم يتم العثور على شحنات جديدة أو تحديثات.",
          });

        } catch (error: any) {
            console.error("Error importing file:", error);
            const permissionError = new FirestorePermissionError({
                path: 'shipments',
                operation: 'write',
                requestResourceData: {note: "Batch import operation failed"}
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                title: "خطأ في الاستيراد",
                description: error.message || "حدث خطأ أثناء معالجة الملف.",
                variant: "destructive"
            });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleSaveShipment = (shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (!firestore) return;

    const cleanShipmentData: { [key: string]: any } = Object.fromEntries(
      Object.entries(shipment).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
     if (!cleanShipmentData.subClientId) {
        cleanShipmentData.subClientId = null;
    }

    if (id) { // Update existing shipment
      const docRef = doc(firestore, 'shipments', id);
      const dataToUpdate = { ...cleanShipmentData, updatedAt: serverTimestamp() };
      updateDoc(docRef, dataToUpdate)
        .then(() => {
          toast({
            title: "تم تحديث الشحنة",
            description: `تم تحديث الشحنة بنجاح`,
          });
          setShipmentSheetOpen(false);
        })
        .catch(serverError => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: dataToUpdate
          });
          errorEmitter.emit('permission-error', permissionError);
        });

    } else { // Add new shipment
      const shipmentsCollection = collection(firestore, 'shipments');
      const dataToAdd = { ...cleanShipmentData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      addDoc(shipmentsCollection, dataToAdd)
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
            requestResourceData: dataToAdd
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }
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
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleImportClick} disabled={role === 'courier'}>
                <FileUp className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  استيراد
                </span>
              </Button>
              <ShipmentFormSheet
                open={isShipmentSheetOpen}
                onOpenChange={setShipmentSheetOpen}
                onSave={handleSaveShipment}
                shipment={editingShipment}
                governorates={governorates || []}
                companies={companies || []}
                subClients={subClients || []}
                couriers={couriers || []}
                role={role}
              >
                 <Button size="sm" className="h-8 gap-1" onClick={() => openShipmentForm()} disabled={role === 'courier'}>
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
              onEdit={openShipmentForm}
              role={role}
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
                onEdit={openShipmentForm}
                role={role}
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
                onEdit={openShipmentForm}
                role={role}
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
                onEdit={openShipmentForm}
                role={role}
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
                    <UsersTable users={users || []} isLoading={usersLoading} />
                </div>
           </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
