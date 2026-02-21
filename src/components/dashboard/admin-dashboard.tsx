
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  PlusCircle, FileUp, Database, User as UserIcon, Building, BadgePercent, DollarSign, 
  Truck as CourierIcon, CalendarClock, MessageSquare, HandCoins, History, Pencil, 
  Trash2, WalletCards, Archive, Banknote, Package, FileText, Loader2, Printer, 
  ChevronDown, Bot, CheckSquare, ListChecks, AlertTriangle, ArchiveRestore, 
  Warehouse, RefreshCw, FileSpreadsheet, Settings, Search, Check, X, ScanLine, 
  Replace, BellRing, ChevronLeft, ChevronRight, BarChart, MessageSquarePlus, 
  Wallet, Plus, Copy, Link as LinkIcon, Sparkles, Merge, GitCompareArrows, 
  RefreshCcw, Filter, LayoutDashboard, Clock, ReceiptText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, User, CourierPayment, Chat, CompanyPayment, ShipmentHistory, ShipmentStatusConfig } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable, UserCard } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { UserFormSheet } from "@/components/users/user-form-sheet";
import { CourierPaymentFormSheet } from "@/components/users/courier-payment-form-sheet";
import { CompanyPaymentFormSheet } from "@/components/users/company-payment-form-sheet";
import { CompanySettlementDialog } from "@/components/users/company-settlement-dialog";
import { ImportResult, ImportProgressDialog } from "@/components/shipments/import-progress-dialog";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useFirebaseApp } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, updateDoc, getDoc, setDoc, deleteDoc, increment, orderBy, limit, startAfter, endBefore, limitToLast, DocumentSnapshot, DocumentData, Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
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
import AccountStatementsPage from "@/app/accounts/page";
import { createAuthUser, deleteAuthUser, updateAuthUserPassword, sendPushNotification, settleCompanyAccount } from "@/lib/actions";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ShipmentCard } from "../shipments/shipment-card";
import { ColumnFiltersState } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { getColumns as getShipmentColumns, statusVariants } from './shipments-table';
import { differenceInDays, differenceInHours, subDays, startOfDay } from "date-fns";
import { ReportsPage } from "@/components/reports/reports-page";
import { AuditLogPage } from "../audit-log/audit-log-page";
import Link from "next/link";
import { exportToExcel } from "@/lib/export";
import { ShipmentFilters } from './shipment-filters';
import { AdminNoteDialog } from "../users/admin-note-dialog";
import type { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatToCairoTime } from "@/lib/utils";

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    if (date instanceof Date) return date;
    const parsedDate = new Date(date);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const filterShipmentsBySearch = (list: Shipment[], term: string): Shipment[] => {
    if (!term) return list;
    const lowercasedTerm = term.toLowerCase();
    return list.filter(s => [s.shipmentCode, s.orderNumber, s.recipientName, s.recipientPhone, s.address].some(v => String(v || '').toLowerCase().includes(lowercasedTerm)));
}

const MobileShipmentsView = React.memo(({ shipments, listIsLoading, governorates, companies, courierUsers, statuses, onEdit, onDelete, onPrint, onBulkUpdate, onBulkDelete, onBulkPrint, columnFilters, setColumnFilters, role, searchTerm }: any) => {
    const [activeTab, setActiveTab] = React.useState("all-shipments");
    const [mobileRowSelection, setMobileRowSelection] = React.useState<Record<string, boolean>>({});
    const { toast } = useToast();
    const selectedCount = Object.values(mobileRowSelection).filter(Boolean).length;
    const returnedStatuses = React.useMemo(() => statuses?.filter((s: any) => s.isReturnedStatus).map((s: any) => s.id) || [], [statuses]);
    
    const recentlyUpdated = useMemo(() => [...shipments].sort((a, b) => (getSafeDate(b.updatedAt)?.getTime() || 0) - (getSafeDate(a.updatedAt)?.getTime() || 0)), [shipments]);
    const returnsWithCouriers = useMemo(() => shipments.filter((s: any) => (returnedStatuses.includes(s.status) || s.isExchange) && !s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany), [shipments, returnedStatuses]);
    const inWarehouse = useMemo(() => shipments.filter((s: any) => s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany), [shipments]);

    const currentList = filterShipmentsBySearch(activeTab === "recently-updated" ? recentlyUpdated : activeTab === "unassigned" ? shipments.filter((s: any) => !s.assignedCourierId) : activeTab === "assigned" ? shipments.filter((s: any) => !!s.assignedCourierId) : activeTab === "returns-with-couriers" ? returnsWithCouriers : activeTab === "returns-in-warehouse" ? inWarehouse : shipments, searchTerm);

    const handleMobileBulkUpdate = (update: any) => {
        const selectedIds = Object.keys(mobileRowSelection).filter(id => mobileRowSelection[id]);
        onBulkUpdate(shipments.filter((s: any) => selectedIds.includes(s.id)), update);
        setMobileRowSelection({});
    };

    const handleMobileBulkPrint = () => {
        const selectedIds = Object.keys(mobileRowSelection).filter(id => mobileRowSelection[id]);
        onBulkPrint(shipments.filter((s: any) => selectedIds.includes(s.id)));
        setMobileRowSelection({});
    };

    return (
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 mt-4">
                <TabsList className="grid grid-cols-4 h-auto bg-muted/50 p-1">
                    <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                    <TabsTrigger value="unassigned">غير معينة</TabsTrigger>
                    <TabsTrigger value="assigned">معينة</TabsTrigger>
                    <TabsTrigger value="recently-updated" className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />المُحدَّثة</TabsTrigger>
                    <TabsTrigger value="returns-with-couriers" className="text-[10px]">مرتجعات بالخارج</TabsTrigger>
                    <TabsTrigger value="returns-in-warehouse" className="text-[10px]">مرتجعات بالمخزن</TabsTrigger>
                </TabsList>
                <ShipmentFilters governorates={governorates} companies={companies} courierUsers={courierUsers} statuses={statuses} onFiltersChange={setColumnFilters} />
                {currentList.length > 0 && <Button variant="outline" size="sm" onClick={() => {if (Object.values(mobileRowSelection).filter(Boolean).length === currentList.length) setMobileRowSelection({}); else {const ns: any = {}; currentList.forEach((s: any) => ns[s.id] = true); setMobileRowSelection(ns);}}} className="h-9 gap-2 w-full font-medium shadow-sm"><ListChecks className="h-4 w-4" /><span>تحديد الكل ({currentList.length})</span></Button>}
            </div>
            <div className="mt-4 overflow-y-auto" style={{ height: `calc(100vh - 22rem)` }}>
                {listIsLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />)}</div> : currentList.map((s: any) => <ShipmentCard key={s.id} shipment={s} isSelected={!!mobileRowSelection[s.id]} onSelectToggle={(id: any) => setMobileRowSelection(p => ({...p, [id]: !p[id]}))} onEdit={() => onEdit(s)} statusConfig={statuses?.find((sc: any) => sc.id === s.status)} governorateName={governorates?.find((g: any) => g.id === s.governorateId)?.name} companyName={companies?.find((c: any) => c.id === s.companyId)?.name} />)}
            </div>
            {selectedCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-background/98 backdrop-blur-md border-t p-3 pb-6 shadow-[0_-10px_20px_rgba(0,0,0,0.1)] flex flex-col gap-3 z-50 animate-in slide-in-from-bottom duration-300 max-h-[40vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b pb-2 sticky top-0 bg-background/95 z-10"><span className="text-sm font-bold text-primary">شحنات محددة: {selectedCount}</span><div className="flex gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 px-2 text-[11px] border-primary/20"><CheckSquare className="me-1 h-3.5 w-3.5 text-primary" /><span>تغيير الحالة</span></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-[300px] overflow-y-auto">{statuses.filter((s: any) => s.enabled).map((st: any) => (<DropdownMenuItem key={st.id} onSelect={() => handleMobileBulkUpdate({ status: st.id })}>{st.label}</DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu><Button variant="outline" size="sm" className="h-8 px-2 text-[11px] text-orange-600 border-orange-100" onClick={() => handleMobileBulkUpdate({ status: 'Pending', assignedCourierId: '', reason: 'إعادة تعيين الشحنة', isWarehouseReturn: false, isReturningToCompany: false, isReturnedToCompany: false, retryAttempt: false })}><RefreshCcw className="me-1 h-3.5 w-3.5" /><span>إعادة تعيين</span></Button></div></div>
                    <div className="grid grid-cols-3 gap-1.5"><Button variant="outline" size="sm" className="h-9 px-1 gap-1 text-blue-600 border-blue-100" onClick={() => handleMobileBulkUpdate({ retryAttempt: true })}><BellRing className="h-3.5 w-3.5" /><span className="text-[10px] truncate">إعادة محاولة</span></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 px-1 gap-1"><CourierIcon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">تعيين مندوب</span></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-[300px] overflow-y-auto">{courierUsers.map((c: any) => (<DropdownMenuItem key={c.id} onSelect={() => handleMobileBulkUpdate({ assignedCourierId: c.id })}>{c.name}</DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu><Button variant="outline" size="sm" className="h-9 px-1 gap-1" onClick={() => handleMobileBulkUpdate({ isWarehouseReturn: true })}><Warehouse className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">للمخزن</span></Button></div>
                    <div className="grid grid-cols-3 gap-1.5"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 px-1 gap-1"><Building className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">تعيين شركة</span></Button></DropdownMenuTrigger><DropdownMenuContent className="max-h-[300px] overflow-y-auto">{companies.map((c: any) => (<DropdownMenuItem key={c.id} onSelect={() => handleMobileBulkUpdate({ companyId: c.id })}>{c.name}</DropdownMenuItem>))}</DropdownMenuContent></DropdownMenu><Button variant="outline" size="sm" className="h-9 px-1 gap-1" onClick={handleMobileBulkPrint}><Printer className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">طباعة</span></Button><Button variant="outline" size="sm" className="h-9 px-1 gap-1" onClick={() => handleMobileBulkUpdate({ isReturningToCompany: true })}><CourierIcon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">توصيل للشركة</span></Button></div>
                    <div className="flex gap-1.5"><Button variant="outline" size="sm" className="flex-1 h-9 px-1 gap-1" onClick={() => handleMobileBulkUpdate({ isReturnedToCompany: true })}><Building className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-[10px] truncate">وصلت للشركة</span></Button><Button variant="destructive" size="sm" className="w-12 h-9 flex items-center justify-center" onClick={() => onBulkDelete(shipments.filter((s: any) => mobileRowSelection[s.id]))}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
            )}
        </Tabs>
    );
});

const DesktopShipmentsView = React.memo(({ listIsLoading, role, filteredShipments, getShipmentsByStatus, inWarehouseShipments, returnsWithCouriers, returningToCompanyShipments, returnedToCompanyShipments, recentlyUpdatedShipments, unassignedShipments, assignedShipments, governorates, companies, courierUsers, statuses, openShipmentForm, handleGenericBulkUpdate, handleBulkDelete, handleBulkPrint, columnFilters, setColumnFilters }: any) => {
    const renderT = (list: any, tab: any = 'none') => (<ShipmentsTable shipments={list} isLoading={listIsLoading} governorates={governorates} companies={companies} couriers={courierUsers} statuses={statuses} onEdit={openShipmentForm} role={role} onBulkUpdate={handleGenericBulkUpdate} onBulkDelete={handleBulkDelete} onBulkPrint={handleBulkPrint} filters={columnFilters} onFiltersChange={setColumnFilters} activeTab={tab} />);
    return (
        <Tabs defaultValue="all-shipments" className="w-full">
            <div className="flex items-center justify-between mt-4 mb-2"><TabsList className="bg-muted/50 p-1"><TabsTrigger value="all-shipments">الكل</TabsTrigger><TabsTrigger value="unassigned">غير معينة</TabsTrigger><TabsTrigger value="assigned">معينة</TabsTrigger><TabsTrigger value="recently-updated" className="flex items-center gap-1"><Clock className="h-4 w-4" />المُحدَّثة</TabsTrigger><TabsTrigger value="returns">المرتجعات</TabsTrigger></TabsList></div>
            <TabsContent value="all-shipments">{renderT(filteredShipments)}</TabsContent>
            <TabsContent value="unassigned">{renderT(unassignedShipments)}</TabsContent>
            <TabsContent value="assigned">{renderT(assignedShipments)}</TabsContent>
            <TabsContent value="recently-updated">{renderT(recentlyUpdatedShipments)}</TabsContent>
            <TabsContent value="returns">
                <Tabs defaultValue="returns-with-couriers">
                    <TabsList className="bg-muted/30 p-1 mb-4"><TabsTrigger value="returns-with-couriers">لدى المناديب ({returnsWithCouriers.length})</TabsTrigger><TabsTrigger value="returns-in-warehouse">في المخزن ({inWarehouseShipments.length})</TabsTrigger><TabsTrigger value="returning-to-company">قيد التوصيل للشركة ({returningToCompanyShipments.length})</TabsTrigger><TabsTrigger value="returned-to-company">وصلت للشركة ({returnedToCompanyShipments.length})</TabsTrigger></TabsList>
                    <TabsContent value="returns-with-couriers">{renderT(returnsWithCouriers, 'returns-with-couriers')}</TabsContent>
                    <TabsContent value="returns-in-warehouse">{renderT(inWarehouseShipments, 'returns-in-warehouse')}</TabsContent>
                    <TabsContent value="returning-to-company">{renderT(returningToCompanyShipments, 'returning-to-company')}</TabsContent>
                    <TabsContent value="returned-to-company">{renderT(returnedToCompanyShipments, 'returned-to-company')}</TabsContent>
                </Tabs>
            </TabsContent>
        </Tabs>
    );
});

export default function AdminDashboard({ user, role, searchTerm, initialTab, initialChatId }: AdminDashboardProps) {
    const [isShipmentSheetOpen, setShipmentSheetOpen] = useState(false);
    const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);
    const [isCourierPaymentSheetOpen, setIsCourierPaymentSheetOpen] = useState(false);
    const [isCompanyPaymentSheetOpen, setIsCompanyPaymentSheetOpen] = useState(false);
    const [isAdminNoteDialogOpen, setIsAdminNoteDialogOpen] = useState(false);
    const [editingShipment, setEditingShipment] = useState<Shipment | undefined>(undefined);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const [editingCompany, setEditingCompany] = useState<Company | undefined>(undefined);
    const [payingCourier, setPayingCourier] = useState<User | undefined>(undefined);
    const [editingCourierPayment, setEditingCourierPayment] = useState<CourierPayment | undefined>(undefined);
    const [notingCourier, setNotingCourier] = useState<User | undefined>(undefined);
    const [payingCompany, setPayingCompany] = useState<Company | undefined>(undefined);
    const [editingCompanyPayment, setEditingCompanyPayment] = useState<CompanyPayment | undefined>(undefined);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
    const [isSavingShipment, setIsSavingShipment] = useState(false);
    const [courierPaymentToDelete, setCourierPaymentToDelete] = useState<CourierPayment | null>(null);
    const [companyPaymentToDelete, setCompanyPaymentToDelete] = useState<CompanyPayment | null>(null);
    const [courierToArchive, setCourierToArchive] = useState<User | null>(null);
    const [companyToArchive, setCompanyToArchive] = useState<Company | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const firestore = useFirestore();
    const app = useFirebaseApp();
    const isMobile = useIsMobile();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState(initialTab || "shipments");
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [managementSearchTerm, setManagementSearchTerm] = useState('');
    const [processingShipments, setProcessingShipments] = useState<Set<string>>(new Set());
    const { user: authUser } = useUser();

    const allShipmentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Optimization: Fetch shipments updated in the last 120 days to ensure active shipments are visible
        const daysAgo = subDays(new Date(), 120);
        return query(
            collection(firestore, 'shipments'), 
            where('updatedAt', '>=', Timestamp.fromDate(daysAgo)), 
            orderBy('updatedAt', 'desc')
        );
    }, [firestore]);
    const { data: allShipmentsForStats, isLoading: allShipmentsLoading } = useCollection<Shipment>(allShipmentsQuery);

    const governoratesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'governorates')) : null, [firestore]);
    const { data: governorates } = useCollection<Governorate>(governoratesQuery);
    const companiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    const { data: companies } = useCollection<Company>(companiesQuery);
    const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
    const { data: users } = useCollection<User>(usersQuery);
    const courierPaymentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'courier_payments'), orderBy('paymentDate', 'desc'), limit(200)) : null, [firestore]);
    const { data: courierPayments } = useCollection<CourierPayment>(courierPaymentsQuery);
    const companyPaymentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'company_payments'), orderBy('paymentDate', 'desc'), limit(200)) : null, [firestore]);
    const { data: companyPayments } = useCollection<CompanyPayment>(companyPaymentsQuery);
    const statusesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]);
    const { data: statuses } = useCollection<ShipmentStatusConfig>(statusesQuery);

    const courierUsers = useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);
    const activeShipments = useMemo(() => allShipmentsForStats?.filter(s => !(s.isArchivedForCompany && s.isArchivedForCourier)) || [], [allShipmentsForStats]);
    const filteredShipments = useMemo(() => filterShipmentsBySearch(activeShipments, searchTerm), [activeShipments, searchTerm]);

    const handleSaveShipment = async (data: any, id?: string) => {
        if (!firestore || !app || isSavingShipment) return;
        setIsSavingShipment(true);
        try {
            const handleShipmentUpdateFn = httpsCallable(getFunctions(app), "handleShipmentUpdate");
            const payload = { ...data, shipmentId: id || doc(collection(firestore, "shipments")).id };
            await handleShipmentUpdateFn(payload);
            toast({ title: "تم الحفظ بنجاح" });
            setShipmentSheetOpen(false);
        } catch (error: any) {
            toast({ title: "خطأ في الحفظ", description: error.message, variant: "destructive" });
        } finally { setIsSavingShipment(false); }
    };

    const handleGenericBulkUpdate = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
        if (!firestore || !app || selectedRows.length === 0) return;
        const handleShipmentUpdateFn = httpsCallable(getFunctions(app), 'handleShipmentUpdate');
        toast({ title: `جاري تحديث ${selectedRows.length} شحنة...` });
        const promises = selectedRows.map(row => handleShipmentUpdateFn({ shipmentId: row.id, ...update }).catch(e => ({ error: e, id: row.id })));
        await Promise.all(promises);
        toast({ title: "اكتمل التحديث" });
    };

    const courierDues = useMemo(() => {
        if (!courierUsers || !allShipmentsForStats || !courierPayments || !statuses) return [];
        return courierUsers.map(c => {
            const s = allShipmentsForStats.filter(x => x.assignedCourierId === c.id && !x.isArchivedForCourier);
            const p = courierPayments.filter(x => x.courierId === c.id && !x.isArchived);
            const collected = s.reduce((a, b) => a + (b.paidAmount || 0), 0);
            const comm = s.reduce((a, b) => a + (b.courierCommission || 0), 0);
            const paid = p.reduce((a, b) => a + b.amount, 0);
            return { ...c, netDue: (collected - comm) - paid, totalShipments: s.length, deliveredCount: s.filter(x => statuses.find(st => st.id === x.status)?.isDeliveredStatus).length };
        });
    }, [courierUsers, allShipmentsForStats, courierPayments, statuses]);

    const problemCount = (allShipmentsForStats?.filter(s => s.status === 'Returned' || s.status === 'PriceChangeRequested').length || 0);

    return (
        <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4">
            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <TabsList className="bg-muted p-1 rounded-lg">
                        <TabsTrigger value="shipments">الشحنات</TabsTrigger>
                        {role === 'admin' && <TabsTrigger value="management">الإدارة المالية</TabsTrigger>}
                        <TabsTrigger value="problem-inbox" className="relative">المشاكل {problemCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0 text-[10px]">{problemCount}</Badge>}</TabsTrigger>
                        <TabsTrigger value="tools">أدوات إضافية</TabsTrigger>
                    </TabsList>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm"><Link href="/scan"><ScanLine className="h-4 w-4 me-2" />مسح باركود</Link></Button>
                        <Button size="sm" onClick={() => setShipmentSheetOpen(true)} className="bg-primary"><PlusCircle className="h-4 w-4 me-2" />شحنة جديدة</Button>
                    </div>
                </div>
                <StatsCards shipments={activeShipments} role={role} />
                <TabsContent value="shipments">
                    {isMobile ? <MobileShipmentsView shipments={filteredShipments} governorates={governorates} companies={companies} courierUsers={courierUsers} statuses={statuses} onEdit={(s: any) => {setEditingShipment(s); setShipmentSheetOpen(true);}} onBulkUpdate={handleGenericBulkUpdate} onBulkDelete={(rows: any) => {setShipmentToDelete(rows[0]);}} onBulkPrint={(rows: any) => {const ids = rows.map((r: any) => r.id); window.open(`/print/bulk?ids=${ids.join(',')}`, '_blank');}} listIsLoading={allShipmentsLoading} searchTerm={searchTerm} /> : <DesktopShipmentsView listIsLoading={allShipmentsLoading} role={role} filteredShipments={filteredShipments} governorates={governorates} companies={companies} courierUsers={courierUsers} statuses={statuses} openShipmentForm={(s: any) => {setEditingShipment(s); setShipmentSheetOpen(true);}} handleGenericBulkUpdate={handleGenericBulkUpdate} handleBulkDelete={(rows: any) => {setShipmentToDelete(rows[0]);}} handleBulkPrint={(rows: any) => {const ids = rows.map((r: any) => r.id); window.open(`/print/bulk?ids=${ids.join(',')}`, '_blank');}} columnFilters={columnFilters} setColumnFilters={setColumnFilters} unassignedShipments={filteredShipments.filter(s => !s.assignedCourierId)} assignedShipments={filteredShipments.filter(s => !!s.assignedCourierId)} recentlyUpdatedShipments={filteredShipments} inWarehouseShipments={filteredShipments.filter(s => s.isWarehouseReturn)} returnsWithCouriers={filteredShipments.filter(s => s.status === 'Returned')} returningToCompanyShipments={filteredShipments.filter(s => s.isReturningToCompany)} returnedToCompanyShipments={filteredShipments.filter(s => s.isReturnedToCompany)} getShipmentsByStatus={(st: any) => filteredShipments.filter(s => (Array.isArray(st) ? st.includes(s.status) : s.status === st))} />}
                </TabsContent>
                <TabsContent value="management">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {courierDues.map(c => (
                            <Card key={c.id}>
                                <CardHeader><CardTitle>{c.name}</CardTitle><CardDescription>{c.phone}</CardDescription></CardHeader>
                                <CardContent><div className="text-2xl font-bold">{c.netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</div><div className="text-xs text-muted-foreground mt-1">شحنات: {c.totalShipments} | تسليم: {c.deliveredCount}</div></CardContent>
                                <CardFooter><Button size="sm" className="w-full" onClick={() => {setPayingCourier(c); setIsCourierPaymentSheetOpen(true);}}>تسوية</Button></CardFooter>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
            <ShipmentFormSheet open={isShipmentSheetOpen} onOpenChange={setShipmentSheetOpen} onSave={handleSaveShipment} shipment={editingShipment} governorates={governorates || []} couriers={courierUsers} companies={companies || []} statuses={statuses || []} role={role} />
            <AlertDialog open={!!shipmentToDelete} onOpenChange={(o) => !o && setShipmentToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف الشحنة نهائياً.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={async () => {if (shipmentToDelete && firestore) {await deleteDoc(doc(firestore, 'shipments', shipmentToDelete.id)); toast({ title: "تم الحذف" }); setShipmentToDelete(null);}}}>حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <CourierPaymentFormSheet open={isCourierPaymentSheetOpen} onOpenChange={setIsCourierPaymentSheetOpen} courier={payingCourier} onSave={(data: any) => {if (firestore && payingCourier) {const ref = doc(collection(firestore, 'courier_payments')); setDoc(ref, { ...data, courierId: payingCourier.id, paymentDate: serverTimestamp(), recordedById: user.id }).then(() => {toast({ title: "تم التسجيل" }); setIsCourierPaymentSheetOpen(false);});}}} />
        </div>
    );
}
