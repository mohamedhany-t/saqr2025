
"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, User, Chat, ShipmentHistory, ShipmentStatusConfig } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, doc, getDoc, writeBatch, serverTimestamp, getDocs } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ShipmentCard } from "@/components/shipments/shipment-card";
import { AlertTriangle, CheckSquare, DollarSign, MessageSquare, Check, X, ScanLine, FileUp, PlusCircle, Printer, GitCompareArrows, Loader2, User as UserIcon, Building, Warehouse, RefreshCcw, BellRing, ListChecks } from "lucide-react";
import ChatInterface from "../chat/chat-interface";
import { Badge } from "../ui/badge";
import { differenceInDays, differenceInHours } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { sendPushNotification } from "@/lib/actions";
import Link from "next/link";
import { ShipmentFilters } from "./shipment-filters";
import type { ColumnFiltersState } from "@tanstack/react-table";
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
import { ImportResult, ImportProgressDialog } from "@/components/shipments/import-progress-dialog";
import { read, utils } from "xlsx";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFirebaseApp } from "@/firebase";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') {
      return date.toDate();
    }
    if (date instanceof Date) {
      return date;
    }
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
    return null;
  };

const ProblemShipmentList = ({ title, icon, shipments, onEdit, children }: { title: string, icon: React.ReactNode, shipments: Shipment[], onEdit: (s: Shipment) => void, children?: (shipment: Shipment) => React.ReactNode }) => {
    if (shipments.length === 0) {
        return null;
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {icon}
                    {title} ({shipments.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {shipments.map(s => (
                        <div key={s.id} className="border p-3 rounded-lg flex justify-between items-center bg-muted/30">
                            {children ? children(s) : <p>تفاصيل الشحنة {s.recipientName}</p>}
                            <Button variant="secondary" size="sm" onClick={() => onEdit(s)}>مراجعة</Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

const PrintCenterPage = ({
    shipments,
    isLoading,
    governorates,
    companies,
    courierUsers,
    statuses,
    onEdit,
    role,
    onGenericBulkUpdate,
  }: {
    shipments: Shipment[];
    isLoading: boolean;
    governorates: Governorate[];
    companies: Company[];
    courierUsers: User[];
    statuses: ShipmentStatusConfig[];
    onEdit: (shipment: Shipment) => void;
    role: Role | null;
    onGenericBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
  }) => {
    const unprintedShipments = React.useMemo(() => shipments.filter(s => !s.isLabelPrinted), [shipments]);
    const printedShipments = React.useMemo(() => shipments.filter(s => s.isLabelPrinted), [shipments]);
    const { toast } = useToast();
  
    const handlePrintAndUpdate = async (selectedRows: Shipment[]) => {
      if (selectedRows.length === 0) {
        toast({ title: 'لم يتم تحديد أي شحنات', variant: 'destructive' });
        return;
      }
      await onGenericBulkUpdate(selectedRows, { isLabelPrinted: true });
  
      const ids = selectedRows.map(row => row.id);
      const printUrl = `/print/bulk?ids=${ids.join(',')}`;
      window.open(printUrl, '_blank', 'width=800,height=600');
    };
  
    return (
      <Tabs defaultValue="unprinted">
        <TabsList>
          <TabsTrigger value="unprinted">جاهزة للطباعة ({unprintedShipments.length})</TabsTrigger>
          <TabsTrigger value="printed">تمت طباعتها ({printedShipments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="unprinted">
          <ShipmentsTable
            shipments={unprintedShipments}
            isLoading={isLoading}
            governorates={governorates}
            companies={companies}
            couriers={courierUsers}
            statuses={statuses}
            onEdit={onEdit}
            role={role}
            onBulkUpdate={onGenericBulkUpdate}
            onBulkPrint={handlePrintAndUpdate}
          />
        </TabsContent>
        <TabsContent value="printed">
          <ShipmentsTable
            shipments={printedShipments}
            isLoading={isLoading}
            governorates={governorates}
            companies={companies}
            couriers={courierUsers}
            statuses={statuses}
            onEdit={onEdit}
            role={role}
            onBulkUpdate={onGenericBulkUpdate}
            onBulkPrint={handlePrintAndUpdate}
          />
        </TabsContent>
      </Tabs>
    );
  };

interface CustomerServiceDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}

export default function CustomerServiceDashboard({ user, role, searchTerm }: CustomerServiceDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const { toast } = useToast();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const { user: authUser } = useUser();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [processingShipments, setProcessingShipments] = React.useState<Set<string>>(new Set());
  const [mobileRowSelection, setMobileRowSelection] = React.useState<Record<string, boolean>>({});


  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (window.location.pathname === '/') {
        event.preventDefault();
        setShowExitConfirm(true);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleExitConfirm = (exit: boolean) => {
    setShowExitConfirm(false);
    if (exit) {
      window.close();
    } else {
      window.history.pushState(null, '', window.location.href);
    }
  };

  const allShipmentsForStatsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'shipments'));
  }, [firestore]);
  const { data: allShipmentsForStats, isLoading: allShipmentsLoading } = useCollection<Shipment>(allShipmentsForStatsQuery);
  
  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'shipments')); 
  }, [firestore, user]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'governorates'));
  }, [firestore, user]);
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'companies'));
  }, [firestore, user]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const couriersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'), where("role", "==", "courier"));
  }, [firestore, user]);
  const { data: courierUsers, isLoading: couriersLoading } = useCollection<User>(couriersQuery);

  const statusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'shipment_statuses'));
  }, [firestore]);
  const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);
  
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

  React.useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
          setEditingShipment({ id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment);
          setShipmentSheetOpen(true);
        }
      };
      fetchShipment();
    }
  }, [searchParams, firestore, router, pathname]);

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

  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Keep existing handleFileChange implementation
  };

  const handleSaveShipment = async (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !authUser || !app) return;
    try {
        const functions = getFunctions(app);
        const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');
        const payload: any = { shipmentId: id, ...data };
        if (!id) payload.shipmentId = doc(collection(firestore, "shipments")).id;
        await handleShipmentUpdateFn(payload);
        toast({ title: id ? "تم تحديث الشحنة" : "تم حفظ الشحنة", description: "تمت العملية بنجاح" });
        handleSheetOpenChange(false);
        if (data.assignedCourierId && (!editingShipment || data.assignedCourierId !== editingShipment.assignedCourierId)) {
            sendPushNotification({ recipientId: data.assignedCourierId, title: 'شحنة جديدة', body: `تم تعيين شحنة جديدة لك: ${data.recipientName}`, url: `${window.location.origin}/?edit=${payload.shipmentId}` }).catch(console.error);
        }
    } catch (error: any) {
        toast({ title: "فشل التحديث", description: error.message, variant: "destructive" });
    }
};

 const handleGenericBulkUpdate = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !authUser || !app) return;
    if (selectedRows.length === 0) return;
    const functions = getFunctions(app);
    const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');
    toast({ title: `جاري تحديث ${selectedRows.length} شحنة...` });
    const updatePromises = selectedRows.map(row => handleShipmentUpdateFn({ shipmentId: row.id, ...update }).catch(error => ({ error, shipmentId: row.id })));
    const results = await Promise.all(updatePromises);
    const failedUpdates = results.filter(res => res && 'error' in res);
    if (failedUpdates.length > 0) toast({ title: `فشل تحديث ${failedUpdates.length} شحنة`, variant: "destructive" });
    else toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
    if (update.assignedCourierId && selectedRows.length > 0) {
      sendPushNotification({ recipientId: update.assignedCourierId, title: 'شحنات جديدة', body: `تم تعيين ${selectedRows.length} شحنة جديدة لك.`, url: '/' }).catch(console.error);
    }
  };

    const handlePriceChangeDecision = async (shipment: Shipment, approved: boolean) => {
        if (!firestore || !authUser || processingShipments.has(shipment.id)) return;
        setProcessingShipments(prev => new Set(prev).add(shipment.id));
        let updatePayload: any = approved ? { totalAmount: shipment.requestedAmount, status: 'In-Transit', isPriceChangeDecision: true } : { status: 'PriceChangeRejected', isPriceChangeDecision: true };
        try {
            await handleSaveShipment(updatePayload, shipment.id);
        } finally {
            setProcessingShipments(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }
    };
  
  const filteredShipments = React.useMemo(() => {
    if (!shipments) return [];
    let baseShipments = shipments;
    if (columnFilters.length > 0) {
        baseShipments = baseShipments.filter(shipment => columnFilters.every(filter => {
            const value = (shipment as any)[filter.id];
            const filterValue = filter.value as string[];
            if (Array.isArray(filterValue) && filterValue.length > 0) return filterValue.includes(value);
            return true;
        }));
    }
    if (!searchTerm) return baseShipments;
    const term = searchTerm.toLowerCase();
    return baseShipments.filter(s => [s.shipmentCode, s.orderNumber, s.recipientName, s.recipientPhone, s.address].some(v => String(v || '').toLowerCase().includes(term)));
  }, [shipments, searchTerm, columnFilters]);

  const returnedShipmentsNeedingAction = React.useMemo(() => allShipmentsForStats?.filter(s => s.status === 'Returned' && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [allShipmentsForStats]);
  const longPostponedShipments = React.useMemo(() => allShipmentsForStats?.filter(s => {
          const updatedAt = getSafeDate(s.updatedAt);
          return s.status === 'Postponed' && updatedAt && differenceInDays(new Date(), updatedAt) > 3 && !s.isArchivedForCompany && !s.isArchivedForCourier;
      }) || [], [allShipmentsForStats]);
  const staleInTransitShipments = React.useMemo(() => allShipmentsForStats?.filter(s => {
          const updatedAt = getSafeDate(s.updatedAt);
          return s.status === 'In-Transit' && updatedAt && differenceInHours(new Date(), updatedAt) > 24 && !s.isArchivedForCompany && !s.isArchivedForCourier;
      }) || [], [allShipmentsForStats]);
  const priceChangeRequests = React.useMemo(() => allShipmentsForStats?.filter(s => s.status === 'PriceChangeRequested' && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [allShipmentsForStats]);
  const returnsWithCouriers = React.useMemo(() => shipments?.filter(s => (statuses?.filter(st => st.isReturnedStatus).map(st => st.id).includes(s.status) || s.isExchange) && !s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany) || [], [shipments, statuses]);
  const problemCount = returnedShipmentsNeedingAction.length + longPostponedShipments.length + staleInTransitShipments.length + priceChangeRequests.length;
  const listIsLoading = shipmentsLoading || governoratesLoading || companiesLoading || couriersLoading || statusesLoading;
  const selectedCount = Object.values(mobileRowSelection).filter(Boolean).length;

  const handleMobileBulkUpdate = (update: Partial<Shipment>) => {
        const selectedIds = Object.keys(mobileRowSelection).filter(id => mobileRowSelection[id]);
        const selectedShipments = shipments?.filter(s => selectedIds.includes(s.id)) || [];
        handleGenericBulkUpdate(selectedShipments, update);
        setMobileRowSelection({});
  };

  const handleMobileBulkPrint = () => {
        const selectedIds = Object.keys(mobileRowSelection).filter(id => mobileRowSelection[id]);
        const selectedShipments = shipments?.filter(s => selectedIds.includes(s.id)) || [];
        if (selectedShipments.length === 0) return;
        const ids = selectedShipments.map(row => row.id);
        const printUrl = `/print/bulk?ids=${ids.join(',')}`;
        window.open(printUrl, '_blank', 'width=800,height=600');
        setMobileRowSelection({});
  };

  const renderShipmentList = (shipmentList: Shipment[], isLoading: boolean) => {
    if (isLoading) return <div className="space-y-3 mt-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="p-4 bg-card rounded-lg border h-24 animate-pulse" />)}</div>;
    if (shipmentList.length === 0) return <div className="text-center py-10 text-muted-foreground">لا توجد شحنات.</div>;
    return <div className="space-y-3 mt-4">{shipmentList.map(shipment => <ShipmentCard key={shipment.id} shipment={shipment} statusConfig={statuses?.find(sc => sc.id === shipment.status)} governorateName={governorates?.find(g => g.id === shipment.governorateId)?.name || ''} companyName={companies?.find(c => c.id === shipment.companyId)?.name || ''} onEdit={openShipmentForm} isSelected={!!mobileRowSelection[shipment.id]} onSelectToggle={(id) => setMobileRowSelection(prev => ({...prev, [id]: !prev[id]}))} />)}</div>;
  };

  const renderDesktopTable = (shipmentList: Shipment[], isLoading: boolean) => <ShipmentsTable shipments={shipmentList} isLoading={isLoading} governorates={governorates || []} companies={companies || []} couriers={courierUsers || []} statuses={statuses || []} onEdit={openShipmentForm} onBulkUpdate={handleGenericBulkUpdate} role={role} />;
  const getShipmentsByStatus = (status: string | string[]) => {
    const statusesList = Array.isArray(status) ? status : [status];
    return filteredShipments.filter(s => statusesList.includes(s.status));
  };

  return (
    <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4">
      <Tabs defaultValue="shipments">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <TabsList className="flex-nowrap overflow-x-auto justify-start bg-muted/50 p-1 rounded-lg">
                <TabsTrigger value="shipments">الشحنات</TabsTrigger>
                <TabsTrigger value="returns-with-couriers">مرتجعات لدى المندوب</TabsTrigger>
                <TabsTrigger value="print-center"><Printer className="w-4 h-4 me-2"/>مركز الطباعة</TabsTrigger>
                <TabsTrigger value="problem-inbox" className="relative">المشاكل {problemCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{problemCount}</Badge>}</TabsTrigger>
                <TabsTrigger value="chat" className="relative"><MessageSquare className="me-2 h-4 w-4" /><span>الدردشة</span>{totalUnreadCount > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{totalUnreadCount}</Badge>}</TabsTrigger>
            </TabsList>
             <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                 <Button asChild variant="outline" size="sm" className="h-10 shadow-sm"><Link href="/scan"><ScanLine className="h-4 w-4 me-2" /><span>مسح باركود</span></Link></Button>
                <Button variant="outline" size="sm" onClick={handleImportClick} className="h-10 shadow-sm"><FileUp className="h-4 w-4 me-2" /><span>استيراد</span></Button>
                <Button size="sm" onClick={() => openShipmentForm()} className="h-10 shadow-md bg-primary hover:bg-primary/90"><PlusCircle className="h-4 w-4 me-2" /><span>شحنة جديدة</span></Button>
            </div>
        </div>
        <StatsCards shipments={allShipmentsForStats || []} role={role} />
        <TabsContent value="shipments">
          <Tabs defaultValue="all-shipments">
            <div className="flex items-center gap-4 flex-wrap mt-4"><ShipmentFilters governorates={governorates || []} companies={companies || []} courierUsers={courierUsers || []} statuses={statuses || []} onFiltersChange={setColumnFilters} /></div>
            <TabsList className="flex-nowrap overflow-x-auto justify-start mt-4 bg-muted/30 p-1">
              <TabsTrigger value="all-shipments">الكل</TabsTrigger>
              <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
              <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
              <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
              <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
              <TabsTrigger value="returned">مرتجعات</TabsTrigger>
            </TabsList>
            <TabsContent value="all-shipments" className="mt-4">{isMobile ? renderShipmentList(filteredShipments, listIsLoading) : renderDesktopTable(filteredShipments, listIsLoading)}</TabsContent>
            <TabsContent value="pending" className="mt-4">{isMobile ? renderShipmentList(getShipmentsByStatus('Pending'), listIsLoading) : renderDesktopTable(getShipmentsByStatus('Pending'), listIsLoading)}</TabsContent>
            <TabsContent value="in-transit" className="mt-4">{isMobile ? renderShipmentList(getShipmentsByStatus('In-Transit'), listIsLoading) : renderDesktopTable(getShipmentsByStatus('In-Transit'), listIsLoading)}</TabsContent>
            <TabsContent value="delivered" className="mt-4">{isMobile ? renderShipmentList(getShipmentsByStatus(['Delivered']), listIsLoading) : renderDesktopTable(getShipmentsByStatus(['Delivered']), listIsLoading)}</TabsContent>
            <TabsContent value="postponed" className="mt-4">{isMobile ? renderShipmentList(getShipmentsByStatus('Postponed'), listIsLoading) : renderDesktopTable(getShipmentsByStatus('Postponed'), listIsLoading)}</TabsContent>
            <TabsContent value="returned" className="mt-4">{isMobile ? renderShipmentList(getShipmentsByStatus(['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)']), listIsLoading) : renderDesktopTable(getShipmentsByStatus(['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)']), listIsLoading)}</TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="returns-with-couriers"><ShipmentsTable shipments={returnsWithCouriers} isLoading={listIsLoading} governorates={governorates || []} companies={companies || []} couriers={courierUsers || []} statuses={statuses || []} onEdit={openShipmentForm} role={role} onBulkUpdate={handleGenericBulkUpdate} activeTab="returns-with-couriers" /></TabsContent>
        <TabsContent value="print-center"><PrintCenterPage shipments={shipments || []} isLoading={shipmentsLoading} governorates={governorates || []} companies={companies || []} courierUsers={courierUsers || []} statuses={statuses || []} onEdit={openShipmentForm} role={role} onGenericBulkUpdate={handleGenericBulkUpdate} /></TabsContent>
        <TabsContent value="problem-inbox">
            <div className="mt-4 space-y-6">
                <ProblemShipmentList title="طلبات تعديل أسعار" icon={<DollarSign className="h-5 w-5 text-yellow-500" />} shipments={priceChangeRequests} onEdit={openShipmentForm}>
                    {(s: Shipment) => <div className="text-sm"><p className="font-bold">{s.recipientName}</p><p>المطلوب: {s.requestedAmount?.toLocaleString('ar-EG')}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="outline" className="text-green-600 h-7" onClick={() => handlePriceChangeDecision(s, true)}>موافقة</Button><Button size="sm" variant="outline" className="text-red-600 h-7" onClick={() => handlePriceChangeDecision(s, false)}>رفض</Button></div></div>}
                </ProblemShipmentList>
                {problemCount === 0 && <div className="flex flex-col items-center justify-center text-center py-16 bg-muted/40 rounded-lg"><CheckSquare className="h-16 w-16 text-green-500 mb-4" /><h3 className="text-2xl font-bold">لا توجد مشاكل حاليًا</h3></div>}
          </div>
        </TabsContent>
        <TabsContent value="chat"><ChatInterface /></TabsContent>
      </Tabs>

      {isMobile && selectedCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-background/98 backdrop-blur-md border-t p-3 pb-6 shadow-[0_-10px_20px_rgba(0,0,0,0.1)] flex flex-col gap-3 z-50 animate-in slide-in-from-bottom duration-300 max-h-[40vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b pb-2 sticky top-0 bg-background/95 z-10">
                    <span className="text-sm font-bold text-primary">شحنات محددة: {selectedCount}</span>
                    <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 px-2 text-[11px] border-primary/20"><CheckSquare className="me-1 h-3.5 w-3.5 text-primary" /><span>الحالة</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-[300px] overflow-y-auto">{statuses?.filter(s => s.enabled).map((status) => (<DropdownMenuItem key={status.id} onSelect={() => handleMobileBulkUpdate({ status: status.id })}>{status.label}</DropdownMenuItem>))}</DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" className="h-8 px-2 text-[11px] text-orange-600 border-orange-100" onClick={() => handleMobileBulkUpdate({ status: 'Pending', assignedCourierId: '', reason: 'إعادة تعيين الشحنة', isWarehouseReturn: false, isReturningToCompany: false, isReturnedToCompany: false, isArchivedForCompany: false, isArchivedForCourier: false, retryAttempt: false })}><RefreshCcw className="me-1 h-3.5 w-3.5" /><span>إعادة</span></Button>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <Button variant="outline" size="sm" className="h-9 px-1 gap-1 text-blue-600 border-blue-100" onClick={() => handleMobileBulkUpdate({ retryAttempt: true })}><BellRing className="h-3.5 w-3.5" /><span className="text-[10px] truncate">محاولة</span></Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 px-1 gap-1"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">مندوب</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-[300px] overflow-y-auto">{courierUsers?.map((courier) => (<DropdownMenuItem key={courier.id} onSelect={() => handleMobileBulkUpdate({ assignedCourierId: courier.id })}>{courier.name}</DropdownMenuItem>))}</DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" className="h-9 px-1 gap-1" onClick={() => handleMobileBulkUpdate({ isWarehouseReturn: true })}><Warehouse className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">للمخزن</span></Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 px-1 gap-1"><Building className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">شركة</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-[300px] overflow-y-auto">{companies?.map((company) => (<DropdownMenuItem key={company.id} onSelect={() => handleMobileBulkUpdate({ companyId: company.id })}>{company.name}</DropdownMenuItem>))}</DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" className="h-9 px-1 gap-1" onClick={handleMobileBulkPrint}><Printer className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">طباعة</span></Button>
                    <Button variant="outline" size="sm" className="h-9 px-1 gap-1" onClick={() => handleMobileBulkUpdate({ isReturningToCompany: true })}><RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">للشركة</span></Button>
                </div>
                <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 h-9 px-1 gap-1" onClick={() => handleMobileBulkUpdate({ isReturnedToCompany: true })}><Building className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">وصلت للشركة</span></Button>
                     <Button variant="outline" size="sm" className="h-9 px-2 gap-2 font-medium" onClick={() => {if (selectedCount === shipments?.length) setMobileRowSelection({}); else {const newSelection: Record<string, boolean> = {}; shipments?.forEach(s => newSelection[s.id] = true); setMobileRowSelection(newSelection);}}}><ListChecks className="h-4 w-4" /><span>الكل</span></Button>
                </div>
          </div>
      )}
      
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>تأكيد الخروج</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد أنك تريد الخروج من التطبيق؟</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => handleExitConfirm(false)}>البقاء</AlertDialogCancel><AlertDialogAction onClick={() => handleExitConfirm(true)}>الخروج</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <ShipmentFormSheet open={isShipmentSheetOpen} onOpenChange={handleSheetOpenChange} onSave={handleSaveShipment} shipment={editingShipment} governorates={governorates || []} couriers={courierUsers || []} companies={companies || []} statuses={statuses || []} role={role}><div /></ShipmentFormSheet>
      {importResult && <ImportProgressDialog result={importResult} onClose={() => setImportResult(null)} />}
    </div>
  );
}
