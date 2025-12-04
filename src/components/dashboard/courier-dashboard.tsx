
"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, ShipmentStatusKey, User, CourierPayment, Chat, ShipmentHistory, ShipmentStatusConfig } from "@/lib/types";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser, useFirebaseApp } from "@/firebase";
import { collection, serverTimestamp, doc, query, where, updateDoc, getDoc, writeBatch } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShipmentCard } from "@/components/shipments/shipment-card";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Loader2, MessageSquare, Database, Route } from "lucide-react";
import ChatInterface from "../chat/chat-interface";
import { sendPushNotification } from "@/lib/actions";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { Button } from "../ui/button";
import { RouteSummaryPage } from "./route-summary-page";

interface CourierDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}

const calculateCommissionAndPaidAmount = (
    shipment: Shipment,
    newStatus: string,
    collectedAmount: number,
    courierCommissionRate: number,
    company: Company | undefined,
    statusConfigs: ShipmentStatusConfig[],
) => {
    const update: { paidAmount: number; courierCommission: number; companyCommission: number; collectedAmount: number } = {
        paidAmount: 0,
        courierCommission: 0,
        companyCommission: 0,
        collectedAmount: 0,
    };
    
    const statusConfig = statusConfigs.find(s => s.id === newStatus);
    if (!statusConfig) return update;

    const safeTotalAmount = shipment.totalAmount || 0;
    const safeCollectedAmount = collectedAmount || 0;
    const safeCourierCommissionRate = courierCommissionRate || 0;
    const governorateCommission = (company && shipment.governorateId) ? (company.governorateCommissions?.[shipment.governorateId] || 0) : 0;
    
    let amountForCalc = 0;
    if (statusConfig.requiresFullCollection) {
        amountForCalc = safeTotalAmount;
    } else if (statusConfig.requiresPartialCollection) {
        amountForCalc = safeCollectedAmount;
    }
    
    update.paidAmount = amountForCalc;
    update.collectedAmount = amountForCalc;

    if (amountForCalc > 0) { // Commissions are typically on successful collection
        if (statusConfig.affectsCompanyBalance) {
            update.companyCommission = governorateCommission;
        }
    }

    // Courier commission can sometimes be due on returns
    if (statusConfig.affectsCourierBalance) {
        update.courierCommission = safeCourierCommissionRate;
    }

    return update;
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
  const app = useFirebaseApp();
  
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


  React.useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
           const shipmentData = { id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment;
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
      const newParams = new URLSearchParams(searchParams.toString());
      if (newParams.has('edit')) {
        newParams.delete('edit');
        router.replace(`${pathname}?${newParams.toString()}`);
      }
    }
  };

  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'shipments'), 
        where("assignedCourierId", "==", user.id)
    );
  }, [firestore, user]);
  const { data: allShipmentsForCourier, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);
  
  const shipments = React.useMemo(() => {
    return allShipmentsForCourier?.filter(s => !s.isArchivedForCourier) || [];
  }, [allShipmentsForCourier]);

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courier_payments'), where("courierId", "==", user.id));
  }, [firestore, user]);
  const { data: payments, isLoading: paymentsLoading } = useCollection<CourierPayment>(paymentsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'governorates');
  }, [firestore, user]);
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'companies');
  }, [firestore, user]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const statusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'shipment_statuses'));
  }, [firestore]);
  const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);

  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const handleSaveShipment = async (shipmentData: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!id || !app || !shipmentData.status || !editingShipment || !statuses || !companies) return;

    const functions = getFunctions(app);
    const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

    toast({ title: "جاري تحديث الحالة..." });

    try {
        const company = companies.find(c => c.id === editingShipment.companyId);
        
        const calculatedFields = calculateCommissionAndPaidAmount(
            editingShipment,
            shipmentData.status,
            shipmentData.collectedAmount || 0,
            user.commissionRate || 0,
            company,
            statuses
        );
        
        const payload = {
            shipmentId: id,
            status: shipmentData.status,
            reason: shipmentData.reason || "",
            ...calculatedFields
        };

        await handleShipmentUpdateFn(payload);
        toast({ title: "تم تحديث الشحنة بنجاح" });
        handleSheetOpenChange(false);
    } catch (error: any) {
        console.error("Error updating shipment:", error);
        toast({
            title: "فشل تحديث الشحنة",
            description: error.message || "حدث خطأ أثناء الاتصال بالخادم.",
            variant: "destructive"
        });
    }
  };

const handleBulkUpdateShipments = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (selectedRows.length === 0 || !update.status || !statuses || !companies) {
        toast({ title: "لم يتم تحديد أي شحنات أو حالة", variant: "destructive" });
        return;
    }
    
    toast({ title: `جاري تحديث ${selectedRows.length} شحنة...` });

    const functions = getFunctions(app);
    const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

    const updatePromises = selectedRows.map(row => {
        const company = companies.find(c => c.id === row.companyId);
        const calculatedFields = calculateCommissionAndPaidAmount(
            row,
            update.status!,
            0, // Bulk updates don't support partial collection
            user.commissionRate || 0,
            company,
            statuses
        );

        const payload = {
            shipmentId: row.id,
            status: update.status,
            reason: update.reason || 'تحديث جماعي',
            ...calculatedFields,
        };
        return handleShipmentUpdateFn(payload).catch(error => ({
            shipmentId: row.id,
            error: error.message || "فشل التحديث"
        }));
    });

    const results = await Promise.all(updatePromises);
    const failedUpdates = results.filter(res => res && 'error' in res);

    if (failedUpdates.length > 0) {
        toast({
            title: `فشل تحديث ${failedUpdates.length} شحنة`,
            description: "بعض الشحنات لم يتم تحديثها بسبب خطأ. يرجى المحاولة مرة أخرى.",
            variant: "destructive"
        });
    } else {
        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
    }
};

  
  const { activeShipments, finishedShipments } = React.useMemo(() => {
    if (!shipments) return { activeShipments: [], finishedShipments: [] };
    const finishedStatuses: string[] = ['Delivered', 'Returned to Sender'];
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
            statusConfig={statuses?.find(sc => sc.id === shipment.status)}
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
      couriers={[]}
      statuses={statuses || []}
      onEdit={openShipmentForm}
      onBulkUpdate={handleBulkUpdateShipments}
      role={role}
    />
  );
  
  const inTransitCount = filteredActiveShipments.filter(s => s.status === 'In-Transit').length;
  const returnedCount = filteredActiveShipments.filter(s => ['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)'].includes(s.status)).length;
  const postponedCount = filteredActiveShipments.filter(s => s.status === 'Postponed').length;


  return (
    <>
      <Tabs defaultValue="shipments" className="w-full">
         <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shipments">الشحنات</TabsTrigger>
            <TabsTrigger value="route-summary">
                <Route className="me-2 h-4 w-4" />
                موجز خط السير
            </TabsTrigger>
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
              <Tabs defaultValue="active">
                <div className="flex items-center">
                  <TabsList className="flex-nowrap overflow-x-auto justify-start">
                    <TabsTrigger value="active">النشطة <Badge variant="secondary" className="ms-2">{filteredActiveShipments.length}</Badge></TabsTrigger>
                    <TabsTrigger value="finished">المنتهية <Badge variant="secondary" className="ms-2">{filteredFinishedShipments.length}</Badge></TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="active" className="mt-4">
                  {isMobile ? renderShipmentList(filteredActiveShipments) : renderDesktopTable(filteredActiveShipments)}
                </TabsContent>
                <TabsContent value="finished" className="mt-4">
                  {isMobile ? renderShipmentList(filteredFinishedShipments) : renderDesktopTable(filteredFinishedShipments)}
                </TabsContent>
              </Tabs>
            </div>
         </TabsContent>
        <TabsContent value="route-summary">
            <RouteSummaryPage 
              shipments={activeShipments} 
              governorates={governorates || []}
              isLoading={shipmentsLoading || governoratesLoading}
            />
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
        couriers={[]}
        companies={companies || []}
        statuses={statuses || []}
        role={role}
        onSave={handleSaveShipment}
      >
        <div />
      </ShipmentFormSheet>
    </>
  );
}
