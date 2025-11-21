

"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, ShipmentStatus, User, CourierPayment, Chat } from "@/lib/types";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import { collection, serverTimestamp, doc, query, where, updateDoc, getDoc, writeBatch } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShipmentCard } from "@/components/shipments/shipment-card";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Loader2, MessageSquare } from "lucide-react";
import ChatInterface from "../chat/chat-interface";

interface CourierDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}

export default function CourierDashboard({ user, role, searchTerm }: CourierDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
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


  // Effect to fetch shipment data if 'edit' param is in the URL
  React.useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
           const shipmentData = { id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment;
           // Ensure courier can only edit their own assigned shipments
           if (shipmentData.assignedCourierId === user?.id) {
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
    return query(collection(firestore, 'shipments'), where("assignedCourierId", "==", user.id), where("isArchived", "==", false));
  }, [firestore, user]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courier_payments'), where("courierId", "==", user.id), where("isArchived", "==", false));
  }, [firestore, user]);
  const { data: payments, isLoading: paymentsLoading } = useCollection<CourierPayment>(paymentsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'governorates');
  }, [firestore, user]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'companies');
  }, [firestore, user]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);
  
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
    const calculateCommissionAndPaidAmount = (
        status: ShipmentStatus,
        totalAmount: number,
        collectedAmount: number,
        courierCommissionRate: number,
    ) => {
        const update: { paidAmount?: number; courierCommission?: number; collectedAmount?: number } = {};
        
        const isSuccess = status === 'Delivered' || status === 'Partially Delivered' || status === 'Evasion';

        if (isSuccess) {
            update.courierCommission = courierCommissionRate;
            
            if (status === 'Delivered' || status === 'Evasion') {
                update.paidAmount = totalAmount;
                update.collectedAmount = totalAmount;
            } else { // Partially Delivered
                update.paidAmount = collectedAmount;
            }
        } else { // Returned, Cancelled, etc.
            update.paidAmount = 0;
            update.courierCommission = 0;
            update.collectedAmount = 0;
        }
        return update;
    }


  const handleSaveShipment = async (shipment: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !id || !user) return;
    
    const courierUser = user;
    if (!courierUser) {
        toast({ title: "لم يتم العثور على بيانات المندوب", variant: "destructive" });
        return;
    }

    const originalShipmentDocSnap = await getDoc(doc(firestore, 'shipments', id));
    if (!originalShipmentDocSnap.exists()) {
        toast({ title: "Shipment not found", variant: "destructive" });
        return;
    }
    const originalShipmentData = originalShipmentDocSnap.data() as Shipment;

    const courierCommissionRate = courierUser.commissionRate || 0;

    const dataToUpdate: { [key: string]: any } = {
        updatedAt: serverTimestamp(),
    };

    if (shipment.status !== undefined) dataToUpdate.status = shipment.status;
    if (shipment.reason !== undefined) dataToUpdate.reason = shipment.reason;
    const collectedAmount = shipment.collectedAmount !== undefined ? Number(shipment.collectedAmount) : originalShipmentData.collectedAmount || 0;
    if (shipment.collectedAmount !== undefined) dataToUpdate.collectedAmount = collectedAmount;

    const newStatus = shipment.status || originalShipmentData.status;

    const calculatedFields = calculateCommissionAndPaidAmount(
        newStatus,
        originalShipmentData.totalAmount,
        collectedAmount,
        courierCommissionRate
    );
    Object.assign(dataToUpdate, calculatedFields);

    if (Object.keys(dataToUpdate).length <= 1) { // Only updatedAt
        toast({ title: "لا توجد تغييرات للحفظ", variant: "default"});
        handleSheetOpenChange(false);
        return;
    }

    const docRef = doc(firestore, 'shipments', id);
    
    updateDoc(docRef, dataToUpdate)
      .then(() => {
        toast({
          title: "تم تحديث الشحنة",
          description: `تم تحديث حالة الشحنة بنجاح`,
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
  };

  const handleBulkUpdateShipments = (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !user) return;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }
    
    const courierUser = user;
     if (!courierUser) {
        toast({ title: "لم يتم العثور على بيانات المندوب", variant: "destructive" });
        return;
    }

    const courierCommissionRate = courierUser.commissionRate || 0;
    const batch = writeBatch(firestore);

    selectedRows.forEach(row => {
        const docRef = doc(firestore, "shipments", row.id);
        
        let finalUpdate: { [key: string]: any } = { updatedAt: serverTimestamp() };
        
        const allowedUpdates: Partial<Shipment> = {};
        if (update.status) allowedUpdates.status = update.status;
        if (update.reason) allowedUpdates.reason = update.reason;

        if (Object.keys(allowedUpdates).length === 0) {
            return;
        }

        const newStatus = allowedUpdates.status || row.status;
        
        const calculatedFields = calculateCommissionAndPaidAmount(
            newStatus,
            row.totalAmount,
            row.collectedAmount || 0,
            courierCommissionRate
        );

        Object.assign(finalUpdate, allowedUpdates, calculatedFields);
        
        batch.update(docRef, finalUpdate);
    });

    batch.commit().then(() => {
        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
    }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: 'shipments',
            operation: 'update',
            requestResourceData: { update, note: `Bulk update of ${selectedRows.length} documents.` }
        });
        errorEmitter.emit('permission-error', permissionError);
    });
};

  
  const { activeShipments, finishedShipments } = React.useMemo(() => {
    if (!shipments) return { activeShipments: [], finishedShipments: [] };
    const finishedStatuses: ShipmentStatus[] = ['Delivered', 'Partially Delivered', 'Evasion', 'Returned to Sender'];
    const active = shipments.filter(s => !finishedStatuses.includes(s.status));
    const finished = shipments.filter(s => finishedStatuses.includes(s.status));
    return { activeShipments: active, finishedShipments: finished };
  }, [shipments]);


  const filteredActiveShipments = React.useMemo(() => {
    if (!activeShipments) return [];
    if (!searchTerm) return activeShipments;
    const lowercasedTerm = searchTerm.toLowerCase();
    return activeShipments.filter(shipment => 
        shipment.shipmentCode?.toLowerCase().includes(lowercasedTerm) ||
        shipment.orderNumber?.toLowerCase().includes(lowercasedTerm) ||
        shipment.recipientName?.toLowerCase().includes(lowercasedTerm) ||
        shipment.trackingNumber?.toLowerCase().includes(lowercasedTerm) ||
        shipment.address?.toLowerCase().includes(lowercasedTerm)
    );
  }, [activeShipments, searchTerm]);
  
  const filteredFinishedShipments = React.useMemo(() => {
    if (!finishedShipments) return [];
    if (!searchTerm) return finishedShipments;
    const lowercasedTerm = searchTerm.toLowerCase();
    return finishedShipments.filter(shipment => 
        shipment.shipmentCode?.toLowerCase().includes(lowercasedTerm) ||
        shipment.orderNumber?.toLowerCase().includes(lowercasedTerm) ||
        shipment.recipientName?.toLowerCase().includes(lowercasedTerm) ||
        shipment.trackingNumber?.toLowerCase().includes(lowercasedTerm) ||
        shipment.address?.toLowerCase().includes(lowercasedTerm)
    );
  }, [finishedShipments, searchTerm]);


  const renderShipmentList = (shipmentList: Shipment[]) => {
    if (shipmentsLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-card rounded-lg border">
                <div className="w-full h-8 bg-muted rounded animate-pulse"/>
                <div className="w-full h-4 bg-muted rounded animate-pulse mt-3"/>
                <div className="w-1/2 h-4 bg-muted rounded animate-pulse mt-2"/>
            </div>
          ))}
        </div>
      );
    }
    if (shipmentList.length === 0) {
      return <div className="text-center py-10 text-muted-foreground">لا توجد شحنات في هذه الفئة.</div>;
    }
    return (
      <div className="space-y-3">
        {shipmentList.map(shipment => (
          <ShipmentCard 
            key={shipment.id}
            shipment={shipment}
            governorateName={governorates?.find(g => g.id === shipment.governorateId)?.name || ''}
            companyName={companies?.find(c => c.id === shipment.companyId)?.name || ''}
            onEdit={() => openShipmentForm(shipment)}
          />
        ))}
      </div>
    );
  }

  const renderDesktopTable = (shipmentList: Shipment[]) => (
    <ShipmentsTable 
      shipments={shipmentList} 
      isLoading={shipmentsLoading || companiesLoading}
      governorates={governorates || []}
      companies={companies || []}
      couriers={users?.filter(u => u.role === 'courier') || []}
      onEdit={openShipmentForm}
      onBulkUpdate={handleBulkUpdateShipments}
      role={role}
    />
  );
  
  const inTransitCount = filteredActiveShipments.filter(s => s.status === 'In-Transit').length;
  const returnedCount = filteredActiveShipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled').length;
  const postponedCount = filteredActiveShipments.filter(s => s.status === 'Postponed').length;

  return (
    <>
      <Tabs defaultValue="shipments" className="w-full">
         <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="shipments">الشحنات</TabsTrigger>
            <TabsTrigger value="chat" className="relative">
                <MessageSquare className="me-2 h-4 w-4" />
                <span>الدردشة</span>
                 {totalUnreadCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{totalUnreadCount}</Badge>
                )}
            </TabsTrigger>
            <TabsTrigger value="accounts">الحسابات</TabsTrigger>
        </TabsList>
         <TabsContent value="shipments">
            <div className="p-4 sm:p-0">
              <Tabs defaultValue="all">
                <div className="flex items-center">
                  <TabsList className="flex-nowrap overflow-x-auto justify-start">
                    <TabsTrigger value="all">النشطة <Badge variant="secondary" className="ms-2">{filteredActiveShipments.length}</Badge></TabsTrigger>
                    <TabsTrigger value="in-transit">قيد التوصيل <Badge variant="secondary" className="ms-2">{inTransitCount}</Badge></TabsTrigger>
                    <TabsTrigger value="postponed">المؤجلة <Badge variant="secondary" className="ms-2">{postponedCount}</Badge></TabsTrigger>
                    <TabsTrigger value="returned">مرتجعات <Badge variant="secondary" className="ms-2">{returnedCount}</Badge></TabsTrigger>
                    <TabsTrigger value="finished">المنتهية <Badge variant="secondary" className="ms-2">{filteredFinishedShipments.length}</Badge></TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="all" className="mt-4">
                  {isMobile ? renderShipmentList(filteredActiveShipments) : renderDesktopTable(filteredActiveShipments)}
                </TabsContent>
                <TabsContent value="in-transit" className="mt-4">
                  {isMobile ? renderShipmentList(filteredActiveShipments.filter(s => s.status === 'In-Transit')) : renderDesktopTable(filteredActiveShipments.filter(s => s.status === 'In-Transit'))}
                </TabsContent>
                <TabsContent value="postponed" className="mt-4">
                  {isMobile ? renderShipmentList(filteredActiveShipments.filter(s => s.status === 'Postponed')) : renderDesktopTable(filteredActiveShipments.filter(s => s.status === 'Postponed'))}
                </TabsContent>
                <TabsContent value="returned" className="mt-4">
                  {isMobile ? renderShipmentList(filteredActiveShipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled')) : renderDesktopTable(filteredActiveShipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled'))}
                </TabsContent>
                <TabsContent value="finished" className="mt-4">
                  {isMobile ? renderShipmentList(filteredFinishedShipments) : renderDesktopTable(filteredFinishedShipments)}
                </TabsContent>
              </Tabs>
            </div>
         </TabsContent>
        <TabsContent value="chat">
            <ChatInterface />
        </TabsContent>
         <TabsContent value="accounts">
             <div className="p-4 sm:p-0">
                <h1 className="text-2xl font-bold mb-4">ملخص الحسابات</h1>
                <p className="text-muted-foreground mb-6">
                    هنا يمكنك رؤية ملخص مالي لجميع شحناتك، بما في ذلك المبالغ المحصلة وعمولاتك والمدفوعات التي قمت بها.
                </p>
                {paymentsLoading || shipmentsLoading ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <StatsCards shipments={shipments || []} payments={payments || []} role={role} />
                )}
            </div>
         </TabsContent>
       </Tabs>

       <ShipmentFormSheet
        open={isShipmentSheetOpen}
        onOpenChange={handleSheetOpenChange}
        shipment={editingShipment}
        governorates={governorates || []}
        couriers={users?.filter(u => u.role === 'courier') || []}
        role={role}
        onSave={handleSaveShipment}
      >
        <div />
      </ShipmentFormSheet>
    </>
  );
}
