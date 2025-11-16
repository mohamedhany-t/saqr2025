
"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PlusCircle, FileUp, Database, User as UserIcon, Wallet, DollarSign, BadgePercent, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, User } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { UserFormSheet } from "@/components/users/user-form-sheet";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useAuth } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { createAuthUser, updateAuthUserPassword, deleteAuthUser } from '@/lib/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AdminDashboardProps {
  role: Role | null;
  searchTerm: string;
}

export default function AdminDashboard({ role, searchTerm }: AdminDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [isUserSheetOpen, setIsUserSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [editingUser, setEditingUser] = React.useState<User | undefined>(undefined);
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const auth = useAuth();
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State for handling shipment editing via URL
  const [editingShipmentFromUrl, setEditingShipmentFromUrl] = React.useState<Shipment | null>(null);

  // Effect to fetch shipment data if 'edit' param is in the URL
  React.useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
          setEditingShipment({ id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment);
          setShipmentSheetOpen(true);
        } else {
          console.warn("Shipment to edit not found");
           const newParams = new URLSearchParams(searchParams.toString());
           newParams.delete('edit');
           router.replace(`${pathname}?${newParams.toString()}`);
        }
      };
      fetchShipment();
    }
  }, [searchParams, firestore, router, pathname]);

  const handleSheetOpenChange = (open: boolean) => {
    setShipmentSheetOpen(open);
    if (!open) {
      setEditingShipment(undefined);
      // Clean up the URL when the sheet is closed
      const newParams = new URLSearchParams(searchParams.toString());
      if (newParams.has('edit')) {
        newParams.delete('edit');
        router.replace(`${pathname}?${newParams.toString()}`);
      }
    }
  };


  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'shipments'));
  }, [firestore, user]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'governorates'));
  }, [firestore, user]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'companies'));
  }, [firestore, user]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const courierUsers = React.useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);
  
  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const openUserForm = (user?: User) => {
    setEditingUser(user);
    setIsUserSheetOpen(true);
  };

  const handleSeedData = () => {
    toast({ 
        title: "هذه الميزة للـ Node.js فقط", 
        description: "يرجى تشغيل السكربت `admin-seed.js` من الـ terminal باستخدام `npm run seed`.",
        variant: "destructive"
    });
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
    if (file && firestore && user) {
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
              const totalAmountValue = row['الاجمالي'] || row['الاجمالى'] || '0';

              const shipmentData: Partial<Shipment> = {
                  orderNumber: row['رقم الطلب']?.toString(),
                  recipientName: row['المرسل اليه'],
                  recipientPhone: row['التليفون']?.toString(),
                  governorateId: governorates?.find(g => g.name === row['المحافظة'])?.id || '',
                  address: row['العنوان'] || 'N/A',
                  totalAmount: parseFloat(String(totalAmountValue).replace(/[^0-9.]/g, '')),
                  paidAmount: parseFloat(String(row['المدفوع'] || '0').replace(/[^0-9.]/g, '')),
                  status: row['حالة الأوردر'] || 'Pending',
                  reason: row['السبب'] || '',
                  deliveryDate: deliveryDate || new Date(),
                  updatedAt: serverTimestamp(),
                  companyId: user.uid, // Assume admin imports for themselves
              };

              const cleanShipmentData = Object.fromEntries(Object.entries(shipmentData).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
              
              const q = query(shipmentsCollection, where("trackingNumber", "==", trackingNumber));
              const querySnapshot = await getDocs(q);

              if (querySnapshot.empty) {
                  const docRef = doc(shipmentsCollection);
                  batch.set(docRef, { 
                      ...cleanShipmentData, 
                      id: docRef.id,
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

  const handleSaveShipment = (shipment: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !user) return;

    const cleanShipmentData: { [key: string]: any } = Object.fromEntries(
      Object.entries(shipment).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );

    if (id) {
      const docRef = doc(firestore, 'shipments', id);
      const dataToUpdate = { ...cleanShipmentData, updatedAt: serverTimestamp() };
      
      updateDoc(docRef, dataToUpdate)
        .then(() => {
          toast({
            title: "تم تحديث الشحنة",
            description: `تم تحديث الشحنة بنجاح`,
          });
          handleSheetOpenChange(false);
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
      const docRef = doc(shipmentsCollection);
      const dataToAdd = { ...cleanShipmentData, id: docRef.id, companyId: shipment.companyId || user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      
      setDoc(docRef, dataToAdd)
        .then(() => {
          toast({
            title: "تم حفظ الشحنة",
            description: `تم إنشاء الشحنة بنجاح`,
          });
          handleSheetOpenChange(false);
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

  const handleSaveUser = async (data: any, userId?: string) => {
    if (!firestore || !auth) {
        toast({ variant: "destructive", title: "خطأ", description: "خدمات Firebase غير متاحة" });
        return;
    }
    setIsUserSheetOpen(false);

    if (userId) { // --- UPDATE LOGIC ---
        toast({ title: "جاري تحديث المستخدم...", description: "قد تستغرق هذه العملية بضع لحظات." });
        
        // Step 1: Update password if provided
        if (data.password) {
            const passResult = await updateAuthUserPassword({ uid: userId, password: data.password });
            if (!passResult.success) {
                toast({ variant: "destructive", title: "فشل تحديث كلمة المرور", description: `حدث خطأ: ${passResult.error}` });
                // Decide if you want to stop or continue with Firestore updates
                return;
            }
        }
        
        // Step 2: Update Firestore documents
        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', userId);
        const userUpdatePayload: any = { name: data.name, updatedAt: serverTimestamp() };

        if (data.role === 'courier') {
            userUpdatePayload.commissionRate = data.commissionRate;
            const courierDocRef = doc(firestore, 'couriers', userId);
            batch.update(courierDocRef, { name: data.name, commissionRate: data.commissionRate });
        } else if (data.role === 'company') {
            const companyDocRef = doc(firestore, 'companies', userId);
            batch.update(companyDocRef, { name: data.name });
        }

        batch.update(userDocRef, userUpdatePayload);

        batch.commit()
            .then(() => {
                toast({ title: "تم تحديث المستخدم بنجاح!", description: `تم تحديث بيانات ${data.name}.` });
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: 'batch_write (users, etc.)',
                    operation: 'update',
                    requestResourceData: { note: `Batch update for user ${userId} failed.` }
                });
                errorEmitter.emit('permission-error', permissionError);
            });

    } else { // --- CREATE LOGIC ---
        toast({ title: "جاري إنشاء المستخدم...", description: "قد تستغرق هذه العملية بضع لحظات." });

        const authResult = await createAuthUser({
            email: data.email,
            password: data.password,
            displayName: data.name,
        });

        if (!authResult.success || !authResult.uid) {
            let description = "حدث خطأ غير متوقع أثناء إنشاء حساب المصادقة.";
            if (authResult.error === 'auth/email-already-exists') {
                description = "هذا البريد الإلكتروني مستخدم بالفعل.";
            }
            toast({ variant: "destructive", title: "فشل إنشاء الحساب", description });
            return;
        }

        const newUid = authResult.uid;
        const batch = writeBatch(firestore);

        const userPayload: any = {
            id: newUid,
            email: data.email,
            name: data.name,
            role: data.role,
            createdAt: serverTimestamp(),
        };

        if (data.role === 'company') {
            const companyRef = doc(firestore, 'companies', newUid);
            batch.set(companyRef, { id: newUid, name: data.name });
            userPayload.companyId = newUid;
        } else if (data.role === 'courier') {
            const courierRef = doc(firestore, 'couriers', newUid);
            const courierData = { id: newUid, name: data.name, commissionRate: data.commissionRate || 0 };
            batch.set(courierRef, courierData);
            if (data.commissionRate) {
                userPayload.commissionRate = data.commissionRate;
            }
        }

        const userDocRef = doc(firestore, 'users', newUid);
        batch.set(userDocRef, userPayload);
        
        const roleCollectionName = `roles_${data.role}`;
        const roleDocRef = doc(firestore, roleCollectionName, newUid);
        batch.set(roleDocRef, { email: data.email, createdAt: serverTimestamp() });
        
        batch.commit()
            .then(() => {
                toast({
                    title: "تم إنشاء المستخدم بنجاح!",
                    description: `تم إنشاء حساب لـ ${data.name} بدور "${data.role}".`,
                });
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: 'batch_write (users, roles, etc.)',
                    operation: 'write',
                    requestResourceData: { note: `Batch create for user ${data.email} failed.` }
                });
                errorEmitter.emit('permission-error', permissionError);
            });
    }
  };

  const handleDeleteUser = async () => {
    if (!firestore || !userToDelete) return;
    toast({ title: `جاري حذف ${userToDelete.name}...`});

    // 1. Delete from Auth
    const authResult = await deleteAuthUser({ uid: userToDelete.id });
    if (!authResult.success) {
      toast({ variant: "destructive", title: "فشل حذف المستخدم من نظام المصادقة", description: `حدث خطأ: ${authResult.error}` });
      setUserToDelete(null);
      return;
    }

    // 2. Delete from Firestore (users, roles_*, and couriers/companies)
    const batch = writeBatch(firestore);
    
    // Delete user doc
    const userDocRef = doc(firestore, 'users', userToDelete.id);
    batch.delete(userDocRef);

    // Delete role doc
    const roleDocRef = doc(firestore, `roles_${userToDelete.role}`, userToDelete.id);
    batch.delete(roleDocRef);

    // Delete company/courier doc
    if (userToDelete.role === 'company') {
      const companyDocRef = doc(firestore, 'companies', userToDelete.id);
      batch.delete(companyDocRef);
    } else if (userToDelete.role === 'courier') {
      const courierDocRef = doc(firestore, 'couriers', userToDelete.id);
      batch.delete(courierDocRef);
    }
    
    batch.commit().then(() => {
      toast({ title: "تم حذف المستخدم بنجاح", description: `تم حذف ${userToDelete.name} من النظام.`});
      setUserToDelete(null);
    }).catch(serverError => {
      toast({ variant: "destructive", title: "فشل حذف بيانات المستخدم", description: "تم حذف الحساب ولكن فشلت إزالة بياناته من قاعدة البيانات."});
      const permissionError = new FirestorePermissionError({
        path: `batch_delete`,
        operation: 'delete',
        requestResourceData: { note: `Batch delete for user ${userToDelete.id} failed.` }
      });
      errorEmitter.emit('permission-error', permissionError);
      setUserToDelete(null);
    });
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

  const courierDues = React.useMemo(() => {
    if (!users || !shipments) return [];
    return courierUsers.map(courier => {
        const courierShipments = shipments.filter(s => s.assignedCourierId === courier.id);
        const totalCollected = courierShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCommission = courierShipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
        const netDue = totalCollected - totalCommission;
        return {
            ...courier,
            totalCollected,
            totalCommission,
            netDue
        }
    })
  }, [users, shipments, courierUsers]);
  
  const companyRevenues = React.useMemo(() => {
    if (!companies || !shipments) return [];
    return companies.map(company => {
        const companyShipments = shipments.filter(s => s.companyId === company.id);
        const totalRevenue = companyShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCommission = companyShipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
        const netRevenue = totalRevenue - totalCommission;
        return {
            ...company,
            totalRevenue,
            netRevenue,
            shipmentCount: companyShipments.length
        }
    })
  }, [companies, shipments]);


  return (
    <>
      <Tabs defaultValue="all-shipments">
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all-shipments">الكل</TabsTrigger>
            <TabsTrigger value="in-transit" className="hidden sm:flex">قيد التوصيل</TabsTrigger>
            <TabsTrigger value="delivered" className="hidden sm:flex">تم التوصيل</TabsTrigger>
            <TabsTrigger value="returned" className="hidden sm:flex">مرتجعات</TabsTrigger>
            <TabsTrigger value="returned-to-sender" className="hidden sm:flex">مرتجع للراسل</TabsTrigger>
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
            <Button variant="outline" size="sm" onClick={handleImportClick}>
              <FileUp className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">استيراد</span>
            </Button>
             <Button variant="outline" size="sm" onClick={handleSeedData}>
              <Database className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only">بيانات وهمية</span>
            </Button>
             <Button size="sm" onClick={() => openShipmentForm()}>
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">شحنة جديدة</span>
              </Button>
          </div>
        </div>
        <StatsCards shipments={shipments || []} role={role} />
        <TabsContent value="all-shipments">
          <ShipmentsTable 
            shipments={filteredShipments} 
            isLoading={shipmentsLoading}
            governorates={governorates || []}
            companies={companies || []}
            couriers={courierUsers}
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
              couriers={courierUsers}
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
              couriers={courierUsers}
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
              couriers={courierUsers}
              onEdit={openShipmentForm}
              role={role}
           />
        </TabsContent>
        <TabsContent value="returned-to-sender">
           <ShipmentsTable 
              shipments={filteredShipments.filter(s => s.status === 'Returned to Sender')}
              isLoading={shipmentsLoading}
              governorates={governorates || []}
              companies={companies || []}
              couriers={courierUsers}
              onEdit={openShipmentForm}
              role={role}
           />
        </TabsContent>
        <TabsContent value="management">
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-headline font-semibold">المبالغ المستحقة على المناديب</h2>
                </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {courierDues.map(courier => (
                          <Card key={courier.id}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                                      {courier.name}
                                  </CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <div className="text-2xl font-bold">
                                      {courier.netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                      المبلغ المستحق للدفع
                                  </p>
                                  <div className="mt-4 space-y-2 text-sm">
                                      <div className="flex justify-between items-center">
                                          <span className="flex items-center gap-2 text-muted-foreground">
                                              <DollarSign className="h-4 w-4" />
                                              إجمالي التحصيل:
                                          </span>
                                          <span className="font-medium">{courier.totalCollected.toLocaleString('ar-EG', {style: 'currency', currency: 'EGP'})}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                          <span className="flex items-center gap-2 text-muted-foreground">
                                              <BadgePercent className="h-4 w-4" />
                                              إجمالي العمولات:
                                          </span>
                                          <span className="font-medium">{courier.totalCommission.toLocaleString('ar-EG', {style: 'currency', currency: 'EGP'})}</span>
                                      </div>
                                  </div>
                              </CardContent>
                          </Card>
                      ))}
                 </div>
              </div>
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-headline font-semibold">إيرادات الشركات</h2>
                </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {companyRevenues.map(company => (
                          <Card key={company.id}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                                      <Building className="h-4 w-4 text-muted-foreground" />
                                      {company.name}
                                  </CardTitle>
                              </CardHeader>
                              <CardContent>
                                  <div className="text-xl font-bold">
                                      {company.totalRevenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                      إجمالي الإيرادات من {company.shipmentCount} شحنة
                                  </p>
                                  <div className="mt-2 pt-2 border-t">
                                      <div className="text-lg font-bold text-primary">
                                          {company.netRevenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                          المبلغ المستحق للدفع (بعد العمولات)
                                      </p>
                                  </div>
                              </CardContent>
                          </Card>
                      ))}
                 </div>
              </div>
            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-headline font-semibold">إدارة المستخدمين والشركات</h2>
                   <div className="flex items-center gap-2">
                     <UserFormSheet 
                        open={isUserSheetOpen}
                        onOpenChange={setIsUserSheetOpen}
                        onSave={handleSaveUser}
                        user={editingUser}
                     >
                          <Button size="sm" onClick={() => openUserForm()}>
                              <PlusCircle className="h-4 w-4" />
                              <span className="sr-only sm:not-sr-only">
                                إضافة مستخدم
                              </span>
                          </Button>
                     </UserFormSheet>
                  </div>
                </div>
                <UsersTable users={users || []} isLoading={usersLoading || companiesLoading} onEdit={openUserForm} onDelete={setUserToDelete}/>
            </div>
       </TabsContent>
      </Tabs>
      <ShipmentFormSheet
        open={isShipmentSheetOpen}
        onOpenChange={handleSheetOpenChange}
        onSave={handleSaveShipment}
        shipment={editingShipment}
        governorates={governorates || []}
        couriers={courierUsers}
        companies={companies || []}
        role={role}
      >
        <div />
      </ShipmentFormSheet>
       <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف حساب المستخدم ({userToDelete?.name}) وجميع بياناته بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>متابعة</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
