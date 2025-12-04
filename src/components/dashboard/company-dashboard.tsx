

"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PlusCircle, FileUp, MessageSquare, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, User, Chat, ShipmentHistory, ShipmentStatus } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { ImportProgressDialog, type ImportProgress } from "@/components/shipments/import-progress-dialog";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, updateDoc, setDoc, getDoc } from "firebase/firestore";
import ChatInterface from "../chat/chat-interface";
import { Badge } from "../ui/badge";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { sendPushNotification } from "@/lib/actions";
import { ShipmentCard } from "../shipments/shipment-card";
import { useIsMobile } from "@/hooks/use-mobile";

interface CompanyDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}

export default function CompanyDashboard({ user, role, searchTerm }: CompanyDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isMobile = useIsMobile();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [importProgress, setImportProgress] = React.useState<ImportProgress | null>(null);

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

  // Effect to fetch shipment data if 'edit' param is in the URL
  React.useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
           const shipmentData = { id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment;
           // Ensure company user can only edit their own shipments
           if (shipmentData.companyId === user?.id) {
               setEditingShipment(shipmentData);
               setShipmentSheetOpen(true);
           } else {
                toast({ title: "غير مصرح لك", description: "لا يمكنك تعديل هذه الشحنة.", variant: "destructive" });
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.delete('edit');
                router.replace(`${pathname}?${newParams.toString()}`);
           }
        } else {
          console.warn("Shipment to edit not found");
           const newParams = new URLSearchParams(searchParams.toString());
           newParams.delete('edit');
           router.replace(`${pathname}?${newParams.toString()}`);
        }
      };
      fetchShipment();
    }
  }, [searchParams, firestore, router, pathname, user?.id, toast]);

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
    return query(collection(firestore, 'shipments'), where("companyId", "==", user.id), where("isArchivedForCompany", "==", false));
  }, [firestore, user]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'governorates'));
  }, [firestore, user]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);
  
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'), where("role", "==", "courier"));
  }, [firestore, user]);
  const { data: courierUsers } = useCollection<User>(usersQuery);

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
    if (file && firestore && user) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = read(data, { type: 'binary', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = utils.sheet_to_json<any>(worksheet);

          setImportProgress({ added: 0, updated: 0, total: json.length, processing: true });
          const batch = writeBatch(firestore);
          let addedCount = 0;
          let updatedCount = 0;
          const shipmentsCollection = collection(firestore, 'shipments');

          for (const [index, row] of json.entries()) {
              const trackingNumber = row['رقم الشحنة']?.toString() || `TRK-${Date.now()}-${index}`;
              if (!trackingNumber) continue;

              const deliveryDate = parseExcelDate(row['تاريخ التسليم للمندوب']);
              const creationDate = parseExcelDate(row['التاريخ']);
              const totalAmountValue = row['الاجمالي'] || row['الاجمالى'] || '0';
              const senderNameValue = row['الراسل'] || row['العميل الفرعي'];
              const orderNumberValue = row['رقم الطلب']?.toString() || `ORD-${Date.now()}-${index}`;
              const shipmentCodeValue = row['كود الشحنة']?.toString() || `SH-${Date.now()}-${index}`;

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
                  isArchivedForCompany: false,
                  isArchivedForCourier: false,
                  companyId: user.id, // Shipment belongs to the current company user
              };

              const cleanShipmentData = Object.fromEntries(Object.entries(shipmentData).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
              
              const q = query(shipmentsCollection, where("trackingNumber", "==", trackingNumber), where("companyId", "==", user.id));
              const querySnapshot = await getDocs(q);

              if (querySnapshot.empty) {
                  const docRef = doc(shipmentsCollection);
                  batch.set(docRef, { 
                      ...cleanShipmentData, 
                      id: docRef.id,
                      trackingNumber, 
                      shipmentCode: shipmentCodeValue,
                      createdAt: creationDate || serverTimestamp()
                  });
                  addedCount++;
                   setImportProgress(prev => prev ? { ...prev, added: addedCount } : null);
              } else {
                  const docRef = querySnapshot.docs[0].ref;
                   // Exclude status and assignedCourierId from updates
                  const { status, assignedCourierId, ...updateData } = cleanShipmentData;
                  batch.update(docRef, updateData);
                  updatedCount++;
                  setImportProgress(prev => prev ? { ...prev, updated: updatedCount } : null);
              }
          }
          
          await batch.commit().catch(serverError => {
            if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({
                    path: 'shipments',
                    operation: 'write',
                    requestResourceData: {note: "Batch import operation failed"}
                });
                errorEmitter.emit('permission-error', permissionError);
            }
          });
          
          setImportProgress(prev => prev ? { ...prev, processing: false } : null);

        } catch (error: any) {
            console.error("Error importing file:", error);
            setImportProgress(prev => prev ? { ...prev, processing: false, error: "حدث خطأ أثناء معالجة الملف. يرجى التحقق من تنسيق الملف والمحاولة مرة أخرى." } : null);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleSaveShipment = async (shipment: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !user) return;

    const cleanShipmentData: { [key: string]: any } = Object.fromEntries(
      Object.entries(shipment).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';

    const batch = writeBatch(firestore);
    const shipmentRef = id ? doc(firestore, 'shipments', id) : doc(collection(firestore, 'shipments'));
    let oldStatus: ShipmentStatus | undefined;
    
    if (id) {
        const docSnap = await getDoc(shipmentRef);
        if (docSnap.exists()) oldStatus = docSnap.data().status;
        batch.update(shipmentRef, { ...cleanShipmentData, updatedAt: serverTimestamp() });
    } else {
        batch.set(shipmentRef, { 
            ...cleanShipmentData, 
            companyId: user.id, 
            isArchivedForCourier: false,
            isArchivedForCompany: false,
            createdAt: serverTimestamp(), 
            updatedAt: serverTimestamp() 
          });
    }

    const newStatus = cleanShipmentData.status as ShipmentStatus;
    if (newStatus && newStatus !== oldStatus) {
        const historyRef = doc(collection(shipmentRef, 'history'));
        const historyEntry: Omit<ShipmentHistory, 'id'> = {
            status: newStatus,
            reason: cleanShipmentData.reason || '',
            updatedAt: serverTimestamp(),
            updatedBy: user.name || user.email,
            userId: user.id,
        };
        batch.set(historyRef, historyEntry);
    }
    
    batch.commit()
      .then(() => {
        toast({
          title: id ? "تم تحديث الشحنة" : "تم حفظ الشحنة",
          description: `تمت العملية بنجاح`,
        });
        handleSheetOpenChange(false);
        if (shipment.assignedCourierId) {
          sendPushNotification({
            recipientId: shipment.assignedCourierId,
            title: 'شحنة جديدة',
            body: `تم تعيين شحنة جديدة لك: ${shipment.recipientName}`,
            url: notificationUrl,
          }).catch(console.error);
        }
      })
      .catch(serverError => {
        if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `shipments/${id || ''}`,
                operation: id ? 'update' : 'create',
                requestResourceData: cleanShipmentData
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
            toast({
                title: "حدث خطأ",
                description: "لم نتمكن من حفظ الشحنة. يرجى المحاولة مرة أخرى.",
                variant: "destructive"
            });
        }
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


  const handleGenericBulkUpdate = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !user) return;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }
    
    const batch = writeBatch(firestore);

    // Fetch full data for each row to ensure we have the latest status
    const fullSelectedRowsData = await Promise.all(
        selectedRows.map(row => getDoc(doc(firestore, "shipments", row.id)))
    );

    fullSelectedRowsData.forEach(docSnap => {
        if (!docSnap.exists()) return;
        const row = docSnap.data() as Shipment;
        const docRef = docSnap.ref;
        const finalUpdate: { [key: string]: any } = { ...update, updatedAt: serverTimestamp() };

        // Add history entry if status is changing
        const newStatus = update.status;
        const oldStatus = row.status;
        if (newStatus && newStatus !== oldStatus) {
            const historyRef = doc(collection(docRef, 'history'));
            const historyEntry: Omit<ShipmentHistory, 'id'> = {
                status: newStatus,
                reason: update.reason || 'تحديث جماعي',
                updatedAt: serverTimestamp(),
                updatedBy: user.name || user.email,
                userId: user.id,
            };
            batch.set(historyRef, historyEntry);
        }
        
        batch.update(docRef, finalUpdate);
    });

    try {
        await batch.commit();

        if (update.assignedCourierId && selectedRows.length > 0) {
            const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
            await sendPushNotification({
                recipientId: update.assignedCourierId,
                title: 'شحنات جديدة',
                body: `تم تعيين ${selectedRows.length} شحنة جديدة لك.`,
                url: notificationUrl,
            });
        }

        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
    } catch (serverError) {
        if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: 'shipments',
                operation: 'update',
                requestResourceData: { update, note: `Bulk update of ${selectedRows.length} documents.` }
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }
  }
  
  const renderShipmentList = (shipmentsToRender: Shipment[], isLoading: boolean) => {
    if (isLoading) {
        return <div className="text-center py-10"><p>جاري التحميل...</p></div>;
    }
    if (shipmentsToRender.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">لا توجد شحنات.</div>;
    }
    return (
        <div className="space-y-4">
            {shipmentsToRender.map(s => (
                <ShipmentCard
                    key={s.id}
                    shipment={s}
                    governorateName={governorates?.find(g => g.id === s.governorateId)?.name || ''}
                    companyName={user.name || ''}
                    onEdit={openShipmentForm}
                />
            ))}
        </div>
    );
  };
  
  const renderShipmentTable = (shipmentsToRender: Shipment[], isLoading: boolean) => (
       <ShipmentsTable 
            shipments={shipmentsToRender} 
            isLoading={isLoading}
            governorates={governorates || []}
            companies={[]}
            couriers={courierUsers || []}
            onEdit={openShipmentForm}
            role={role}
            onBulkUpdate={handleGenericBulkUpdate}
        />
  );


  return (
    <div className="flex flex-col w-full">
        <Tabs defaultValue="shipments">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="shipments">الشحنات</TabsTrigger>
                <TabsTrigger value="chat" className="relative">
                    <MessageSquare className="me-2 h-4 w-4" />
                    <span>الدردشة</span>
                    {totalUnreadCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{totalUnreadCount}</Badge>
                    )}
                </TabsTrigger>
            </TabsList>
            <TabsContent value="shipments" className="p-4 sm:p-0">
                <Tabs defaultValue="all-shipments">
                    <div className="flex items-center">
                        <TabsList className="flex-nowrap overflow-x-auto justify-start">
                        <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                        <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
                        <TabsTrigger value="delivered">تم التوصيل</TabsTrigger>
                        <TabsTrigger value="returned">مرتجعات</TabsTrigger>
                        <TabsTrigger value="returned-to-sender">مرتجع للراسل</TabsTrigger>
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
                            <span className="sr-only sm:not-sr-only">
                            استيراد
                            </span>
                        </Button>
                        <Button size="sm" onClick={() => openShipmentForm()}>
                            <PlusCircle className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only">
                            شحنة جديدة
                            </span>
                        </Button>
                        </div>
                    </div>
                    <StatsCards shipments={shipments || []} role={role} />
                    {isMobile ? (
                        <>
                            <TabsContent value="all-shipments">{renderShipmentList(filteredShipments, shipmentsLoading)}</TabsContent>
                            <TabsContent value="in-transit">{renderShipmentList(filteredShipments.filter(s => s.status === 'In-Transit'), shipmentsLoading)}</TabsContent>
                            <TabsContent value="delivered">{renderShipmentList(filteredShipments.filter(s => ['Delivered'].includes(s.status)), shipmentsLoading)}</TabsContent>
                            <TabsContent value="returned">{renderShipmentList(filteredShipments.filter(s => ['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)'].includes(s.status)), shipmentsLoading)}</TabsContent>
                            <TabsContent value="returned-to-sender">{renderShipmentList(filteredShipments.filter(s => s.status === 'Returned to Sender'), shipmentsLoading)}</TabsContent>
                        </>
                    ) : (
                         <>
                            <TabsContent value="all-shipments">{renderShipmentTable(filteredShipments, shipmentsLoading)}</TabsContent>
                            <TabsContent value="in-transit">{renderShipmentTable(filteredShipments.filter(s => s.status === 'In-Transit'), shipmentsLoading)}</TabsContent>
                            <TabsContent value="delivered">{renderShipmentTable(filteredShipments.filter(s => ['Delivered'].includes(s.status)), shipmentsLoading)}</TabsContent>
                            <TabsContent value="returned">{renderShipmentTable(filteredShipments.filter(s => ['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)'].includes(s.status)), shipmentsLoading)}</TabsContent>
                            <TabsContent value="returned-to-sender">{renderShipmentTable(filteredShipments.filter(s => s.status === 'Returned to Sender'), shipmentsLoading)}</TabsContent>
                        </>
                    )}
                </Tabs>
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
        couriers={courierUsers || []}
        companies={[]}
        role={role}
      >
        <div />
      </ShipmentFormSheet>
      {importProgress && (
        <ImportProgressDialog
          progress={importProgress}
          onClose={() => setImportProgress(null)}
        />
      )}
    </div>
  );
}
