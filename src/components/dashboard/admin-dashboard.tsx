
"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PlusCircle, FileUp, Database, User as UserIcon, Building, BadgePercent, DollarSign, Truck as CourierIcon, CalendarClock, MessageSquare, HandCoins, History, Pencil, Trash2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, User, CourierPayment, Chat } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { UserFormSheet } from "@/components/users/user-form-sheet";
import { CourierPaymentFormSheet } from "@/components/users/courier-payment-form-sheet";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, updateDoc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ChatInterface from "@/components/chat/chat-interface";
import { Badge } from "../ui/badge";
import { useNotificationSound } from "@/hooks/use-notification-sound";


interface AdminDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}

export default function AdminDashboard({ user, role, searchTerm }: AdminDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [isUserSheetOpen, setIsUserSheetOpen] = React.useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [editingUser, setEditingUser] = React.useState<User | undefined>(undefined);
  const [editingPayment, setEditingPayment] = React.useState<CourierPayment | undefined>(undefined);
  const [payingCourier, setPayingCourier] = React.useState<User | undefined>(undefined);
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [paymentToDelete, setPaymentToDelete] = React.useState<CourierPayment | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return query(
      collection(firestore, 'chats'),
      where('participants', 'array-contains', user.id)
    );
  }, [firestore, user?.id]);

  const { data: chats } = useCollection<Chat>(chatsQuery);
  
  const totalUnreadCount = React.useMemo(() => {
    if (!chats || !user?.id) return 0;
    return chats.reduce((sum, chat) => sum + (chat.unreadCounts?.[user.id] || 0), 0);
  }, [chats, user?.id]);

  useNotificationSound(totalUnreadCount);

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

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courier_payments'));
  }, [firestore, user]);
  const { data: payments } = useCollection<CourierPayment>(paymentsQuery);
  
  const courierUsers = React.useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);
  
  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const openUserForm = (user?: User) => {
    setEditingUser(user);
    setIsUserSheetOpen(true);
  };

  const openPaymentForm = (courier: User, payment?: CourierPayment) => {
    setPayingCourier(courier);
    setEditingPayment(payment);
    setIsPaymentSheetOpen(true);
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
    if (file && firestore && user && companies) {
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

          for (const [index, row] of json.entries()) {
              const trackingNumber = row['رقم الشحنة']?.toString();
              if (!trackingNumber) continue;

              const deliveryDate = parseExcelDate(row['تاريخ التسليم للمندوب']);
              const creationDate = parseExcelDate(row['التاريخ']);
              const totalAmountValue = row['الاجمالي'] || row['الاجمالى'] || '0';
              const senderNameValue = row['الراسل'] || row['العميل الفرعي'];
              const orderNumberValue = row['رقم الطلب']?.toString() || `ORD-${Date.now()}-${index}`;
              
              const companyNameFromSheet = row['الشركة']?.toString().trim();
              const foundCompany = companies.find(c => c.name === companyNameFromSheet);


              const shipmentData: Partial<Shipment> = {
                  senderName: senderNameValue,
                  orderNumber: orderNumberValue,
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
                  companyId: foundCompany ? foundCompany.id : user.uid,
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
    if (!firestore) {
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

  const handleSavePayment = (paymentData: { amount: number; notes?: string }, paymentId?: string) => {
    if (!firestore || !payingCourier || !user) return;
    
    if (paymentId) { // Update existing payment
      const paymentDocRef = doc(firestore, 'courier_payments', paymentId);
      const dataToUpdate = { ...paymentData, updatedAt: serverTimestamp() };

      updateDoc(paymentDocRef, dataToUpdate)
        .then(() => {
          toast({
            title: "تم تحديث الدفعة",
            description: `تم تحديث دفعة من ${payingCourier.name}.`,
          });
        })
        .catch(serverError => {
          const permissionError = new FirestorePermissionError({
              path: paymentDocRef.path,
              operation: 'update',
              requestResourceData: dataToUpdate,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

    } else { // Create new payment
      const paymentsCollection = collection(firestore, 'courier_payments');
      const paymentDocRef = doc(paymentsCollection);
      const newPayment: CourierPayment = {
          id: paymentDocRef.id,
          courierId: payingCourier.id,
          amount: paymentData.amount,
          paymentDate: serverTimestamp(),
          recordedById: user.id,
          notes: paymentData.notes || "",
      };

      setDoc(paymentDocRef, newPayment)
        .then(() => {
          toast({
            title: "تم تسجيل الدفعة بنجاح",
            description: `تم تسجيل دفعة من ${payingCourier.name} بقيمة ${paymentData.amount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}.`,
          });
        })
        .catch(serverError => {
          const permissionError = new FirestorePermissionError({
              path: paymentDocRef.path,
              operation: 'create',
              requestResourceData: newPayment,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }

    setIsPaymentSheetOpen(false);
    setPayingCourier(undefined);
    setEditingPayment(undefined);
  };
  
  const handleDeletePayment = () => {
    if (!firestore || !paymentToDelete) return;
    
    const docRef = doc(firestore, 'courier_payments', paymentToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        toast({
          title: "تم حذف الدفعة",
          description: "تم حذف سجل الدفعة بنجاح.",
        });
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setPaymentToDelete(null);
      });
  };

  const filteredShipments = React.useMemo(() => {
    if (!shipments) return [];
    if (!searchTerm) return shipments;
    const lowercasedTerm = searchTerm.toLowerCase();
    return shipments.filter(shipment => 
        shipment.shipmentCode?.toLowerCase().includes(lowercasedTerm) ||
        shipment.orderNumber?.toLowerCase().includes(lowercasedTerm) ||
        shipment.recipientName?.toLowerCase().includes(lowercasedTerm) ||
        shipment.trackingNumber?.toLowerCase().includes(lowercasedTerm) ||
        shipment.address?.toLowerCase().includes(lowercasedTerm)
    );
  }, [shipments, searchTerm]);

  const courierDues = React.useMemo(() => {
    if (!users || !shipments) return [];
    
    return courierUsers.map(courier => {
        const courierShipments = shipments.filter(s => s.assignedCourierId === courier.id);
        const totalCollected = courierShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCommission = courierShipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
        
        const courierPayments = payments?.filter(p => p.courierId === courier.id) || [];
        const totalPaidByCourier = courierPayments.reduce((acc, p) => acc + p.amount, 0);

        const netDue = (totalCollected - totalCommission) - totalPaidByCourier;
        
        return {
            ...courier,
            totalShipments: courierShipments.length,
            deliveredCount: courierShipments.filter(s => s.status === 'Delivered' || s.status === 'Partially Delivered' || s.status === 'Evasion').length,
            returnedCount: courierShipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled').length,
            totalCollected,
            totalCommission,
            totalPaidByCourier,
            netDue,
            paymentHistory: courierPayments.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0)),
        }
    })
  }, [users, shipments, courierUsers, payments]);
  
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

  const currentNetDue = courierDues.find(c => c.id === payingCourier?.id)?.netDue;

  return (
    <div className="flex flex-col w-full">
        <Tabs defaultValue="shipments">
        <div className="flex items-center">
            <TabsList className="flex-nowrap overflow-x-auto justify-start">
            <TabsTrigger value="shipments">الشحنات</TabsTrigger>
            <TabsTrigger value="courier-management">إدارة المناديب</TabsTrigger>
            <TabsTrigger value="company-management">إدارة الشركات</TabsTrigger>
            <TabsTrigger value="user-management">إدارة المستخدمين</TabsTrigger>
            <TabsTrigger value="chat" className="relative">
              الدردشة
              {totalUnreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{totalUnreadCount}</Badge>
              )}
            </TabsTrigger>
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
                <Button size="sm" onClick={() => openShipmentForm()}>
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">شحنة جديدة</span>
                </Button>
            </div>
        </div>
        <StatsCards shipments={shipments || []} role={role} />
        <TabsContent value="shipments">
            <Tabs defaultValue="all-shipments">
                <TabsList className="flex-nowrap overflow-x-auto justify-start mt-4">
                    <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                    <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
                    <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
                    <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
                    <TabsTrigger value="returned">مرتجعات</TabsTrigger>
                    <TabsTrigger value="returned-to-sender">مرتجع للراسل</TabsTrigger>
                </TabsList>
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
                <TabsContent value="postponed">
                    <ShipmentsTable 
                        shipments={filteredShipments.filter(s => s.status === 'Postponed')}
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
                        shipments={filteredShipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled')}
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
            </Tabs>
        </TabsContent>
        <TabsContent value="courier-management">
             <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-headline font-semibold">إدارة أداء المناديب</h2>
                </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {courierDues.map(courier => (
                            <Card key={courier.id} className="flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        {courier.name}
                                    </CardTitle>
                                    <div className={`text-xl font-bold ${courier.netDue > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                        {courier.netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-xs text-muted-foreground">
                                        المبلغ المستحق على المندوب
                                    </p>
                                    <div className="mt-4 space-y-2 text-sm">
                                         <div className="flex justify-between items-center border-b pb-2">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <CourierIcon className="h-4 w-4" />
                                                إجمالي الشحنات:
                                            </span>
                                            <span className="font-medium">{courier.totalShipments}</span>
                                        </div>
                                         <div className="flex justify-between items-center">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                تم التسليم:
                                            </span>
                                            <span className="font-medium text-green-600">{courier.deliveredCount}</span>
                                        </div>
                                         <div className="flex justify-between items-center">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                مرتجعات:
                                            </span>
                                            <span className="font-medium text-red-600">{courier.returnedCount}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t">
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
                                         <div className="flex justify-between items-center border-t pt-2 mt-2">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <WalletCards className="h-4 w-4" />
                                                إجمالي المدفوعات:
                                            </span>
                                            <span className="font-medium text-green-700">{courier.totalPaidByCourier.toLocaleString('ar-EG', {style: 'currency', currency: 'EGP'})}</span>
                                        </div>
                                        
                                        {courier.paymentHistory && courier.paymentHistory.length > 0 && (
                                            <Collapsible className="pt-2 text-xs">
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="flex items-center gap-2 w-full justify-start p-0 h-auto text-xs">
                                                        <History className="h-3 w-3"/>
                                                        <span>عرض سجل الدفعات ({courier.paymentHistory.length})</span>
                                                    </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="space-y-2 mt-2">
                                                  {courier.paymentHistory.map(payment => (
                                                      <div key={payment.id} className="flex justify-between items-center text-muted-foreground p-2 rounded-md bg-muted/50">
                                                          <div>
                                                              <span className="font-semibold">{payment.amount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span>
                                                              <span className="mx-2">-</span>
                                                              <span>{new Date(payment.paymentDate?.toDate?.() || Date.now()).toLocaleDateString('ar-EG')}</span>
                                                          </div>
                                                          <div className="flex items-center">
                                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openPaymentForm(courier, payment)}>
                                                                  <Pencil className="h-3 w-3" />
                                                              </Button>
                                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setPaymentToDelete(payment)}>
                                                                  <Trash2 className="h-3 w-3" />
                                                              </Button>
                                                          </div>
                                                      </div>
                                                  ))}
                                                </CollapsibleContent>
                                            </Collapsible>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button variant="outline" className="w-full" onClick={() => openPaymentForm(courier)} disabled={courier.netDue <= 0}>
                                        <HandCoins className="me-2 h-4 w-4" />
                                        تسوية الحساب
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
        </TabsContent>
         <TabsContent value="company-management">
               <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl fontheadline font-semibold">إيرادات الشركات</h2>
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
        </TabsContent>
        <TabsContent value="user-management">
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
        <TabsContent value="chat">
           <ChatInterface />
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
       <AlertDialog open={!!paymentToDelete} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف الدفعة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف سجل هذه الدفعة بشكل نهائي. سيؤثر هذا على المبلغ المستحق على المندوب. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPaymentToDelete(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CourierPaymentFormSheet
        open={isPaymentSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPayingCourier(undefined);
            setEditingPayment(undefined);
          }
          setIsPaymentSheetOpen(open);
        }}
        courier={payingCourier}
        payment={editingPayment}
        onSave={handleSavePayment}
        netDue={currentNetDue}
      />
    </div>
  );
}

    

    