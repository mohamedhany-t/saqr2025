
"use client";
import React from "react";
import { PlusCircle, FileUp, Users, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, SubClient, Governorate, Courier, User } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { UserFormSheet } from "@/components/users/user-form-sheet";
import { Header } from "@/components/dashboard/header";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useAuth } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';


export default function AdminDashboard() {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [isUserSheetOpen, setIsUserSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  const role: Role = 'admin';

  const shipmentsQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'shipments') : null, [firestore, user]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const companiesQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'companies') : null, [firestore, user]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const subClientsQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'subclients') : null, [firestore, user]);
  const { data: subClients } = useCollection<SubClient>(subClientsQuery);

  const governoratesQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'governorates') : null, [firestore, user]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const deliveryCompaniesQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'deliveryCompanies') : null, [firestore, user]);
  const { data: deliveryCompanies, isLoading: deliveryCompaniesLoading } = useCollection<Company>(deliveryCompaniesQuery);

  const couriersQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'couriers') : null, [firestore, user]);
  const { data: couriers } = useCollection<Courier>(couriersQuery);
  
  const usersQuery = useMemoFirebase(() => firestore && user ? collection(firestore, 'users') : null, [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  
  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const handleSeedData = async () => {
    if (!firestore) return;
    toast({ title: "جاري إضافة البيانات الوهمية...", description: "قد تستغرق هذه العملية بضع لحظات." });

    try {
        const batch = writeBatch(firestore);

        // Seed Companies and their users
        for (let i = 1; i <= 5; i++) {
            const companyName = `الشركة الوهمية ${i}`;
            const email = `company${i}@example.com`;
            const uid = `mock_company_uid_${i}`;

            // Company doc
            const companyRef = doc(firestore, 'companies', uid);
            batch.set(companyRef, { id: uid, name: companyName });

            // User doc
            const userRef = doc(firestore, 'users', uid);
            batch.set(userRef, {
                id: uid,
                email: email,
                name: companyName,
                role: 'company',
                companyId: uid,
                companyName: companyName,
                createdAt: serverTimestamp(),
            });

            // Role doc
            const roleRef = doc(firestore, 'roles_company', uid);
            batch.set(roleRef, { email: email, createdAt: serverTimestamp() });
        }

        // Seed Couriers and their users
        for (let i = 1; i <= 10; i++) {
            const courierName = `المندوب الوهمي ${i}`;
            const email = `courier${i}@example.com`;
            const uid = `mock_courier_uid_${i}`;

            // Courier doc
             const courierRef = doc(firestore, 'couriers', uid);
             batch.set(courierRef, { id: uid, name: courierName, deliveryCompanyId: 'mock_delivery_co' });


            // User doc
            const userRef = doc(firestore, 'users', uid);
            batch.set(userRef, {
                id: uid,
                email: email,
                name: courierName,
                role: 'courier',
                createdAt: serverTimestamp(),
            });

            // Role doc
            const roleRef = doc(firestore, 'roles_courier', uid);
            batch.set(roleRef, { email: email, createdAt: serverTimestamp() });
        }
        
         // Seed Governorates and Delivery Companies
        const govs = ["القاهرة", "الجيزة", "الأسكندرية", "أسوان", "الأقصر", "البحيرة", "المنوفية", "الشرقية"];
        govs.forEach(g => {
            const govRef = doc(collection(firestore, 'governorates'));
            batch.set(govRef, { id: govRef.id, name: g });
        });

        const delivCoRef = doc(firestore, 'deliveryCompanies', 'mock_delivery_co');
        batch.set(delivCoRef, { id: 'mock_delivery_co', name: 'شركة توصيل وهمية' });


        await batch.commit();
        toast({ title: "اكتملت العملية بنجاح", description: "تمت إضافة 5 شركات و 10 مناديب بنجاح. قم بتحديث الصفحة." });

    } catch (error: any) {
        console.error("Error seeding data:", error);
        toast({ variant: "destructive", title: "حدث خطأ أثناء إضافة البيانات", description: error.message });
    }
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
          
          batch.commit().catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: 'shipments',
                operation: 'write',
                requestResourceData: {note: "Batch import operation failed"}
            });
            errorEmitter.emit('permission-error', permissionError);
          });

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
                requestResourceData: {note: "Batch import operation failed due to client-side error"}
            });
            errorEmitter.emit('permission-error', permissionError);
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

    if (id) {
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

    } else {
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

  const handleSaveUser = async (data: any) => {
    if (!firestore || !auth) {
        toast({ variant: "destructive", title: "خطأ", description: "خدمات Firebase غير متاحة" });
        return;
    }
    
    setIsUserSheetOpen(false);
    toast({ title: "جاري إنشاء المستخدم...", description: "قد تستغرق هذه العملية بضع لحظات." });

    let tempAuth: any;
    try {
        // Use a temporary, separate auth instance for creating the user
        // This prevents the admin from being logged out
        tempAuth = initializeAuth(auth.app, {
            persistence: indexedDBLocalPersistence,
            // popupRedirectResolver: undefined
        });

        const userCredential = await createUserWithEmailAndPassword(tempAuth, data.email, data.password);
        const newUser = userCredential.user;

        const batch = writeBatch(firestore);

        // 1. Create Company/Courier document if needed
        let companyId = null;
        let companyName = null;
        if (data.role === 'company') {
            const companyRef = doc(firestore, 'companies', newUser.uid);
            companyId = newUser.uid;
            companyName = data.companyName;
            batch.set(companyRef, {
                id: companyId,
                name: companyName,
            });
        } else if (data.role === 'courier') {
            const courierRef = doc(firestore, 'couriers', newUser.uid);
            batch.set(courierRef, {
                id: newUser.uid,
                name: data.name,
                deliveryCompanyId: data.deliveryCompanyId || null
            });
        }

        // 2. Create User document
        const userDocRef = doc(firestore, 'users', newUser.uid);
        const userPayload: any = {
            id: newUser.uid,
            email: data.email,
            name: data.name,
            role: data.role,
            createdAt: serverTimestamp(),
        };
        if (companyId) {
            userPayload.companyId = companyId;
            userPayload.companyName = companyName;
        }
        if (data.role === 'courier' && data.deliveryCompanyId) {
            userPayload.deliveryCompanyId = data.deliveryCompanyId;
        }
        batch.set(userDocRef, userPayload);

        // 3. Create Role document
        const roleCollectionName = `roles_${data.role}`;
        const roleDocRef = doc(firestore, roleCollectionName, newUser.uid);
        batch.set(roleDocRef, { email: data.email, createdAt: serverTimestamp() });
        
        // The batch commit is executed with the ADMIN's permissions
        batch.commit()
          .then(() => {
                toast({
                    title: "تم إنشاء المستخدم بنجاح!",
                    description: `تم إنشاء حساب لـ ${data.name} بدور "${data.role}".`,
                });
          })
          .catch((serverError: any) => {
            // This is where Firestore permission errors for the BATCH will be caught.
            const permissionError = new FirestorePermissionError({
                path: 'users', // The batch can affect multiple paths, so this is a general path.
                operation: 'write',
                requestResourceData: { note: 'Batch operation for creating user, company, and role failed.' }
            });
            errorEmitter.emit('permission-error', permissionError);
          });

    } catch (error: any) {
        console.error("Error creating user:", error);
        let description = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
        if (error.code === 'auth/email-already-in-use') {
            description = "هذا البريد الإلكتروني مستخدم بالفعل.";
        } else if (error.code === 'auth/weak-password') {
            description = "كلمة المرور ضعيفة جدًا. يجب أن تتكون من 6 أحرف على الأقل.";
        } else if (error.code?.includes('permission-denied')) {
             description = "خطأ في الصلاحيات. تأكد من أن قواعد الأمان تسمح للمسؤول بإنشاء المستخدمين.";
             const permissionError = new FirestorePermissionError({
                path: 'users', // Best guess for path
                operation: 'write',
                requestResourceData: { note: 'Batch operation for creating user, company, and role failed.' }
             });
             errorEmitter.emit('permission-error', permissionError);
        }

        toast({
            variant: "destructive",
            title: "فشل إنشاء المستخدم",
            description: description,
        });
    } finally {
        if (tempAuth) {
            // Clean up the temporary auth instance
            await tempAuth.signOut();
        }
    }
};

  
  const filteredShipments = React.useMemo(() => {
    if (!shipments) return [];
    if (!searchTerm) return shipments;
    return shipments.filter(shipment => 
        shipment.shipmentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.recipientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [shipments, searchTerm]);


  return (
    <div className="min-h-screen w-full bg-muted/30">
      <Header onSearchChange={setSearchTerm}/>
      <main className="p-4 sm:px-6 sm:py-0">
        <Tabs defaultValue="all-shipments">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="all-shipments">الكل</TabsTrigger>
              <TabsTrigger value="in-transit" className="hidden sm:flex">قيد التوصيل</TabsTrigger>
              <TabsTrigger value="delivered" className="hidden sm:flex">تم التوصيل</TabsTrigger>
              <TabsTrigger value="returned" className="hidden sm:flex">مرتجعات</TabsTrigger>
              <TabsTrigger value="management">الإدارة</TabsTrigger>
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
               <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleSeedData}>
                <Database className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  إضافة بيانات وهمية
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
                 <Button size="sm" className="h-8 gap-1" onClick={() => openShipmentForm()}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      شحنة جديدة
                    </span>
                  </Button>
              </ShipmentFormSheet>
            </div>
          </div>
          <StatsCards shipments={shipments || []} role={role} companies={companies || []} />
          <TabsContent value="all-shipments">
            <ShipmentsTable 
              shipments={filteredShipments} 
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
                shipments={filteredShipments.filter(s => s.status === 'In-Transit')}
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
                shipments={filteredShipments.filter(s => s.status === 'Delivered')}
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
                shipments={filteredShipments.filter(s => s.status === 'Returned')}
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
          <TabsContent value="management">
              <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-headline font-semibold">إدارة المستخدمين</h2>
                     <div className="flex items-center gap-2">
                       <UserFormSheet 
                          open={isUserSheetOpen}
                          onOpenChange={setIsUserSheetOpen}
                          onSave={handleSaveUser}
                          deliveryCompanies={deliveryCompanies || []}
                       >
                            <Button size="sm" className="h-8 gap-1">
                                <PlusCircle className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                                  إضافة مستخدم
                                </span>
                            </Button>
                       </UserFormSheet>
                    </div>
                  </div>
                  <UsersTable users={users || []} isLoading={usersLoading || companiesLoading || deliveryCompaniesLoading} companies={companies ?? []} deliveryCompanies={deliveryCompanies ?? []}/>
              </div>
         </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
