
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
  RefreshCcw, Filter, LayoutDashboard, Clock, ReceiptText, QrCode
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

const filterShipmentsBySearch = (list: Shipment[], term: string): Shipment[] => {
    if (!term) return list;
    const lowercasedTerm = term.toLowerCase();
    return list.filter(shipment =>
        String(shipment.shipmentCode || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.orderNumber || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.recipientName || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.recipientPhone || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
    );
}

const MobileShipmentsView = React.memo(({
    shipments,
    listIsLoading,
    governorates,
    companies,
    courierUsers,
    statuses,
    onEdit,
    onDelete,
    onPrint,
    onBulkUpdate,
    onBulkDelete,
    onBulkPrint,
    columnFilters,
    setColumnFilters,
    role,
    searchTerm,
  }: {
    shipments: Shipment[];
    listIsLoading: boolean;
    governorates: Governorate[];
    companies: Company[];
    courierUsers: User[];
    statuses: ShipmentStatusConfig[];
    onEdit: (shipment: Shipment) => void;
    onDelete: (shipment: Shipment) => void;
    onPrint: (shipment: Shipment) => void;
    onBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
    onBulkDelete: (selectedRows: Shipment[]) => void;
    onBulkPrint: (selectedRows: Shipment[]) => void;
    columnFilters: ColumnFiltersState;
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
    role: Role | null;
    searchTerm: string;
  }) => {

    const [activeTab, setActiveTab] = React.useState("all-shipments");
    const [mobileRowSelection, setMobileRowSelection] = React.useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const selectedCount = Object.values(mobileRowSelection).filter(Boolean).length;
    
    const returnedShipmentStatuses = React.useMemo(() => statuses?.filter(s => s.isReturnedStatus).map(s => s.id) || [], [statuses]);
    
    const recentlyUpdatedShipments = React.useMemo(() => {
        return [...shipments].sort((a, b) => {
            const timeA = getSafeDate(a.updatedAt)?.getTime() || 0;
            const timeB = getSafeDate(b.updatedAt)?.getTime() || 0;
            return timeB - timeA;
        });
    }, [shipments]);
    
    const unassignedShipments = React.useMemo(() => shipments.filter(s => !s.assignedCourierId), [shipments]);
    const assignedShipments = React.useMemo(() => shipments.filter(s => !!s.assignedCourierId), [shipments]);
    const returnsWithCouriers = React.useMemo(() => {
        return shipments?.filter(s => (returnedShipmentStatuses.includes(s.status) || s.isExchange) && !s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany) || [];
    }, [shipments, returnedShipmentStatuses]);
    const inWarehouseShipments = React.useMemo(() => shipments.filter(s => s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany), [shipments]);
    const returningToCompanyShipments = React.useMemo(() => shipments.filter(s => s.isReturningToCompany && !s.isReturnedToCompany), [shipments]);
    const returnedToCompanyShipments = React.useMemo(() => shipments.filter(s => s.isReturnedToCompany), [shipments]);
   
    const getCurrentShipmentList = () => {
      switch (activeTab) {
        case "recently-updated": return filterShipmentsBySearch(recentlyUpdatedShipments, searchTerm);
        case "unassigned": return filterShipmentsBySearch(unassignedShipments, searchTerm);
        case "assigned": return filterShipmentsBySearch(assignedShipments, searchTerm);
        case "delivered": return filterShipmentsBySearch(shipments.filter(s => ['Delivered'].includes(s.status)), searchTerm);
        case "postponed": return filterShipmentsBySearch(shipments.filter(s => s.status === 'Postponed'), searchTerm);
        case "returns-with-couriers": return filterShipmentsBySearch(returnsWithCouriers, searchTerm);
        case "returns-in-warehouse": return filterShipmentsBySearch(inWarehouseShipments, searchTerm);
        case "returning-to-company": return filterShipmentsBySearch(returningToCompanyShipments, searchTerm);
        case "returned-to-company": return filterShipmentsBySearch(returnedToCompanyShipments, searchTerm);
        case "all-shipments":
        default: return filterShipmentsBySearch(shipments, searchTerm);
      }
    };
    
    const currentList = getCurrentShipmentList();

    const selectedShipments = React.useMemo(() => {
        const selectedIds = Object.keys(mobileRowSelection).filter(id => mobileRowSelection[id]);
        return currentList?.filter(s => selectedIds.includes(s.id)) || [];
    }, [mobileRowSelection, currentList]);

    const handleMobileBulkUpdate = (update: Partial<Shipment>) => {
        onBulkUpdate(selectedShipments, update);
        setMobileRowSelection({});
    };

    const handleMobileBulkDelete = () => {
        onBulkDelete(selectedShipments);
        setMobileRowSelection({});
    };
    
    const handleGenericBulkUpdate = (selectedRows: Shipment[], update: Partial<Shipment>) => {
        onBulkUpdate(selectedRows, update);
    };

    const handleMobileBulkPrint = () => {
        onBulkPrint(selectedShipments);
        setMobileRowSelection({});
    };

    const handleExport = () => {
        if (selectedShipments.length === 0) {
          toast({ title: "لا توجد بيانات للتصدير", description: "الرجاء تحديد شحنة واحدة على الأقل.", variant: "destructive" });
          return;
        }
        const shipmentColumns = getShipmentColumns({ onEdit, onBulkUpdate: handleGenericBulkUpdate, role, governorates, companies, couriers: courierUsers, statuses: [] });
        exportToExcel(selectedShipments, shipmentColumns.filter(c => c.id !== 'select' && c.id !== 'actions'), "shipments", governorates || [], companies || [], courierUsers);
        setMobileRowSelection({});
    }

    const areAllSelected = currentList.length > 0 && currentList.every(s => mobileRowSelection[s.id]);

    const handleSelectAll = () => {
        const newSelection: Record<string, boolean> = {};
        if (areAllSelected) {
            setMobileRowSelection({});
        } else {
            currentList.forEach(s => {
                newSelection[s.id] = true;
            });
            setMobileRowSelection(newSelection);
        }
    };

    React.useEffect(() => {
        setMobileRowSelection({});
    }, [activeTab]);

    const VirtualizedShipmentList = ({ shipmentList }: { shipmentList: Shipment[] }) => {
        const parentRef = React.useRef<HTMLDivElement>(null);
        const rowVirtualizer = useVirtualizer({
          count: shipmentList.length,
          getScrollElement: () => parentRef.current,
          estimateSize: () => 350,
          overscan: 5,
        });
      
        const virtualItems = rowVirtualizer.getVirtualItems();
      
        if (listIsLoading) {
          return (
            <div className="space-y-3 mt-4">
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
          <div ref={parentRef} className="mt-4 overflow-y-auto" style={{ height: `calc(100vh - 20rem)` }}>
            <div
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {virtualItems.map((virtualItem) => {
                const shipment = shipmentList[virtualItem.index];
                return (
                  <div
                    key={shipment.id}
                    className="absolute top-0 left-0 w-full"
                    style={{
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                      paddingBottom: '12px',
                    }}
                  >
                    <ShipmentCard
                      shipment={shipment}
                      statusConfig={statuses?.find(sc => sc.id === shipment.status)}
                      governorateName={governorates?.find(g => g.id === shipment.governorateId)?.name || ''}
                      companyName={companies?.find(c => c.id === shipment.companyId)?.name || ''}
                      onEdit={() => onEdit(shipment)}
                      onDelete={onDelete}
                      onPrint={onPrint}
                      isSelected={!!mobileRowSelection[shipment.id]}
                      onSelectToggle={(id) => {
                        setMobileRowSelection(prev => ({
                          ...prev,
                          [id]: !prev[id]
                        }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
    };

      return (
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 mt-4">
                <TabsList className="grid grid-cols-4 h-auto bg-muted/50 p-1">
                    <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                    <TabsTrigger value="unassigned">غير معينة</TabsTrigger>
                    <TabsTrigger value="assigned">معينة</TabsTrigger>
                    <TabsTrigger value="recently-updated" className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        المُحدَّثة
                    </TabsTrigger>
                    <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
                    <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
                    <TabsTrigger value="returns-with-couriers" className="text-[10px] leading-tight text-center">مرتجعات بالخارج</TabsTrigger>
                    <TabsTrigger value="returns-in-warehouse" className="text-[10px] leading-tight text-center">مرتجعات بالمخزن</TabsTrigger>
                </TabsList>
                <div className="flex flex-col gap-4">
                    <ShipmentFilters governorates={governorates || []} companies={companies || []} courierUsers={courierUsers || []} statuses={statuses || []} onFiltersChange={setColumnFilters} />
                    {currentList.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-9 gap-2 w-full font-medium shadow-sm">
                            <ListChecks className="h-4 w-4" />
                            <span>{areAllSelected ? 'إلغاء تحديد الكل' : `تحديد الكل (${currentList.length})`}</span>
                        </Button>
                    )}
                </div>
            </div>
            <TabsContent value="all-shipments"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            <TabsContent value="unassigned"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            <TabsContent value="assigned"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            <TabsContent value="recently-updated"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            <TabsContent value="delivered"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            <TabsContent value="postponed"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            <TabsContent value="returns-with-couriers"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            <TabsContent value="returns-in-warehouse"><VirtualizedShipmentList shipmentList={currentList} /></TabsContent>
            
            {selectedCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-50 rounded-t-xl" dir="rtl">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-[#5ba4a4] font-bold text-lg">شحنات محددة {selectedCount}</span>
                        <Button variant="ghost" size="sm" onClick={() => setMobileRowSelection({})}>إلغاء</Button>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="bg-white border-slate-200 h-10 px-3 gap-2 text-slate-700 flex-1">
                                        <CheckSquare className="h-4 w-4" />
                                        تغيير الحالة
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {statuses.filter(s => s.enabled).map((status) => (
                                        <DropdownMenuItem key={status.id} onSelect={() => handleMobileBulkUpdate({ status: status.id })}>
                                            {status.label}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="outline" className="bg-white border-slate-200 h-10 px-3 gap-2 text-orange-500 flex-1" onClick={() => handleMobileBulkUpdate({ 
                                status: 'Pending', 
                                assignedCourierId: '', 
                                reason: 'إعادة تعيين الشحنة', 
                                isWarehouseReturn: false, 
                                isReturningToCompany: false, 
                                isReturnedToCompany: false, 
                                retryAttempt: false,
                                requestedAmount: 0,
                                amountChangeReason: ""
                            })}>
                                <RefreshCcw className="h-4 w-4" />
                                <span>إعادة تعيين</span>
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2">
                            <Button 
                                variant="outline" 
                                className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-blue-600 font-medium"
                                onClick={() => handleMobileBulkUpdate({ retryAttempt: true })}
                            >
                                <BellRing className="h-4 w-4" />
                                <span>إعادة محاولة</span>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700">
                                        <UserIcon className="h-4 w-4" />
                                        <span>تعيين مندوب</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="max-h-60 overflow-y-auto">
                                    {courierUsers.map((courier) => (
                                        <DropdownMenuItem key={courier.id} onSelect={() => handleMobileBulkUpdate({ assignedCourierId: courier.id })}>
                                            {courier.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button 
                                variant="outline" 
                                className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700"
                                onClick={() => handleMobileBulkUpdate({ isWarehouseReturn: true })}
                            >
                                <Warehouse className="h-4 w-4" />
                                <span>للمخزن</span>
                            </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700">
                                        <Building className="h-4 w-4" />
                                        <span>تعيين شركة</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="max-h-60 overflow-y-auto">
                                    {companies.map((company) => (
                                        <DropdownMenuItem key={company.id} onSelect={() => handleMobileBulkUpdate({ companyId: company.id })}>
                                            {company.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button 
                                variant="outline" 
                                className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700"
                                onClick={handleMobileBulkPrint}
                            >
                                <Printer className="h-4 w-4" />
                                <span>طباعة</span>
                            </Button>

                            <Button 
                                variant="outline" 
                                className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700"
                                onClick={() => handleMobileBulkUpdate({ isReturningToCompany: true, isWarehouseReturn: false })}
                            >
                                <QrCode className="h-4 w-4" />
                                <span>توصيل للشركة</span>
                            </Button>
                        </div>

                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                className="flex-1 bg-white border-slate-100 h-14 gap-3 text-slate-700 font-medium"
                                onClick={() => handleMobileBulkUpdate({ isReturnedToCompany: true, isReturningToCompany: false })}
                            >
                                <Building className="h-5 w-5" />
                                <span>وصلت للشركة</span>
                            </Button>
                            <Button 
                                variant="destructive" 
                                className="w-14 h-14 p-0 bg-red-500 hover:bg-red-600"
                                onClick={handleMobileBulkDelete}
                            >
                                <Trash2 className="h-6 w-6" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Tabs>
      )
});

const DesktopShipmentsView = React.memo(({
    listIsLoading,
    role,
    filteredShipments,
    getShipmentsByStatus,
    inWarehouseShipments,
    returnsWithCouriers,
    returningToCompanyShipments,
    returnedToCompanyShipments,
    recentlyUpdatedShipments,
    unassignedShipments,
    assignedShipments,
    governorates,
    companies,
    courierUsers,
    statuses,
    openShipmentForm,
    handleGenericBulkUpdate,
    handleBulkDelete,
    handleBulkPrint,
    columnFilters,
    setColumnFilters,
  }: {
    listIsLoading: boolean;
    role: Role | null;
    filteredShipments: Shipment[];
    getShipmentsByStatus: (status: string | string[]) => Shipment[];
    inWarehouseShipments: Shipment[];
    returnsWithCouriers: Shipment[];
    returningToCompanyShipments: Shipment[];
    returnedToCompanyShipments: Shipment[];
    recentlyUpdatedShipments: Shipment[];
    unassignedShipments: Shipment[];
    assignedShipments: Shipment[];
    governorates: Governorate[];
    companies: Company[];
    courierUsers: User[];
    statuses: ShipmentStatusConfig[];
    openShipmentForm: (shipment?: Shipment) => void;
    handleGenericBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
    handleBulkDelete: (selectedRows: Shipment[]) => void;
    handleBulkPrint: (selectedRows: Shipment[]) => void;
    columnFilters: ColumnFiltersState,
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>,
  }) => {
    const renderShipmentTable = (shipmentList: Shipment[], activeTab: any = 'none') => (
        <ShipmentsTable 
          shipments={shipmentList} 
          isLoading={listIsLoading}
          governorates={governorates || []}
          companies={companies || []}
          couriers={courierUsers}
          statuses={statuses}
          onEdit={openShipmentForm}
          role={role}
          onBulkUpdate={handleGenericBulkUpdate}
          onBulkDelete={handleBulkDelete}
          onBulkPrint={handleBulkPrint}
          filters={columnFilters}
          onFiltersChange={setColumnFilters}
          activeTab={activeTab}
        />
    );

    return (
        <Tabs defaultValue="all-shipments" className="w-full">
            <div className="flex items-center justify-between mt-4 mb-2">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                    <TabsTrigger value="unassigned">غير معينة</TabsTrigger>
                    <TabsTrigger value="assigned">معينة</TabsTrigger>
                    <TabsTrigger value="recently-updated" className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        المُحدَّثة
                    </TabsTrigger>
                    <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
                    <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
                    <TabsTrigger value="returns">المرتجعات</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="all-shipments">{renderShipmentTable(filteredShipments)}</TabsContent>
            <TabsContent value="unassigned">{renderShipmentTable(unassignedShipments)}</TabsContent>
            <TabsContent value="assigned">{renderShipmentTable(assignedShipments)}</TabsContent>
            <TabsContent value="recently-updated">{renderShipmentTable(recentlyUpdatedShipments)}</TabsContent>
            <TabsContent value="delivered">{renderShipmentTable(getShipmentsByStatus(['Delivered']))}</TabsContent>
            <TabsContent value="postponed">{renderShipmentTable(getShipmentsByStatus('Postponed'))}</TabsContent>
            <TabsContent value="returns">
                <Tabs defaultValue="returns-with-couriers">
                    <TabsList className="bg-muted/30 p-1 mb-4">
                        <TabsTrigger value="returns-with-couriers">لدى المناديب ({returnsWithCouriers.length})</TabsTrigger>
                        <TabsTrigger value="returns-in-warehouse">في المخزن ({inWarehouseShipments.length})</TabsTrigger>
                        <TabsTrigger value="returning-to-company">قيد التوصيل للشركة ({returningToCompanyShipments.length})</TabsTrigger>
                        <TabsTrigger value="returned-to-company">وصلت للشركة ({returnedToCompanyShipments.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="returns-with-couriers">{renderShipmentTable(returnsWithCouriers, 'returns-with-couriers')}</TabsContent>
                    <TabsContent value="returns-in-warehouse">{renderShipmentTable(inWarehouseShipments, 'returns-in-warehouse')}</TabsContent>
                    <TabsContent value="returning-to-company">{renderShipmentTable(returningToCompanyShipments, 'returning-to-company')}</TabsContent>
                    <TabsContent value="returned-to-company">{renderShipmentTable(returnedToCompanyShipments, 'returned-to-company')}</TabsContent>
                </Tabs>
            </TabsContent>
        </Tabs>
    )
});

const ProblemShipmentList = ({ title, icon, shipments, onEdit, children }: { title: string, icon: React.ReactNode, shipments: Shipment[], onEdit: (s: Shipment) => void, children?: (shipment: Shipment) => React.ReactNode }) => {
    if (shipments.length === 0) {
        return null;
    }
    return (
        <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden transition-all hover:shadow-md">
            <CardHeader className="bg-muted/30 py-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    {icon}
                    {title} <Badge variant="secondary" className="ms-2">{shipments.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {shipments.map(s => (
                        <div key={s.id} className="p-4 flex justify-between items-center hover:bg-muted/10 transition-colors">
                            <div className="flex-1">
                                {children ? children(s) : <p className="font-medium text-sm">تفاصيل الشحنة {s.recipientName}</p>}
                            </div>
                            <Button variant="outline" size="sm" className="ms-4 shadow-sm" onClick={() => onEdit(s)}>
                                <Pencil className="h-3.5 w-3.5 me-1.5" />
                                مراجعة
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

interface AdminDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
  initialTab?: string | null;
  initialChatId?: string | null;
}

export default function AdminDashboard({ user, role, searchTerm, initialTab, initialChatId }: AdminDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [isUserSheetOpen, setIsUserSheetOpen] = React.useState(false);
  const [isCourierPaymentSheetOpen, setIsCourierPaymentSheetOpen] = React.useState(false);
  const [isCompanyPaymentSheetOpen, setIsCompanyPaymentSheetOpen] = React.useState(false);
  
  const [isAdminNoteDialogOpen, setIsAdminNoteDialogOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [editingUser, setEditingUser] = React.useState<User | undefined>(undefined);
  const [editingCompany, setEditingCompany] = React.useState<Company | undefined>(undefined);
  
  const [payingCourier, setPayingCourier] = React.useState<User | undefined>(undefined);
  const [editingCourierPayment, setEditingCourierPayment] = React.useState<CourierPayment | undefined>(undefined);
  const [notingCourier, setNotingCourier] = React.useState<User | undefined>(undefined);
  
  const [payingCompany, setPayingCompany] = React.useState<Company | undefined>(undefined);
  const [editingCompanyPayment, setEditingCompanyPayment] = React.useState<CompanyPayment | undefined>(undefined);
  
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [shipmentToDelete, setShipmentToDelete] = React.useState<Shipment | null>(null);
  const [isSavingShipment, setIsSavingShipment] = React.useState(false);
  const [courierPaymentToDelete, setCourierPaymentToDelete] = React.useState<CourierPayment | null>(null);
  const [companyPaymentToDelete, setCompanyPaymentToDelete] = React.useState<CompanyPayment | null>(null);
  
  const [courierToArchive, setCourierToArchive] = React.useState<User | null>(null);
  const [companyToArchive, setCompanyToArchive] = React.useState<Company | null>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const isMobile = useIsMobile();
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = React.useState(initialTab || "shipments");

  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [managementSearchTerm, setManagementSearchTerm] = React.useState('');
  const [processingShipments, setProcessingShipments] = React.useState<Set<string>>(new Set());

  const { user: authUser } = useUser();

  // Fetch shipments updated in the last 120 days for better visibility of active shipments
  const allShipmentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const oneHundredTwentyDaysAgo = subDays(new Date(), 120);
    return query(
        collection(firestore, 'shipments'),
        where('updatedAt', '>=', Timestamp.fromDate(oneHundredTwentyDaysAgo)),
        orderBy('updatedAt', 'desc')
    );
  }, [firestore]);
  
  const { data: allShipmentsForStats, isLoading: allShipmentsLoading } = useCollection<Shipment>(allShipmentsQuery);

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

  useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
          setEditingShipment({ id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment);
          setShipmentSheetOpen(true);
        } else {
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
      const newParams = new URLSearchParams(searchParams.toString());
      if (newParams.has('edit')) {
        newParams.delete('edit');
        router.replace(`${pathname}?${newParams.toString()}`);
      }
    }
  };

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

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
  
  const couriersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'couriers'));
  }, [firestore]);
  const { data: couriersData, isLoading: couriersDataLoading } = useCollection<Courier>(couriersQuery);

  const courierPaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courier_payments'), orderBy('paymentDate', 'desc'), limit(200));
  }, [firestore, user]);
  const { data: courierPayments } = useCollection<CourierPayment>(courierPaymentsQuery);

  const companyPaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'company_payments'), orderBy('paymentDate', 'desc'), limit(200));
  }, [firestore, user]);
  const { data: companyPayments } = useCollection<CompanyPayment>(companyPaymentsQuery);
  
  const statusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'shipment_statuses'));
  }, [firestore]);
  const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);

  const courierUsers = useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);

  // COMBINED PAYMENTS LOG LOGIC
  const combinedPaymentsLog = useMemo(() => {
    if (!courierPayments || !companyPayments || !users || !companies) return [];
    
    const courierLogs = courierPayments.map(p => ({
        ...p,
        type: 'courier' as const,
        entityName: users.find(u => u.id === p.courierId)?.name || 'غير معروف',
        date: getSafeDate(p.paymentDate)
    }));

    const companyLogs = companyPayments.map(p => ({
        ...p,
        type: 'company' as const,
        entityName: companies.find(c => c.id === p.companyId)?.name || 'غير معروف',
        date: getSafeDate(p.paymentDate)
    }));

    return [...courierLogs, ...companyLogs].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [courierPayments, companyPayments, users, companies]);
  
  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const openUserForm = (user?: User, company?: Company) => {
    setEditingUser(user);
    setEditingCompany(company);
    setIsUserSheetOpen(true);
  };

  const openCourierPaymentForm = (courier: User, payment?: CourierPayment) => {
    setPayingCourier(courier);
    setEditingCourierPayment(payment);
    setIsCourierPaymentSheetOpen(true);
  }
  
  const openAdminNoteDialog = (courier: User) => {
    setNotingCourier(courier);
    setIsAdminNoteDialogOpen(true);
  };
  
  const openCompanyPaymentForm = (company: Company, payment?: CompanyPayment) => {
    setPayingCompany(company);
    setEditingCompanyPayment(payment);
    setIsCompanyPaymentSheetOpen(true);
  }
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore || !authUser || !companies || !governorates) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = read(data, { type: "binary", cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = utils.sheet_to_json<any>(worksheet);

            const result: ImportResult = {
                added: 0,
                updated: 0,
                rejected: 0,
                total: json.length,
                errors: [],
                processing: true,
                shipmentsToUpdate: [],
            };
            setImportResult(result);

            const functions = getFunctions(app);
            const handleShipmentUpdateFn = httpsCallable(functions, "handleShipmentUpdate");

            const shipmentsToUpdate: { existing: Shipment, new: Partial<Shipment> }[] = [];

            for (const row of json) {
                const companyNameFromSheet = row["الشركة"]?.toString().trim() || row["العميل"]?.toString().trim();
                const senderNameFromSheet = row["الراسل"]?.toString().trim();
                let shipmentCodeValue = String(row["كود الشحنة"] || "").trim();
                
                if (!shipmentCodeValue) {
                    result.rejected++;
                    result.errors.push({ ...row, "سبب الرفض": "كود الشحنة مفقود" });
                    continue;
                }

                const foundCompany = companies.find(c => c.name === companyNameFromSheet);
                if (!foundCompany) {
                    result.rejected++;
                    result.errors.push({ ...row, "سبب الرفض": `شركة "${companyNameFromSheet}" غير موجودة` });
                    continue;
                }

                const governorateName = String(row["المحافظة"] || "").trim();
                const foundGovernorate = governorates.find(g => g.name === governorateName);
                if (!foundGovernorate) {
                    result.rejected++;
                    result.errors.push({ ...row, "سبب الرفض": `محافظة "${governorateName}" غير موجودة` });
                    continue;
                }

                const existingDocsQuery = query(collection(firestore, "shipments"), where("shipmentCode", "==", shipmentCodeValue));
                const snapshot = await getDocs(existingDocsQuery);
                const existingDoc = snapshot.empty ? null : snapshot.docs[0];

                const recipientName = String(row["المرسل اليه"] || "بدون اسم").trim();
                let recipientPhone = String(row["التليفون"]?.toString() || "").trim();
                const totalAmountValue = String(row["الاجمالي"] || row["الاجمالى"] || "0").replace(/[^0-9.]/g, "");

                const shipmentData: Partial<Omit<Shipment, "id">> = {
                    shipmentCode: shipmentCodeValue,
                    senderName: senderNameFromSheet,
                    recipientName: recipientName,
                    recipientPhone: recipientPhone,
                    governorateId: foundGovernorate.id,
                    address: String(row["العنوان"] || "N/A").trim(),
                    totalAmount: parseFloat(totalAmountValue) || 0,
                    status: "Pending",
                    companyId: foundCompany.id,
                };
                
                const cleanShipmentData = Object.fromEntries(Object.entries(shipmentData).filter(([_, v]) => v !== undefined && v !== null && v !== ""));

                if (existingDoc) {
                    const existingShipmentData = { id: existingDoc.id, ...existingDoc.data() } as Shipment;
                    const isFullyArchived = existingShipmentData.isArchivedForCompany && existingShipmentData.isArchivedForCourier;

                    if (isFullyArchived) {
                        const newDocRef = doc(collection(firestore, "shipments"));
                        await handleShipmentUpdateFn({ shipmentId: newDocRef.id, ...cleanShipmentData });
                        result.added++;
                    } else {
                        if (existingShipmentData.assignedCourierId && existingShipmentData.status !== "Pending") {
                            delete cleanShipmentData.status;
                        }
                        shipmentsToUpdate.push({ existing: existingShipmentData, new: cleanShipmentData });
                        result.updated++;
                    }
                } else {
                    const newDocRef = doc(collection(firestore, "shipments"));
                    await handleShipmentUpdateFn({ shipmentId: newDocRef.id, ...cleanShipmentData });
                    result.added++;
                }
                setImportResult({ ...result, shipmentsToUpdate });
            }
            setImportResult(prev => prev ? { ...prev, processing: false } : null);
        } catch (error: any) {
            console.error("Error importing file:", error);
            setImportResult(prev => prev ? { ...prev, processing: false, finalError: "حدث خطأ أثناء معالجة الملف." } : null);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveShipment = async (data: Partial<Omit<Shipment, "id" | "createdAt" | "updatedAt">>, id?: string) => {
    if (!firestore || !authUser || !app || isSavingShipment) return;
    setIsSavingShipment(true);
    try {
        const functions = getFunctions(app);
        const handleShipmentUpdateFn = httpsCallable(functions, "handleShipmentUpdate");
        const payload: any = { ...data, shipmentId: id || doc(collection(firestore, "shipments")).id };
        
        await handleShipmentUpdateFn(payload);
        toast({ title: id ? "تم تحديث الشحنة" : "تم حفظ الشحنة", description: "تمت العملية بنجاح" });
        handleSheetOpenChange(false);

        if (data.assignedCourierId && (!editingShipment || data.assignedCourierId !== editingShipment.assignedCourierId)) {
            await sendPushNotification({
                recipientId: data.assignedCourierId,
                title: "شحنة جديدة",
                body: `تم تعيين شحنة جديدة لك: ${data.recipientName}`,
                url: `${window.location.origin}/?edit=${payload.shipmentId}`,
            }).catch(console.error);
        } else if (id && editingShipment?.assignedCourierId) {
             await sendPushNotification({
                recipientId: editingShipment.assignedCourierId,
                title: "تحديث في شحنة",
                body: `تم تحديث بيانات الشحنة: ${editingShipment.recipientName}`,
                url: `${window.location.origin}/?edit=${id}`,
            }).catch(console.error);
        }
    } catch (error: any) {
        console.error("Error saving shipment:", error);
        toast({ title: "فشل التحديث", description: error.message || "حدث خطأ غير متوقع", variant: "destructive" });
    } finally {
        setIsSavingShipment(false);
    }
  };


  const handleDeleteShipment = (shipmentsToDelete: Shipment[]) => {
    if (!firestore || shipmentsToDelete.length === 0) return;
    
    const batch = writeBatch(firestore);
    shipmentsToDelete.forEach(shipment => {
        const docRef = doc(firestore, 'shipments', shipment.id);
        batch.delete(docRef);
    })
    
    batch.commit()
        .then(() => {
            toast({ title: `تم حذف ${shipmentsToDelete.length} شحنة بنجاح` });
        })
        .catch((err) => {
             if (err instanceof Error && 'code' in err && err.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'shipments',
                    operation: 'delete'
                }));
             } else {
                toast({ title: 'خطأ', description: 'حدث خطأ أثناء حذف الشحنات', variant: 'destructive' });
             }
        })
        .finally(() => {
            setShipmentToDelete(null);
        });
  };

  const handlePrintShipment = (shipment: Shipment) => {
    const printUrl = `/print/${shipment.id}`;
    window.open(printUrl, '_blank', 'width=800,height=600');
  };

  const handleSaveUser = async (data: any, userId?: string) => {
    if (!firestore) {
        toast({ variant: "destructive", title: "خطأ", description: "خدمات Firebase غير متاحة" });
        return;
    }
    setIsUserSheetOpen(false);

    if (userId) {
        toast({ title: "جاري تحديث المستخدم...", description: "قد تستغرق هذه العملية بضع لحظات." });
        
        if (data.password) {
            const passResult = await updateAuthUserPassword({ uid: userId, password: data.password });
            if (!passResult.success) {
                toast({ variant: "destructive", title: "فشل تحديث كلمة المرور", description: `حدث خطأ: ${passResult.error}` });
                return;
            }
        }
        
        const batch = writeBatch(firestore);
        const userDocRef = doc(firestore, 'users', userId);
        const userUpdatePayload: any = { name: data.name, phone: data.phone, updatedAt: serverTimestamp() };

        if (data.role === 'courier') {
            userUpdatePayload.commissionRate = data.commissionRate;
            const courierDocRef = doc(firestore, 'couriers', userId);
            batch.update(courierDocRef, { name: data.name, commissionRate: data.commissionRate });
        } else if (data.role === 'company') {
            const companyDocRef = doc(firestore, 'companies', userId);
            batch.update(companyDocRef, { name: data.name, governorateCommissions: data.governorateCommissions || {} });
        }

        batch.update(userDocRef, userUpdatePayload);

        batch.commit()
            .then(() => {
                toast({ title: "تم تحديث المستخدم بنجاح!", description: `تم تحديث بيانات ${data.name}.` });
            })
            .catch(serverError => {
                if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: 'batch_write (users, etc.)',
                        operation: 'update',
                        requestResourceData: { note: `Batch update for user ${userId} failed.` }
                    });
                    errorEmitter.emit('permission-error', permissionError);
                }
            });

    } else {
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
            phone: data.phone,
            createdAt: serverTimestamp(),
        };

        if (data.role === 'company') {
            const companyRef = doc(firestore, 'companies', newUid);
            batch.set(companyRef, { id: newUid, name: data.name, governorateCommissions: data.governorateCommissions || {} });
            userPayload.companyId = newUid;
        } else if (data.role === 'courier') {
            const courierRef = doc(firestore, 'couriers', newUid);
            const courierData: Courier = { 
                id: newUid, 
                name: data.name, 
                commissionRate: data.commissionRate || 0,
                adminNote: { message: "", isRead: true, updatedAt: serverTimestamp() }
            };
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
                if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: 'batch_write (users, roles, etc.)',
                        operation: 'write',
                        requestResourceData: { note: `Batch create for user ${data.email} failed.` }
                    });
                    errorEmitter.emit('permission-error', permissionError);
                }
            });
    }
  };

  const handleDeleteUser = async () => {
    if (!firestore || !userToDelete) return;
    toast({ title: `جاري حذف ${userToDelete.name}...`});

    const authResult = await deleteAuthUser({ uid: userToDelete.id });
    if (!authResult.success) {
      toast({ variant: "destructive", title: "فشل حذف المستخدم من نظام المصادقة", description: `حدث خطأ: ${authResult.error}` });
      setUserToDelete(null);
      return;
    }

    const batch = writeBatch(firestore);
    
    const userDocRef = doc(firestore, 'users', userToDelete.id);
    batch.delete(userDocRef);

    const roleDocRef = doc(firestore, `roles_${userToDelete.role}`, userToDelete.id);
    batch.delete(roleDocRef);

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
      if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: `batch_delete`,
            operation: 'delete',
            requestResourceData: { note: `Batch delete for user ${userToDelete.id} failed.` }
        });
        errorEmitter.emit('permission-error', permissionError);
      }
      setUserToDelete(null);
    });
  };

  const handleSaveCourierPayment = (paymentData: { amount: number; notes?: string }, paymentId?: string) => {
    if (!firestore || !payingCourier || !user) return;
    
    if (paymentId) {
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
          if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: paymentDocRef.path,
                operation: 'update',
                requestResourceData: dataToUpdate,
            });
            errorEmitter.emit('permission-error', permissionError);
          }
        });

    } else {
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
          if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: paymentDocRef.path,
                operation: 'create',
                requestResourceData: newPayment,
            });
            errorEmitter.emit('permission-error', permissionError);
          }
        });
    }
    setIsCourierPaymentSheetOpen(false);
    setPayingCourier(undefined);
    setEditingCourierPayment(undefined);
  };
  
    const handleSaveCompanyPayment = (paymentData: { amount: number; notes?: string }, paymentId?: string) => {
    if (!firestore || !payingCompany || !user) return;
    
    if (paymentId) {
      const paymentDocRef = doc(firestore, 'company_payments', paymentId);
      const dataToUpdate = { ...paymentData, updatedAt: serverTimestamp() };
      updateDoc(paymentDocRef, dataToUpdate)
        .catch(serverError => {
          if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: paymentDocRef.path, operation: 'update', requestResourceData: dataToUpdate });
            errorEmitter.emit('permission-error', permissionError);
          }
        });

    } else {
      const paymentsCollection = collection(firestore, 'company_payments');
      const paymentDocRef = doc(paymentsCollection);
      const newPayment: CompanyPayment = {
          id: paymentDocRef.id,
          companyId: payingCompany.id,
          amount: paymentData.amount,
          paymentDate: serverTimestamp(),
          recordedById: user.id,
          notes: paymentData.notes || "",
      };
      setDoc(paymentDocRef, newPayment)
        .catch(serverError => {
          if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: paymentDocRef.path, operation: 'create', requestResourceData: newPayment });
            errorEmitter.emit('permission-error', permissionError);
          }
        });
    }
    setIsCompanyPaymentSheetOpen(false);
    setPayingCompany(undefined);
    setEditingCompanyPayment(undefined);
  };
  
  const handleDeleteCourierPayment = () => {
    if (!firestore || !courierPaymentToDelete) return;
    
    const docRef = doc(firestore, 'courier_payments', courierPaymentToDelete.id);
    deleteDoc(docRef)
      .then(() => {
        toast({ title: "تم حذف الدفعة", description: "تم حذف سجل الدفعة بنجاح." });
      })
      .catch(serverError => {
        if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        }
      })
      .finally(() => setCourierPaymentToDelete(null));
  };
  
  const handleDeleteCompanyPayment = () => {
    if (!firestore || !companyPaymentToDelete) return;
    
    const docRef = doc(firestore, 'company_payments', companyPaymentToDelete.id);
    deleteDoc(docRef)
      .catch(serverError => {
        if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        }
      })
      .finally(() => setCompanyPaymentToDelete(null));
  };


const handleArchiveCourierData = async () => {
    if (!firestore || !courierToArchive || !user || !statuses) return;
    toast({ title: `جاري أرشفة وتسوية حساب ${courierToArchive.name}...` });

    const courierDueData = courierDues.find(d => d.id === courierToArchive.id);
    if (!courierDueData) {
        toast({ title: "خطأ", description: "لم يتم العثور على البيانات المالية للمندوب.", variant: "destructive"});
        setCourierToArchive(null);
        return;
    }
    
    const netDue = courierDueData.netDue;
    const batch = writeBatch(firestore);

    if (netDue > 0) {
        const paymentRef = doc(collection(firestore, 'courier_payments'));
        const newPayment: Partial<CourierPayment> = {
            id: paymentRef.id,
            courierId: courierToArchive.id,
            amount: netDue,
            paymentDate: serverTimestamp(),
            recordedById: user.id,
            notes: "تسوية وحفظ تلقائي للحساب",
            isArchived: true,
        };
        batch.set(paymentRef, newPayment);
    }
    
    const activePayments = courierPayments?.filter(p => p.courierId === courierToArchive.id && !p.isArchived) || [];
    activePayments.forEach(payment => {
        const paymentRef = doc(firestore, 'courier_payments', payment.id);
        batch.update(paymentRef, { isArchived: true });
    });


    const finishedStatuses = statuses.filter(s => s.affectsCourierBalance).map(s => s.id);
    const courierShipmentsToArchive = allShipmentsForStats?.filter(s => s.assignedCourierId === courierToArchive.id && finishedStatuses.includes(s.status) && !s.isArchivedForCourier) || [];
    
    courierShipmentsToArchive.forEach(shipment => {
        const shipmentRef = doc(firestore, 'shipments', shipment.id);
        batch.update(shipmentRef, { 
            isArchivedForCourier: true, 
            courierArchivedAt: serverTimestamp(),
            updatedAt: serverTimestamp() 
        });
    });

    try {
        await batch.commit();
        toast({ title: "اكتملت التسوية بنجاح!", description: `تمت تسوية حساب ${courierToArchive.name} وأرشفة الشحنات والدفعات.` });
    } catch (error: any) {
        console.error("Archiving error:", error);
        toast({ title: "خطأ في الأرشفة", description: error.message, variant: "destructive" });
    } finally {
        setCourierToArchive(null);
    }
};

const handleArchiveCompanyData = async () => {
    if (!firestore || !companyToArchive || !user || !statuses) return;
    toast({ title: `جاري أرشفة وتسوية حساب ${companyToArchive.name}...` });

    const companyDueData = companyDues.find(d => d.id === companyToArchive.id);
    if (!companyDueData) {
        toast({ title: "خطأ", description: "لم يتم العثور على البيانات المالية للشركة.", variant: "destructive"});
        setCompanyToArchive(null);
        return;
    }
  
    const netDue = companyDueData.netDue;
    const batch = writeBatch(firestore);
  
    if (netDue > 0) {
        const paymentRef = doc(collection(firestore, 'company_payments'));
        const newPayment: Partial<CompanyPayment> = {
            id: paymentRef.id,
            companyId: companyToArchive.id,
            amount: netDue,
            paymentDate: serverTimestamp(),
            recordedById: user.id,
            notes: "تسوية وحفظ تلقائي للحساب",
            isArchived: true,
        };
        batch.set(paymentRef, newPayment);
    }
  
    const activePayments = companyPayments?.filter(p => p.companyId === companyToArchive.id && !p.isArchived) || [];
    activePayments.forEach(payment => {
        const paymentRef = doc(firestore, 'company_payments', payment.id);
        batch.update(paymentRef, { isArchived: true });
    });
  
    const finishedStatuses = statuses.filter(s => s.affectsCompanyBalance).map(s => s.id);
    const companyShipmentsToArchive = allShipmentsForStats?.filter(s => s.companyId === companyToArchive.id && finishedStatuses.includes(s.status) && !s.isArchivedForCompany) || [];
    
    companyShipmentsToArchive.forEach(shipment => {
        const shipmentRef = doc(firestore, 'shipments', shipment.id);
        batch.update(shipmentRef, { 
            isArchivedForCompany: true, 
            companyArchivedAt: serverTimestamp(),
            updatedAt: serverTimestamp() 
        });
    });
  
    try {
        await batch.commit();
        toast({ title: "اكتملت التسوية والأرشفة بنجاح!", description: `تمت تسوية حساب ${companyToArchive.name} وأرشفة جميع الشحنات والدفعات المنتهية.` });
    } catch (error: any) {
        console.error("Archiving error:", error);
        toast({ title: "خطأ في الأرشفة", description: error.message, variant: "destructive" });
    } finally {
        setCompanyToArchive(null);
    }
};

  
  const activeShipments = useMemo(() => {
    if (!allShipmentsForStats) return [];
    return allShipmentsForStats.filter(s => !(s.isArchivedForCompany && s.isArchivedForCourier));
  }, [allShipmentsForStats]);


  const filteredShipments = useMemo(() => {
    if (!activeShipments) return [];
  
    let baseShipments = activeShipments;
  
    if (searchTerm) {
        return filterShipmentsBySearch(baseShipments, searchTerm);
    }
  
    if (columnFilters.length > 0) {
      return baseShipments.filter((shipment) => {
        const dateRangeFilter = columnFilters.find(f => f.id === 'createdAt');
        const otherFilters = columnFilters.filter(f => f.id !== 'createdAt');
    
        if (dateRangeFilter) {
          const { from, to } = dateRangeFilter.value as DateRange;
          const createdAt = getSafeDate(shipment.createdAt);
          if (!createdAt) return false;
          if (from && createdAt < from) return false;
          const toDateWithTime = to ? new Date(to.setHours(23, 59, 59, 999)) : null;
          if (toDateWithTime && createdAt > toDateWithTime) return false;
        }
    
        return otherFilters.every(filter => {
          const value = (shipment as any)[filter.id];
          const filterValue = filter.value as string[];
          if (Array.isArray(filterValue) && filterValue.length > 0) {
            return filterValue.includes(value);
          }
          return true;
        });
      });
    }

    return baseShipments;
  }, [activeShipments, searchTerm, columnFilters]);
  
  
  const unassignedShipments = useMemo(() => {
    const unassigned = filteredShipments?.filter(s => !s.assignedCourierId) || [];
    return unassigned;
  }, [filteredShipments]);

  const assignedShipments = useMemo(() => {
      const assigned = filteredShipments?.filter(s => !!s.assignedCourierId) || [];
      return assigned;
  }, [filteredShipments]);

    
  const recentlyUpdatedShipments = useMemo(() => {
    const activeShipmentsForSort = filteredShipments || [];
    const sorted = [...activeShipmentsForSort].sort((a, b) => {
        const timeA = getSafeDate(a.updatedAt)?.getTime() || 0;
        const timeB = getSafeDate(b.updatedAt)?.getTime() || 0;
        return timeB - timeA;
    });
    return sorted;
  }, [filteredShipments]);


const returnedShipmentStatuses = useMemo(() => statuses?.filter(s => s.isReturnedStatus).map(s => s.id) || [], [statuses]);

const returnsWithCouriers = useMemo(() => {
    const returns = filteredShipments?.filter(s => (returnedShipmentStatuses.includes(s.status) || s.isExchange) && !s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany) || [];
    return returns;
}, [filteredShipments, returnedShipmentStatuses]);

const inWarehouseShipments = useMemo(() => {
    const warehouse = filteredShipments?.filter(s => s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany) || [];
    return warehouse;
}, [filteredShipments]);

const returningToCompanyShipments = useMemo(() => {
    return filteredShipments?.filter(s => s.isReturningToCompany && !s.isReturnedToCompany) || [];
}, [filteredShipments]);

const returnedToCompanyShipments = useMemo(() => {
    const returned = filteredShipments?.filter(s => s.isReturnedToCompany) || [];
    return returned;
}, [filteredShipments]);


  const courierDues = useMemo(() => {
    if (!users || !allShipmentsForStats || !courierPayments || !statuses) return [];

    return courierUsers.map(courier => {
        const activeShipmentsForCourier = allShipmentsForStats?.filter(s => s.assignedCourierId === courier.id && !s.isArchivedForCourier) || [];
        const activePayments = courierPayments?.filter(p => p.courierId === courier.id && !p.isArchived) || [];
        
        const totalCollected = activeShipmentsForCourier.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCommission = activeShipmentsForCourier.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
        const totalPaidByCourier = activePayments.reduce((acc, p) => acc + p.amount, 0);

        const netDue = (totalCollected - totalCommission) - totalPaidByCourier;
        
        const allPaymentsForCourier = courierPayments?.filter(p => p.courierId === courier.id) || [];
        
        const deliveredStatuses = statuses.filter(s => s.isDeliveredStatus).map(s => s.id);
        const returnedStatusesForCalc = statuses.filter(s => s.isReturnedStatus).map(s => s.id);
        const postponedStatuses = ['Postponed']; // or from statuses config if added
        
        return {
            ...courier,
            totalShipments: activeShipmentsForCourier.length,
            deliveredCount: activeShipmentsForCourier.filter(s => deliveredStatuses.includes(s.status)).length,
            returnedCount: activeShipmentsForCourier.filter(s => returnedStatusesForCalc.includes(s.status)).length,
            postponedCount: activeShipmentsForCourier.filter(s => postponedStatuses.includes(s.status)).length,
            totalCollected,
            totalCommission,
            totalPaidByCourier: allPaymentsForCourier.filter(p => !p.isArchived).reduce((acc, p) => acc + p.amount, 0),
            netDue,
            paymentHistory: allPaymentsForCourier.sort((a, b) => (getSafeDate(b.paymentDate)?.getTime() || 0) - (getSafeDate(a.paymentDate)?.getTime() || 0)),
        }
    })
  }, [users, allShipmentsForStats, courierUsers, courierPayments, statuses]);
  
  const companyDues = useMemo(() => {
    if (!companies || !allShipmentsForStats || !companyPayments) return [];
    
    return companies.map(company => {
        const activeShipmentsForCompany = allShipmentsForStats?.filter(s => s.companyId === company.id && !s.isArchivedForCompany) || [];
        const activePayments = companyPayments?.filter(p => p.companyId === company.id && !p.isArchived) || [];
        
        const totalRevenue = activeShipmentsForCompany.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCompanyCommission = activeShipmentsForCompany.reduce((acc, s) => acc + (s.companyCommission || 0), 0);
        const totalPaidToCompany = activePayments.reduce((acc, p) => acc + p.amount, 0);
        
        const netDue = (totalRevenue - totalCompanyCommission) - totalPaidToCompany;
        
        const allPaymentsForCompany = companyPayments?.filter(p => p.companyId === company.id) || [];

        return {
            ...company,
            totalShipments: activeShipmentsForCompany.length,
            totalRevenue,
            totalCompanyCommission,
            totalPaidToCompany,
            netDue,
            paymentHistory: allPaymentsForCompany.sort((a, b) => (getSafeDate(b.paymentDate)?.getTime() || 0) - (getSafeDate(a.paymentDate)?.getTime() || 0)),
        }
    })
  }, [companies, allShipmentsForStats, companyPayments]);

  const shownNotificationsRef = useRef<Set<string>>(new Set());

  const returnedShipmentsNeedingAction = useMemo(() => allShipmentsForStats?.filter(s => s.status === 'Returned') || [], [allShipmentsForStats]);
  const longPostponedShipments = useMemo(() => {
      return allShipmentsForStats?.filter(s => {
          const updatedAt = getSafeDate(s.updatedAt);
          return s.status === 'Postponed' && updatedAt && differenceInDays(new Date(), updatedAt) > 3;
      }) || [];
  }, [allShipmentsForStats]);
  const staleInTransitShipments = useMemo(() => {
      return allShipmentsForStats?.filter(s => {
          const updatedAt = getSafeDate(s.updatedAt);
          return s.status === 'In-Transit' && updatedAt && differenceInHours(new Date(), updatedAt) > 24;
      }) || [];
  }, [allShipmentsForStats]);
  const priceChangeRequests = useMemo(() => allShipmentsForStats?.filter(s => s.status === 'PriceChangeRequested') || [], [allShipmentsForStats]);
  
  const problemCount = returnedShipmentsNeedingAction.length + longPostponedShipments.length + staleInTransitShipments.length + priceChangeRequests.length;


  useEffect(() => {
    if (usersLoading || allShipmentsLoading || companiesLoading) return;
  
    courierDues.forEach(courier => {
      const notificationId = `due_${courier.id}`;
      if (courier.netDue > 5000 && !shownNotificationsRef.current.has(notificationId)) {
        toast({
          title: "تنبيه: ديون مندوب مرتفعة",
          description: `المبلغ المستحق على ${courier.name} هو ${courier.netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}.`,
          variant: "destructive",
        });
        shownNotificationsRef.current.add(notificationId);
      }
    });

    courierUsers.forEach(courier => {
        const activeShipmentCount = allShipmentsForStats?.filter(s => s.assignedCourierId === courier.id).length || 0;
        const notificationId = `overload_${courier.id}`;
        if (activeShipmentCount > 20 && !shownNotificationsRef.current.has(notificationId)) {
            toast({
                title: "تنبيه: ضغط عمل على مندوب",
                description: `لدى ${courier.name} حالياً ${activeShipmentCount} شحنة نشطة.`,
            });
            shownNotificationsRef.current.add(notificationId);
        }
    });

    const today = new Date().toISOString().split('T')[0];
    companies?.forEach(company => {
      const notificationId = `returns_${company.id}_${today}`;
      const todaysReturns = allShipmentsForStats?.filter(s => {
        if (s.companyId !== company.id || (s.status !== 'Returned' && s.status !== 'Refused (Unpaid)')) return false;
        const updatedAt = getSafeDate(s.updatedAt);
        return updatedAt && updatedAt.toISOString().split('T')[0] === today;
      }).length || 0;

      if (todaysReturns > 5 && !shownNotificationsRef.current.has(notificationId)) {
        toast({
            title: "تنبيه: مرتجعات شركة مرتفعة",
            description: `تم تسجيل ${todaysReturns} مرتجعات اليوم من شركة ${company.name}.`,
            variant: "destructive",
        });
        shownNotificationsRef.current.add(notificationId);
      }
    });

  }, [courierDues, courierUsers, allShipmentsForStats, companies, toast, usersLoading, allShipmentsLoading, companiesLoading]);
  

  const currentCourierNetDue = courierDues.find(c => c.id === payingCourier?.id)?.netDue;
  const currentCompanyNetDue = companyDues.find(c => c.id === payingCompany?.id)?.netDue;
  
  const handleGenericBulkUpdate = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !authUser || !app) return;
    
    if (selectedRows.length === 0) {
        toast({ title: 'لم يتم تحديد أي شحنات' });
        return;
    }
  
    const functions = getFunctions(app);
    const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

    toast({ title: `جاري تحديث ${selectedRows.length} شحنة...` });
    const updatePromises = selectedRows.map(row => {
        const payload: Partial<Shipment> = { ...update };
        if (payload.retryAttempt) {
            payload.status = "Pending";
            payload.isArchivedForCompany = false;
            payload.isArchivedForCourier = false;
            payload.isWarehouseReturn = false;
            payload.reason = "إعادة محاولة";
        }
        return handleShipmentUpdateFn({ shipmentId: row.id, ...payload })
          .catch(error => ({ error, shipmentId: row.id }))
    });

    const results = await Promise.all(updatePromises);
    const failedUpdates = results.filter(res => res && "error" in res);
    if (failedUpdates.length > 0) {
        toast({ title: `فشل تحديث ${failedUpdates.length} شحنة`, variant: "destructive" });
        console.error("Bulk update failures:", failedUpdates);
    } else {
        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
    }
    if (update.assignedCourierId && selectedRows.length > 0) {
      const notificationUrl = typeof window !== "undefined" ? `${window.location.origin}/` : "/";
      await sendPushNotification({
        recipientId: update.assignedCourierId,
        title: "شحنات جديدة",
        body: `تم تعيين ${selectedRows.length} شحنة جديدة لك.`,
        url: notificationUrl,
      });
    }
  };

  const handleBulkPrint = (selectedRows: Shipment[]) => {
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات للطباعة", variant: "destructive" });
        return;
    }
    const ids = selectedRows.map(row => row.id);
    const printUrl = `/print/bulk?ids=${ids.join(',')}`;
    window.open(printUrl, '_blank', 'width=800,height=600');
  };

  const getShipmentsByStatus = (status: string | string[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return filteredShipments.filter(s => statuses.includes(s.status));
  }
  
  const listIsLoading = allShipmentsLoading || governoratesLoading || companiesLoading || usersLoading || statusesLoading || couriersDataLoading;

  const filteredCourierDues = useMemo(() => {
    if (!managementSearchTerm) return courierDues;
    return courierDues.filter(c => c.name?.toLowerCase().includes(managementSearchTerm.toLowerCase()));
  }, [courierDues, managementSearchTerm]);

  const filteredCompanyDues = useMemo(() => {
    if (!managementSearchTerm) return companyDues;
    return companyDues.filter(c => c.name?.toLowerCase().includes(managementSearchTerm.toLowerCase()));
  }, [companyDues, managementSearchTerm]);

  const handlePriceChangeDecision = async (shipment: Shipment, approved: boolean) => {
    if (!firestore || !authUser || processingShipments.has(shipment.id)) return;
    
    setProcessingShipments(prev => new Set(prev).add(shipment.id));

    let updatePayload: any = {};
    if (approved) {
        updatePayload = {
            totalAmount: shipment.requestedAmount,
            status: 'In-Transit',
            reason: `تمت الموافقة على تعديل السعر من ${shipment.totalAmount} إلى ${shipment.requestedAmount}.`,
            isPriceChangeDecision: true,
        };
    } else {
        updatePayload = {
            status: 'PriceChangeRejected',
            reason: `تم رفض طلب تعديل سعر (السعر المقترح: ${shipment.requestedAmount}).`,
            isPriceChangeDecision: true,
        };
    }

    try {
        await handleSaveShipment(updatePayload, shipment.id);

        if (shipment.assignedCourierId) {
            const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/?edit=${shipment.id}` : `/?edit=${shipment.id}`;
            const message = approved 
                ? `تمت الموافقة على طلب تعديل سعر شحنة ${shipment.recipientName}.`
                : `تم رفض طلب تعديل سعر شحنة ${shipment.recipientName}.`;
            await sendPushNotification({
                recipientId: shipment.assignedCourierId,
                title: 'تحديث بخصوص طلب تعديل السعر',
                body: message,
                url: notificationUrl,
            });
        }
    } catch (error) {
    } finally {
        setProcessingShipments(prev => {
            const newSet = new Set(prev);
            newSet.delete(shipment.id);
            return newSet;
        });
    }
};

  return (
    <div className="flex flex-col w-full px-4 sm:px-6 lg:px-8 py-4">
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="overflow-x-auto pb-2 md:pb-0">
                <TabsList className="inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground shadow-sm">
                    <TabsTrigger value="shipments" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                        <LayoutDashboard className="h-4 w-4 me-2" />
                        الشحنات
                    </TabsTrigger>
                    {role === 'admin' && (
                        <TabsTrigger value="management" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                            <UserIcon className="h-4 w-4 me-2" />
                            الإدارة المالية
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="problem-inbox" className="relative data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                        <AlertTriangle className="h-4 w-4 me-2" />
                        المشاكل
                        {problemCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0 text-[10px] border-2 border-background animate-pulse">{problemCount}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                        <Plus className="h-4 w-4 me-2" />
                        أدوات إضافية
                    </TabsTrigger>
                    <TabsTrigger value="chat" className="relative data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                        <MessageSquare className="h-4 w-4 me-2" />
                        الدردشة
                        {totalUnreadCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0 text-[10px] border-2 border-background">{totalUnreadCount}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>
            </div>
            
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx, .xls"
                />
                <Button asChild variant="outline" size="sm" className="h-10 shadow-sm border-primary/20 hover:border-primary/50 transition-all">
                    <Link href="/scan">
                        <ScanLine className="h-4 w-4 me-2" />
                        <span>مسح باركود</span>
                    </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={handleImportClick} className="h-10 shadow-sm">
                    <FileUp className="h-4 w-4 me-2" />
                    <span>استيراد</span>
                </Button>
                <Button size="sm" onClick={() => openShipmentForm()} className="h-10 shadow-md bg-primary hover:bg-primary/90 transition-all">
                    <PlusCircle className="h-4 w-4 me-2" />
                    <span>شحنة جديدة</span>
                </Button>
            </div>
        </div>

        {/* Dynamic Header Stats */}
        <StatsCards shipments={activeShipments} role={role} />

        <TabsContent value="shipments" className="mt-0 space-y-4">
            {isMobile ? 
                <MobileShipmentsView 
                    shipments={filteredShipments || []}
                    listIsLoading={listIsLoading}
                    governorates={governorates || []}
                    companies={companies || []}
                    courierUsers={courierUsers || []}
                    statuses={statuses || []}
                    onEdit={openShipmentForm}
                    onDelete={(shipment) => setShipmentToDelete(shipment)}
                    onPrint={handlePrintShipment}
                    onBulkUpdate={handleGenericBulkUpdate}
                    onBulkDelete={handleDeleteShipment}
                    onBulkPrint={handleBulkPrint}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    role={role}
                    searchTerm={searchTerm}
                /> : 
                <DesktopShipmentsView
                    listIsLoading={listIsLoading}
                    role={role}
                    filteredShipments={filteredShipments}
                    getShipmentsByStatus={getShipmentsByStatus}
                    inWarehouseShipments={inWarehouseShipments}
                    returnsWithCouriers={returnsWithCouriers}
                    returningToCompanyShipments={returningToCompanyShipments}
                    returnedToCompanyShipments={returnedToCompanyShipments}
                    recentlyUpdatedShipments={recentlyUpdatedShipments}
                    unassignedShipments={unassignedShipments}
                    assignedShipments={assignedShipments}
                    governorates={governorates || []}
                    companies={companies || []}
                    courierUsers={courierUsers || []}
                    statuses={statuses || []}
                    openShipmentForm={openShipmentForm}
                    handleGenericBulkUpdate={handleGenericBulkUpdate}
                    handleBulkDelete={handleDeleteShipment}
                    handleBulkPrint={handleBulkPrint}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                />
            }
        </TabsContent>

        <TabsContent value="management" className="mt-0">
            <Tabs defaultValue="courier-management" className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <TabsList className="bg-muted/50">
                        <TabsTrigger value="courier-management">حسابات المناديب</TabsTrigger>
                        <TabsTrigger value="company-management">حسابات الشركات</TabsTrigger>
                        <TabsTrigger value="payments-log">سجل المدفوعات بالتاريخ</TabsTrigger>
                        <TabsTrigger value="user-management">إدارة المستخدمين</TabsTrigger>
                    </TabsList>
                    <div className="relative">
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث سريع..."
                            value={managementSearchTerm}
                            onChange={(e) => setManagementSearchTerm(e.target.value)}
                            className="pr-10 w-[250px] h-9 shadow-sm"
                        />
                    </div>
                </div>

                <TabsContent value="courier-management">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredCourierDues.map(courier => (
                            <Card key={courier.id} className="flex flex-col shadow-sm border-t-2 border-t-blue-500 overflow-hidden group hover:shadow-md transition-all">
                                <CardHeader className="bg-muted/10 pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                <UserIcon className="h-4 w-4 text-primary" />
                                                {courier.name}
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                {courier.phone || 'بدون رقم هاتف'}
                                            </CardDescription>
                                        </div>
                                        <Badge variant={courier.netDue > 0 ? "destructive" : "default"} className="font-mono">
                                            {Math.abs(courier.netDue).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow pt-4">
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <div className="bg-muted/30 p-2 rounded-md text-center">
                                            <p className="text-[10px] text-muted-foreground">شحنات</p>
                                            <p className="font-bold text-sm">{courier.totalShipments}</p>
                                        </div>
                                        <div className="bg-green-50/50 p-2 rounded-md text-center">
                                            <p className="text-[10px] text-green-600">تسليم</p>
                                            <p className="font-bold text-sm text-green-700">{courier.deliveredCount}</p>
                                        </div>
                                        <div className="bg-red-50/50 p-2 rounded-md text-center">
                                            <p className="text-[10px] text-red-600">مرتجع</p>
                                            <p className="font-bold text-sm text-red-700">{courier.returnedCount}</p>
                                        </div>
                                        <div className="bg-amber-50/50 p-2 rounded-md text-center">
                                            <p className="text-[10px] text-amber-600">مؤجل</p>
                                            <p className="font-bold text-sm text-amber-700">{courier.postponedCount}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                                            <span className="text-muted-foreground flex items-center gap-1.5">
                                                <DollarSign className="h-3 w-3" /> تحصيل:
                                            </span>
                                            <span className="font-medium">{courier.totalCollected.toLocaleString('ar-EG')}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-dashed">
                                            <span className="text-muted-foreground flex items-center gap-1.5">
                                                <BadgePercent className="h-3 w-3" /> عمولات:
                                            </span>
                                            <span className="font-medium text-blue-600">{courier.totalCommission.toLocaleString('ar-EG')}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-muted-foreground flex items-center gap-1.5">
                                                <WalletCards className="h-3 w-3" /> مدفوعات:
                                            </span>
                                            <span className="font-medium text-green-600">{courier.totalPaidByCourier.toLocaleString('ar-EG')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/5 p-3 flex flex-col gap-2">
                                    <div className="flex gap-2 w-full">
                                        <Button variant="default" size="sm" className="flex-1 shadow-sm" onClick={() => openCourierPaymentForm(courier)} disabled={courier.netDue <= 0}>
                                            <HandCoins className="me-2 h-3.5 w-3.5" />
                                            تسوية
                                        </Button>
                                        <Button variant="outline" size="sm" className="px-2" onClick={() => openAdminNoteDialog(courier)}>
                                            <MessageSquarePlus className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    {courier.totalShipments > 0 && (
                                        <Button variant="ghost" size="sm" className="w-full text-[10px] text-muted-foreground hover:text-primary" onClick={() => setCourierToArchive(courier)}>
                                            <Archive className="me-1.5 h-3 w-3" />
                                            أرشفة وتسوية الحساب
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="company-management">
                     <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredCompanyDues.map(company => (
                            <Card key={company.id} className="flex flex-col shadow-sm border-t-2 border-t-indigo-500 overflow-hidden hover:shadow-md transition-all">
                                <CardHeader className="bg-muted/10 pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                                <Building className="h-4 w-4 text-indigo-600" />
                                                {company.name}
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-1">
                                                إدارة الحساب المالي
                                            </CardDescription>
                                        </div>
                                        <Badge variant={company.netDue >= 0 ? "default" : "destructive"} className="font-mono bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none">
                                            {Math.abs(company.netDue).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow pt-4">
                                    <div className="grid grid-cols-1 gap-2 mb-4">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">إجمالي الشحنات:</span>
                                            <span className="font-bold">{company.totalShipments}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">صافي التحصيل:</span>
                                            <span className="font-bold">{(company.totalRevenue - company.totalCompanyCommission).toLocaleString('ar-EG')}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 pt-2 border-t text-[11px]">
                                         <div className="flex justify-between">
                                            <span className="text-muted-foreground">الإيرادات:</span>
                                            <span className="font-medium text-green-600">{company.totalRevenue.toLocaleString('ar-EG')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">العمولة المستقطعة:</span>
                                            <span className="font-medium text-red-600">{company.totalCompanyCommission.toLocaleString('ar-EG')}</span>
                                        </div>
                                        <div className="flex justify-between font-bold pt-1 border-t border-dashed">
                                            <span>المدفوع للشركة:</span>
                                            <span className="text-indigo-600">{company.totalPaidToCompany.toLocaleString('ar-EG')}</span>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-muted/5 p-3 flex flex-col gap-2">
                                    <div className="grid grid-cols-2 gap-2 w-full">
                                        <CompanySettlementDialog
                                            company={company}
                                            allShipments={allShipmentsForStats || []}
                                            adminUser={user}
                                            statuses={statuses || []}
                                            onSettlementComplete={() => {}}
                                        >
                                            <Button variant="default" size="sm" className="w-full text-xs shadow-sm bg-indigo-600 hover:bg-indigo-700">
                                                <FileSpreadsheet className="me-1.5 h-3.5 w-3.5" />
                                                تسوية شيت
                                            </Button>
                                        </CompanySettlementDialog>
                                        <Button variant="outline" size="sm" className="w-full text-xs shadow-sm" onClick={() => openCompanyPaymentForm(company)} disabled={company.netDue <= 0}>
                                            <Banknote className="me-1.5 h-3.5 w-3.5" />
                                            يدوي
                                        </Button>
                                    </div>
                                    {company.totalShipments > 0 && (
                                        <Button variant="ghost" size="sm" className="w-full text-[10px] text-muted-foreground" onClick={() => setCompanyToArchive(company)}>
                                            <Archive className="me-1.5 h-3 w-3" />
                                            أرشفة وتصفير الحساب
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="payments-log">
                    <Card className="shadow-sm">
                        <CardHeader className="bg-muted/10">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ReceiptText className="h-5 w-5 text-primary" />
                                سجل جميع المدفوعات (آخر 200 عملية)
                            </CardTitle>
                            <CardDescription>عرض تاريخي لكل المبالغ التي تم تحصيلها أو دفعها</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">التاريخ والوقت</TableHead>
                                            <TableHead className="text-right">الكيان (مندوب/شركة)</TableHead>
                                            <TableHead className="text-right">المبلغ</TableHead>
                                            <TableHead className="text-right">النوع</TableHead>
                                            <TableHead className="text-right">ملاحظات</TableHead>
                                            <TableHead className="text-right">الإجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {combinedPaymentsLog.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">لا توجد سجلات مدفوعات حالياً</TableCell>
                                            </TableRow>
                                        ) : (
                                            combinedPaymentsLog.map((log) => (
                                                <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                                                    <TableCell className="font-medium">{formatToCairoTime(log.date)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {log.type === 'courier' ? <CourierIcon className="h-3 w-3 text-blue-500" /> : <Building className="h-3 w-3 text-indigo-500" />}
                                                            {log.entityName}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-green-700">
                                                        {log.amount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={log.type === 'courier' ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}>
                                                            {log.type === 'courier' ? 'من مندوب' : 'إلى شركة'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs max-w-[200px] truncate" title={log.notes}>
                                                        {log.notes || '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                                if (log.type === 'courier') {
                                                                    const courier = courierUsers.find(u => u.id === log.courierId);
                                                                    if (courier) openCourierPaymentForm(courier, log as CourierPayment);
                                                                } else {
                                                                    const company = companies?.find(c => c.id === log.companyId);
                                                                    if (company) openCompanyPaymentForm(company, log as CompanyPayment);
                                                                }
                                                            }}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                                                if (log.type === 'courier') setCourierPaymentToDelete(log as CourierPayment);
                                                                else setCompanyPaymentToDelete(log as CompanyPayment);
                                                            }}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="user-management">
                     <div className="bg-card rounded-lg border shadow-sm">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold">المستخدمين والشركات</h3>
                            <Button size="sm" onClick={() => openUserForm()} className="h-8">
                                <PlusCircle className="h-4 w-4 me-2" />
                                إضافة مستخدم
                            </Button>
                        </div>
                        {isMobile ? 
                            <div className="p-4 space-y-4">
                                {(users || []).map(u => (
                                    <UserCard 
                                        key={u.id} 
                                        user={u}
                                        company={companies?.find(c => c.id === u.id)}
                                        onEdit={openUserForm}
                                        onDelete={setUserToDelete}
                                    />
                                ))}
                            </div> : 
                            <UsersTable listIsLoading={usersLoading || companiesLoading} users={users || []} onEdit={openUserForm} onDelete={setUserToDelete} searchTerm={managementSearchTerm} />
                        }
                    </div>
                </TabsContent>
            </Tabs>
        </TabsContent>

        <TabsContent value="problem-inbox" className="mt-0">
            <div className="grid gap-6">
                <ProblemShipmentList title="طلبات تعديل أسعار" icon={<DollarSign className="h-5 w-5 text-yellow-500" />} shipments={priceChangeRequests} onEdit={openShipmentForm}>
                    {(s: Shipment) => {
                        const courierName = courierUsers.find(c => c.id === s.assignedCourierId)?.name;
                        const isProcessing = processingShipments.has(s.id);
                        return (
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="font-bold">{s.recipientName}</p>
                                    <Badge variant="outline" className="text-[10px] h-4">بواسطة: {courierName}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-3">
                                    <span>الحالي: <span className="font-bold">{s.totalAmount.toLocaleString('ar-EG')}</span></span>
                                    <Check className="h-3 w-3 text-muted-foreground" />
                                    <span>المطلوب: <span className="font-bold text-primary">{s.requestedAmount?.toLocaleString('ar-EG')}</span></span>
                                </div>
                                {s.amountChangeReason && <p className="text-[10px] text-amber-600 mt-1 italic">السبب: {s.amountChangeReason}</p>}
                                <div className="mt-3 flex gap-2">
                                    <Button size="sm" variant="outline" className="h-7 text-[11px] text-green-600 border-green-200 hover:bg-green-50 shadow-sm" onClick={() => handlePriceChangeDecision(s, true)} disabled={isProcessing}>
                                        {isProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <Check className="h-3 w-3 me-1" />} موافقة
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50 shadow-sm" onClick={() => handlePriceChangeDecision(s, false)} disabled={isProcessing}>
                                        {isProcessing ? <Loader2 className="h-3 w-3 animate-spin"/> : <X className="h-3 w-3 me-1" />} رفض
                                    </Button>
                                </div>
                            </div>
                        );
                    }}
                </ProblemShipmentList>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <ProblemShipmentList title="مرتجعات بحاجة لقرار" icon={<AlertTriangle className="h-5 w-5 text-orange-500" />} shipments={returnedShipmentsNeedingAction} onEdit={openShipmentForm}>
                        {(s: Shipment) => {
                             const companyName = companies?.find(c => c.id === s.companyId)?.name || "N/A";
                            return (<div>
                                <p className="font-bold text-sm">{s.recipientName}</p>
                                <p className="text-[10px] text-primary">{companyName}</p>
                            </div>)
                        }}
                    </ProblemShipmentList>

                    <ProblemShipmentList title="شحنات مؤجلة (+3 أيام)" icon={<CalendarClock className="h-5 w-5 text-destructive" />} shipments={longPostponedShipments} onEdit={openShipmentForm}>
                         {(s: Shipment) => {
                             const lastUpdate = getSafeDate(s.updatedAt);
                             const daysAgo = lastUpdate ? differenceInDays(new Date(), lastUpdate) : 0;
                            return (<div>
                                <p className="font-bold text-sm">{s.recipientName}</p>
                                <p className="text-[10px] text-amber-600 font-medium">مؤجلة منذ {daysAgo} أيام</p>
                            </div>)
                        }}
                    </ProblemShipmentList>
                </div>

                {problemCount === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-20 bg-muted/20 border-2 border-dashed rounded-xl">
                    <div className="bg-green-100 p-4 rounded-full mb-4">
                        <CheckSquare className="h-10 w-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold">كل شيء رائع!</h3>
                    <p className="text-muted-foreground mt-2">لا توجد شحنات بحاجة لتدخل إداري حالياً.</p>
                </div>
                )}
          </div>
        </TabsContent>

        <TabsContent value="tools" className="mt-0">
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[
                    { title: "مركز الطباعة", desc: "إدارة طباعة ملصقات الشحنات", icon: Printer, value: "print-center", color: "text-blue-600" },
                    { title: "الشحنات المكررة", desc: "اكتشاف ومعالجة الشحنات المكررة", icon: Copy, link: "/duplicates", color: "text-orange-600" },
                    { title: "مقارنة الشيتات", desc: "أداة ذكية لمطابقة ملفات الإكسيل", icon: GitCompareArrows, link: "/comparison", color: "text-purple-600" },
                    { title: "الإحصائيات", desc: "تقارير بيانية مفصلة عن الأداء", icon: BarChart, link: "/statistics", color: "text-green-600" },
                    { title: "كشوفات الحسابات", desc: "عرض وتصدير كشوف الحسابات", icon: FileSpreadsheet, link: "/accounts", color: "text-indigo-600" },
                    { title: "الأرشيف", desc: "استعراض البيانات السابقة", icon: Archive, link: "/archive", color: "text-gray-600" },
                    { title: "سجل التغييرات", desc: "تتبع كل تعديل تم في النظام", icon: History, value: "audit-log", color: "text-cyan-600" },
                    { title: "التقارير", desc: "توليد تقارير شاملة", icon: BarChart, value: "reports", color: "text-red-600" },
                    { title: "المصروفات", desc: "إدارة مصاريف المكتب والمناديب", icon: Banknote, link: "/expenses", color: "text-emerald-600" },
                ].map((item, idx) => (
                    <Card key={idx} className="hover:shadow-md transition-all cursor-pointer group" onClick={() => {
                        if (item.link) {
                            router.push(item.link);
                        } else if (item.value) {
                            setActiveTab(item.value);
                        }
                    }}>
                        <CardHeader className="flex flex-row items-center gap-4 pb-4">
                            <div className={`p-2 rounded-lg bg-muted group-hover:bg-background transition-colors ${item.color}`}>
                                <item.icon className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">{item.title}</CardTitle>
                                <CardDescription className="text-xs">{item.desc}</CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                ))}
            </div>
            
            <div className="mt-8">
                {activeTab === 'print-center' && (
                    <PrintCenterPage 
                        shipments={allShipmentsForStats || []}
                        isLoading={allShipmentsLoading}
                        governorates={governorates || []}
                        companies={companies || []}
                        courierUsers={courierUsers || []}
                        statuses={statuses || []}
                        onEdit={openShipmentForm}
                        role={role}
                        onGenericBulkUpdate={handleGenericBulkUpdate}
                    />
                )}
                {activeTab === 'audit-log' && (
                    <AuditLogPage 
                        users={users || []}
                        shipments={allShipmentsForStats || []}
                        companies={companies || []}
                        governorates={governorates || []}
                        statuses={statuses || []}
                        isLoading={listIsLoading}
                    />
                )}
                {activeTab === 'reports' && (
                    <ReportsPage 
                        shipments={allShipmentsForStats || []}
                        companies={companies || []}
                        couriers={courierUsers || []}
                        governorates={governorates || []}
                        companyPayments={companyPayments || []}
                        courierPayments={courierPayments || []}
                        isLoading={listIsLoading}
                    />
                )}
            </div>
        </TabsContent>

        <TabsContent value="chat" className="mt-0 border rounded-xl overflow-hidden bg-background h-[calc(100vh-16rem)] shadow-sm">
           <ChatInterface initialChatId={initialChatId}/>
        </TabsContent>
        </Tabs>

      {/* Forms and Dialogs */}
      <ShipmentFormSheet
        open={isShipmentSheetOpen}
        onOpenChange={handleSheetOpenChange}
        onSave={handleSaveShipment}
        shipment={editingShipment}
        governorates={governorates || []}
        couriers={courierUsers}
        companies={companies || []}
        statuses={statuses || []}
        role={role}
      />
      
      <UserFormSheet 
        open={isUserSheetOpen}
        onOpenChange={setIsUserSheetOpen}
        onSave={handleSaveUser}
        user={editingUser}
        companyDetails={editingCompany}
      />

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
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">تأكيد الحذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

        <AlertDialog open={!!shipmentToDelete} onOpenChange={(open) => !open && setShipmentToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من حذف الشحنة؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف الشحنة ({shipmentToDelete?.recipientName}) بشكل نهائي.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShipmentToDelete(null)}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteShipment(shipmentToDelete ? [shipmentToDelete] : [])} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

       <AlertDialog open={!!courierPaymentToDelete} onOpenChange={(open) => !open && setCourierPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف الدفعة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف سجل هذه الدفعة بشكل نهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCourierPaymentToDelete(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCourierPayment} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!companyPaymentToDelete} onOpenChange={(open) => !open && setCompanyPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف الدفعة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف سجل هذه الدفعة بشكل نهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompanyPaymentToDelete(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompanyPayment} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!courierToArchive} onOpenChange={(open) => !open && setCourierToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>أرشفة وتسوية حساب {courierToArchive?.name}؟</AlertDialogTitle>
            <AlertDialogDescription>
             سيقوم هذا الإجراء بتسجيل دفعة بالمبلغ المستحق على المندوب حالياً، ثم أرشفة جميع الشحنات المنتهية والدفعات الحالية.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCourierToArchive(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveCourierData}>نعم، أرشفة وتسوية</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!companyToArchive} onOpenChange={(open) => !open && setCompanyToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>أرشفة وتسوية حساب {companyToArchive?.name}؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيؤدي هذا الإجراء إلى أرشفة جميع الشحنات المنتهية والدفعات الحالية للشركة لإخفائها من القوائم النشطة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCompanyToArchive(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveCompanyData}>نعم، أرشفة وتسوية</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CourierPaymentFormSheet
        open={isCourierPaymentSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPayingCourier(undefined);
            setEditingCourierPayment(undefined);
          }
          setIsCourierPaymentSheetOpen(open);
        }}
        courier={payingCourier}
        payment={editingCourierPayment}
        onSave={handleSaveCourierPayment}
        netDue={currentCourierNetDue}
      />

      <CompanyPaymentFormSheet
        open={isCompanyPaymentSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPayingCompany(undefined);
            setEditingCompanyPayment(undefined);
          }
          setIsCompanyPaymentSheetOpen(open);
        }}
        company={payingCompany}
        payment={editingCompanyPayment}
        onSave={handleSaveCompanyPayment}
        netDue={currentCompanyNetDue}
      />

      <AdminNoteDialog
        open={isAdminNoteDialogOpen}
        onOpenChange={setIsAdminNoteDialogOpen}
        courier={notingCourier}
        onSend={async (message) => { // Marked as async
          if (!firestore || !notingCourier) return;
          const courierDocRef = doc(firestore, 'couriers', notingCourier.id);
          const notePayload = {
            message,
            isRead: false,
            updatedAt: serverTimestamp(),
          };
          try {
            await updateDoc(courierDocRef, { adminNote: notePayload });
            toast({ title: 'تم إرسال الملاحظة بنجاح' });
            await sendPushNotification({
              recipientId: notingCourier.id,
              title: 'رسالة جديدة من الإدارة',
              body: message.substring(0, 100),
              url: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
            });
          } catch (error) {
            console.error("Failed to send note or push notification:", error);
            toast({ title: 'فشل إرسال الملاحظة', variant: 'destructive' });
          }
        }}
      />

       {importResult && (
        <ImportProgressDialog
          result={importResult}
          onClose={() => setImportResult(null)}
          onConfirmUpdates={async (updatesToApply) => {
                if (!updatesToApply || updatesToApply.length === 0) return;
                const functions = getFunctions(app);
                const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

                toast({ title: `جاري تحديث ${updatesToApply.length} شحنة...` });

                const updatePromises = updatesToApply.map(updateData => {
                    const payload = { shipmentId: updateData.existing.id, ...updateData.new };
                    return handleShipmentUpdateFn(payload).catch(err => ({ error: true, data: payload }));
                });
                
                await Promise.all(updatePromises);
                toast({ title: "اكتملت عملية التحديث."});
                setImportResult(null);
            }}
        />
      )}
    </div>
  );
}

// Sub-components as defined in the original file but reused here
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
    const unprintedShipments = useMemo(() => shipments.filter(s => !s.isLabelPrinted), [shipments]);
    const printedShipments = useMemo(() => shipments.filter(s => s.isLabelPrinted), [shipments]);
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
        <TabsList className="mb-4">
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
