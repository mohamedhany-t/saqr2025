

"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, ShipmentStatusKey, User, CourierPayment, Chat, ShipmentHistory, ShipmentStatusConfig } from "@/lib/types";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser, useFirebaseApp, useDoc } from "@/firebase";
import { collection, serverTimestamp, doc, query, where, updateDoc, getDoc, writeBatch } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ShipmentCard } from "@/components/shipments/shipment-card";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { Loader2, MessageSquare, Database, Route, CheckCircle, Archive, Truck, QrCode, CalendarClock, RefreshCw, Star } from "lucide-react";
import ChatInterface from "../chat/chat-interface";
import { sendPushNotification } from "@/lib/actions";
import { useNotificationSound } from "@/hooks/use-notification-sound";
import { Button } from "../ui/button";
import { RouteSummaryPage } from "./route-summary-page";
import type { Html5QrcodeResult } from "html5-qrcode";
import { QRScannerDialog } from "@/components/shipments/qr-scanner-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const calculateCommissionAndPaidAmount = (
    status: string,
    totalAmount: number,
    collectedAmount: number,
    courierCommissionRate: number,
    statusConfigs: ShipmentStatusConfig[],
) => {
    const update: { paidAmount: number; courierCommission: number; collectedAmount: number } = {
        paidAmount: 0,
        courierCommission: 0,
        collectedAmount: 0,
    };
    
    const statusConfig = statusConfigs.find(s => s.id === status);
    if (!statusConfig) return update;

    const safeTotalAmount = totalAmount || 0;
    const safeCollectedAmount = collectedAmount || 0;
    const safeCourierCommissionRate = courierCommissionRate || 0;
    
    let amountForCalc = 0;
    if (statusConfig.requiresFullCollection) {
        amountForCalc = safeTotalAmount;
    } else if (statusConfig.requiresPartialCollection) {
        amountForCalc = safeCollectedAmount;
    }
    
    update.paidAmount = amountForCalc;
    update.collectedAmount = amountForCalc;

    if (statusConfig.affectsCourierBalance) {
        update.courierCommission = safeCourierCommissionRate;
    }

    return update;
}


interface CourierDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export default function CourierDashboard({ user, role, searchTerm, onSearchChange }: CourierDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [exchangeAlertShipment, setExchangeAlertShipment] = React.useState<Shipment | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const app = useFirebaseApp();
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("active");
  const [showRetryPopup, setShowRetryPopup] = React.useState(false);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const [showAdminNote, setShowAdminNote] = React.useState(false);
  
  React.useEffect(() => {
    // Intercept back button for PWA exit confirmation
    const handlePopState = (event: PopStateEvent) => {
      // Check if we are on the root page, if so, show confirmation
      if (window.location.pathname === '/') {
        event.preventDefault(); // Prevent default back navigation
        setShowExitConfirm(true);
      }
    };

    // Push a state to history so we can catch the back event
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleExitConfirm = (exit: boolean) => {
    setShowExitConfirm(false);
    if (exit) {
      // Allow the user to exit. In some browsers, window.close() might work for PWAs.
      window.close(); 
    } else {
      // If user cancels, re-push the state to be able to catch it again
      window.history.pushState(null, '', window.location.href);
    }
  };

  const courierDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return doc(firestore, 'couriers', user.id);
  }, [firestore, user?.id]);
  const { data: courierData, isLoading: isCourierDataLoading } = useDoc<Courier>(courierDocRef);
  
  // Show admin note dialog if there's a new, unread message
  React.useEffect(() => {
    if (courierData && courierData.adminNote && !courierData.adminNote.isRead) {
      setShowAdminNote(true);
    }
  }, [courierData]);

  const handleAdminNoteRead = () => {
    if (!courierDocRef) return;
    updateDoc(courierDocRef, { 'adminNote.isRead': true })
      .then(() => setShowAdminNote(false))
      .catch(console.error);
  };


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
    if (!allShipmentsForCourier) return [];
    return allShipmentsForCourier.filter(s => 
        !s.isArchivedForCourier && 
        !s.isWarehouseReturn &&
        !s.isReturnedToCompany
    );
  }, [allShipmentsForCourier]);
  
  const activeShipmentsForStats = React.useMemo(() => allShipmentsForCourier?.filter(s => !s.isArchivedForCourier) || [], [allShipmentsForCourier]);


  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courier_payments'), where("courierId", "==", user.id));
  }, [firestore, user]);
  const { data: payments, isLoading: paymentsLoading } = useCollection<CourierPayment>(paymentsQuery);
  
  const activePaymentsForStats = React.useMemo(() => payments?.filter(p => !p.isArchived) || [], [payments]);


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
    if (shipment?.isExchange) {
        setExchangeAlertShipment(shipment);
    } else {
        setEditingShipment(shipment);
        setShipmentSheetOpen(true);
    }
  };

  const handleProceedToEdit = () => {
    if (exchangeAlertShipment) {
        setEditingShipment(exchangeAlertShipment);
        setShipmentSheetOpen(true);
        setExchangeAlertShipment(null);
    }
  };
  
const handleSaveShipment = async (shipmentData: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!id || !app || !shipmentData.status || !editingShipment || !statuses) return;

    toast({ title: "جاري تحديث الحالة..." });

    try {
        const functions = getFunctions(app);
        const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

        const calculatedFields = calculateCommissionAndPaidAmount(
            shipmentData.status,
            editingShipment.totalAmount,
            shipmentData.collectedAmount || 0,
            user.commissionRate || 0,
            statuses
        );
        
        const payload: any = {
            shipmentId: id,
            status: shipmentData.status,
            reason: shipmentData.reason,
            retryAttempt: false, // Reset retry flag on any update
            ...calculatedFields,
        };

        if (shipmentData.status === 'PriceChangeRequested') {
            payload.requestedAmount = shipmentData.requestedAmount;
            payload.amountChangeReason = shipmentData.amountChangeReason;
        }
      
      await handleShipmentUpdateFn(payload);
  
      toast({ title: "تم تحديث الشحنة بنجاح" });
      handleSheetOpenChange(false);
      
      if (shipmentData.status === 'PriceChangeRequested') {
            const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/?edit=${id}` : `/?edit=${id}`;
            sendPushNotification({
                recipientId: 'admin', // Send to all admins
                title: 'طلب تعديل سعر',
                body: `المندوب ${user.name} يطلب تعديل سعر الشحنة ${editingShipment.recipientName}`,
                url: notificationUrl,
            }).catch(console.error);
        }

    } catch (error: any) {
      console.error("Error updating shipment:", error);
      toast({
        title: "فشل تحديث الشحنة",
        description: error.message || "حدث خطأ أثناء الاتصال بالخادم.",
        variant: "destructive",
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
        const calculatedFields = calculateCommissionAndPaidAmount(
            update.status!,
            row.totalAmount,
            0, // Bulk updates for courier don't involve collection
            user.commissionRate || 0,
            statuses
        );

        const payload: any = {
            shipmentId: row.id,
            status: update.status!,
            reason: update.reason || 'تحديث جماعي',
            ...calculatedFields
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

  
  const { activeShipments, postponedShipments, returnedShipments, finishedShipments, retryShipments } = React.useMemo(() => {
    if (!shipments || !statuses) return { activeShipments: [], postponedShipments: [], returnedShipments: [], finishedShipments: [], retryShipments: [] };

    const deliveredStatusIds = statuses.filter(s => s.isDeliveredStatus).map(s => s.id);
    const returnedStatusIds = statuses.filter(s => s.isReturnedStatus).map(s => s.id);
    
    const isFinalStatus = (status: string) => deliveredStatusIds.includes(status) || returnedStatusIds.includes(status);

    const retry = shipments.filter(s => s.retryAttempt === true);
    const finished = shipments.filter(s => deliveredStatusIds.includes(s.status));
    
    const returned = shipments.filter(s => 
        (returnedStatusIds.includes(s.status) || s.isExchange || s.isCustomReturn) &&
        !s.retryAttempt
    );
    
    const postponed = shipments.filter(s => s.status === 'Postponed' && !s.retryAttempt);
    
    let active = shipments.filter(s => {
        // A shipment is active if it's NOT in a final state, not postponed, and not a retry.
        // Special cases (exchange/custom return) are active if they are not in a final state.
        if (s.isExchange || s.isCustomReturn) {
            return !isFinalStatus(s.status);
        }
        
        return !isFinalStatus(s.status) && s.status !== 'Postponed' && !s.retryAttempt;
    });
    
    // Sort active shipments to show urgent, exchange, and custom returns first
    active.sort((a, b) => {
        const aPriority = (a.isUrgent ? 4 : 0) + (a.isExchange ? 2 : 0) + (a.isCustomReturn ? 1 : 0);
        const bPriority = (b.isUrgent ? 4 : 0) + (b.isExchange ? 2 : 0) + (b.isCustomReturn ? 1 : 0);
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }
        // If priority is the same, sort by creation date (newest first)
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
    });
    
    return { activeShipments: active, postponedShipments: postponed, returnedShipments: returned, finishedShipments: finished, retryShipments: retry };
  }, [shipments, statuses]);

  // Effect to show the retry popup
  React.useEffect(() => {
      if (retryShipments.length > 0) {
          setShowRetryPopup(true);
      }
  }, [retryShipments.length]);

  const filterShipments = (list: Shipment[]) => {
      if (!searchTerm) return list;
      const lowercasedTerm = searchTerm.toLowerCase();
      return list.filter(shipment => 
          shipment.shipmentCode?.toLowerCase().includes(lowercasedTerm) ||
          shipment.orderNumber?.toLowerCase().includes(lowercasedTerm) ||
          shipment.recipientName?.toLowerCase().includes(lowercasedTerm) ||
          shipment.address?.toLowerCase().includes(lowercasedTerm)
      );
  }

  const filteredActiveShipments = filterShipments(activeShipments);
  const filteredPostponedShipments = filterShipments(postponedShipments);
  const filteredReturnedShipments = filterShipments(returnedShipments);
  const filteredFinishedShipments = filterShipments(finishedShipments);
  const filteredRetryShipments = filterShipments(retryShipments);


  const renderShipmentList = (shipmentList: Shipment[]) => {
    if (shipmentsLoading || statusesLoading) {
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
      isLoading={shipmentsLoading || companiesLoading || statusesLoading}
      governorates={governorates || []}
      companies={companies || []}
      couriers={[]}
      statuses={statuses || []}
      onEdit={openShipmentForm}
      onBulkUpdate={handleBulkUpdateShipments}
      role={role}
    />
  );
  
  const handleScanSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
    try {
      const url = new URL(decodedText);
      const editId = url.searchParams.get('edit');
      
      const targetShipment = allShipmentsForCourier?.find(s => s.id === editId);

      if (targetShipment && targetShipment.shipmentCode) {
        toast({ title: "تم العثور على الشحنة!", description: `جاري عرض تفاصيل الشحنة ${targetShipment.shipmentCode}` });
        onSearchChange(targetShipment.shipmentCode);
        setIsScannerOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'شحنة غير صالحة', description: 'لم يتم العثور على هذه الشحنة في قائمتك.' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ في قراءة الباركود', description: 'لا يمكن تحليل البيانات الموجودة في الباركود.' });
    }
  };


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
              <Tabs defaultValue={activeTab} onValueChange={setActiveTab} value={activeTab}>
                <div className="flex items-center">
                  <TabsList className="flex-nowrap overflow-x-auto justify-start">
                    <TabsTrigger value="retry" className="flex items-center gap-2 text-yellow-600 data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-600">
                        <RefreshCw className="h-4 w-4" />
                        إعادة محاولة
                        {filteredRetryShipments.length > 0 && <Badge variant="destructive" className="h-5 w-5 justify-center p-0 ms-2">{filteredRetryShipments.length}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="active" className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        النشطة 
                        <Badge variant="secondary">{filteredActiveShipments.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="postponed" className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        المؤجلة 
                        <Badge variant="secondary">{filteredPostponedShipments.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="returned" className="flex items-center gap-2">
                        <Archive className="h-4 w-4" />
                        المرتجعات
                        <Badge variant="secondary">{filteredReturnedShipments.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="finished" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        المنتهية 
                        <Badge variant="secondary">{filteredFinishedShipments.length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                  <Button variant="outline" size="sm" className="ms-auto h-9 gap-1" onClick={() => setIsScannerOpen(true)}>
                    <QrCode className="h-4 w-4" />
                    <span>مسح باركود</span>
                  </Button>
                </div>
                <TabsContent value="retry" className="mt-4">
                  {isMobile ? renderShipmentList(filteredRetryShipments) : renderDesktopTable(filteredRetryShipments)}
                </TabsContent>
                <TabsContent value="active" className="mt-4">
                  {isMobile ? renderShipmentList(filteredActiveShipments) : renderDesktopTable(filteredActiveShipments)}
                </TabsContent>
                <TabsContent value="postponed" className="mt-4">
                  {isMobile ? renderShipmentList(filteredPostponedShipments) : renderDesktopTable(filteredPostponedShipments)}
                </TabsContent>
                <TabsContent value="returned" className="mt-4">
                  {isMobile ? renderShipmentList(filteredReturnedShipments) : renderDesktopTable(filteredReturnedShipments)}
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
                    <StatsCards shipments={activeShipmentsForStats || []} payments={payments || []} role={role} />
                )}
            </div>
         </TabsContent>
       </Tabs>
       
       <AlertDialog open={showAdminNote} onOpenChange={setShowAdminNote}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>رسالة من الإدارة</AlertDialogTitle>
                  <AlertDialogDescription className="text-lg text-foreground whitespace-pre-wrap py-4">
                    {courierData?.adminNote?.message}
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogAction onClick={handleAdminNoteRead}>تم الاطلاع</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الخروج</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد أنك تريد الخروج من التطبيق؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleExitConfirm(false)}>البقاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExitConfirm(true)}>الخروج</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRetryPopup} onOpenChange={setShowRetryPopup}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تنبيه: شحنات لإعادة المحاولة</AlertDialogTitle>
            <AlertDialogDescription>
              لديك {retryShipments.length} شحنة تتطلب إعادة محاولة تسليم. هل تود عرضها الآن؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>لاحقاً</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setActiveTab("retry");
              setShowRetryPopup(false);
            }}>
              عرض الشحنات
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!exchangeAlertShipment} onOpenChange={() => setExchangeAlertShipment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ تنبيه: شحنة استبدال</AlertDialogTitle>
            <AlertDialogDescription>
              هذه الشحنة هي عملية استبدال (طرد مقابل طرد). يجب عليك استلام طرد من العميل أولاً قبل تسليم الطرد الجديد إليه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleProceedToEdit}>موافق، فهمت</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <QRScannerDialog 
        open={isScannerOpen} 
        onOpenChange={setIsScannerOpen} 
        onScanSuccess={handleScanSuccess} 
      />


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

