
"use client";
import React from "react";
import { PlusCircle, FileUp, Users } from "lucide-react";
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
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, setDoc, query, where, updateDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

export default function AdminDashboard() {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [isUserSheetOpen, setUserSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = getAuth();
  const role: Role = 'admin';

  const shipmentsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'shipments') : null, [firestore]);
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
  
  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  
  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };

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
  
  const handleSaveUser = async (userData: any) => {
    if (!firestore) return;
    try {
        // 1. Create the user in Firebase Auth
        const { user: newUser } = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        
        const batch = writeBatch(firestore);

        // 2. Create the user document in /users
        const userDocRef = doc(firestore, 'users', newUser.uid);
        const userDocData: Partial<User> = {
            id: newUser.uid,
            email: userData.email,
            role: userData.role,
            name: userData.name,
            createdAt: serverTimestamp()
        };

        // 3. If it's a company, create a corresponding company document
        if (userData.role === 'company') {
            const companyDocRef = doc(firestore, 'companies', newUser.uid);
            batch.set(companyDocRef, {
                id: newUser.uid,
                name: userData.companyName,
            });
            // Link user to their own company ID
            userDocData.companyId = newUser.uid;
            userDocData.companyName = userData.companyName;
        }
        
        batch.set(userDocRef, userDocData);

        // 4. Add user to the corresponding role collection for security rules
        const roleCollection = `roles_${userData.role}`;
        const roleDocRef = doc(firestore, roleCollection, newUser.uid);
        batch.set(roleDocRef, { email: userData.email });

        // 5. Commit all writes at once
        await batch.commit();

        toast({
            title: "تم إنشاء المستخدم بنجاح",
            description: `تم إنشاء حساب لـ ${userData.name} بدور ${userData.role}.`,
        });
        setUserSheetOpen(false);
    } catch (error: any) {
        console.error("Error creating user:", error);
        toast({
            title: "خطأ في إنشاء المستخدم",
            description: error.message || "حدث خطأ غير متوقع.",
            variant: "destructive"
        });
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
                          onOpenChange={setUserSheetOpen}
                          onSave={handleSaveUser}
                          companies={companies || []}
                          deliveryCompanies={deliveryCompanies || []}
                      >
                         <Button variant="outline" onClick={() => setUserSheetOpen(true)}>
                            <Users className="me-2 h-4 w-4" />
                            إضافة مستخدم
                          </Button>
                      </UserFormSheet>
                    </div>
                  </div>
                  <UsersTable users={users || []} isLoading={usersLoading} />
              </div>
         </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
