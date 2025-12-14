
"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PlusCircle, FileUp, Database, User as UserIcon, Building, BadgePercent, DollarSign, Truck as CourierIcon, CalendarClock, MessageSquare, HandCoins, History, Pencil, Trash2, WalletCards, Archive, Banknote, Package, FileText, Loader2, Printer, ChevronDown, Bot, CheckSquare, ListChecks, AlertTriangle, ArchiveRestore, Warehouse, RefreshCw, FileSpreadsheet, Settings, Search, Check, X, ScanLine, Replace, BellRing } from "lucide-react";
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
import { ImportResult, ImportProgressDialog } from "@/components/shipments/import-progress-dialog";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, updateDoc, getDoc, setDoc, deleteDoc, increment } from "firebase/firestore";
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
import { createAuthUser, deleteAuthUser, updateAuthUserPassword, sendPushNotification } from "@/lib/actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShipmentCard } from "../shipments/shipment-card";
import { ColumnFiltersState } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { getColumns as getShipmentColumns } from './shipments-table';
import { differenceInDays, differenceInHours } from "date-fns";
import { ReportsPage } from "@/components/reports/reports-page";
import { AuditLogPage } from "../audit-log/audit-log-page";
import Link from "next/link";
import { exportToExcel } from "@/lib/export";
import { ShipmentFilters } from './shipment-filters';


const MobileShipmentsView = ({
    archivedShipmentsCompany,
    archivedShipmentsCourier,
    inWarehouseShipments,
    returnsWithCouriers,
    returnedToCompanyShipments,
    filteredShipments,
    recentlyUpdatedShipments,
    unassignedShipments,
    assignedShipments,
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
  }: {
    archivedShipmentsCompany: Shipment[];
    archivedShipmentsCourier: Shipment[];
    inWarehouseShipments: Shipment[];
    returnsWithCouriers: Shipment[];
    returnedToCompanyShipments: Shipment[];
    filteredShipments: Shipment[];
    recentlyUpdatedShipments: Shipment[];
    unassignedShipments: Shipment[];
    assignedShipments: Shipment[];
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
  }) => {

    const [activeTab, setActiveTab] = React.useState("all-shipments");
    const [mobileRowSelection, setMobileRowSelection] = React.useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const selectedCount = Object.values(mobileRowSelection).filter(Boolean).length;
    
    const getShipmentsByStatus = (status: string | string[]) => {
        const statuses = Array.isArray(status) ? status : [status];
        return filteredShipments.filter(s => statuses.includes(s.status));
    }

    const getCurrentShipmentList = () => {
      switch (activeTab) {
        case "recently-updated": return recentlyUpdatedShipments;
        case "unassigned": return unassignedShipments;
        case "assigned": return assignedShipments;
        case "delivered": return getShipmentsByStatus(['Delivered']);
        case "postponed": return getShipmentsByStatus('Postponed');
        case "returns-with-couriers": return returnsWithCouriers;
        case "returns-in-warehouse": return inWarehouseShipments;
        case "returned-to-company": return returnedToCompanyShipments;
        case "archived-company": return archivedShipmentsCompany;
        case "archived-courier": return archivedShipmentsCourier;
        case "all-shipments":
        default: return filteredShipments;
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
        // This is a placeholder or needs to be passed down if specific logic is needed
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
        if (areAllSelected) { // If all are selected, unselect all
            setMobileRowSelection({});
        } else { // Otherwise, select all in current list
            currentList.forEach(s => {
                newSelection[s.id] = true;
            });
            setMobileRowSelection(newSelection);
        }
    };

    React.useEffect(() => {
        // Reset selection when tab changes
        setMobileRowSelection({});
    }, [activeTab]);


    const renderShipmentList = (shipmentList: Shipment[]) => {
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
          <div className="space-y-3 mt-4">
            {shipmentList.map(shipment => (
              <ShipmentCard 
                key={shipment.id}
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
            ))}
          </div>
        );
      }
      return (
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col gap-4 mt-4">
                <TabsList className="grid grid-cols-4 h-auto">
                    <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                    <TabsTrigger value="unassigned">غير معينة</TabsTrigger>
                    <TabsTrigger value="assigned">معينة</TabsTrigger>
                    <TabsTrigger value="recently-updated">
                        <RefreshCw className="h-4 w-4 me-1" />
                        المُحدَّثة
                    </TabsTrigger>
                    <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
                    <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
                    <TabsTrigger value="returns-with-couriers">مرتجعات بالخارج</TabsTrigger>
                    <TabsTrigger value="returns-in-warehouse">مرتجعات بالمخزن</TabsTrigger>
                    <TabsTrigger value="returned-to-company">وصلت للشركة</TabsTrigger>
                    <TabsTrigger value="archived-company">مؤرشف الشركات</TabsTrigger>
                    <TabsTrigger value="archived-courier">مؤرشف المناديب</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-4">
                    <ShipmentFilters governorates={governorates || []} companies={companies || []} courierUsers={courierUsers} statuses={statuses} onFiltersChange={setColumnFilters} />
                    {currentList.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-8 gap-1">
                            <ListChecks className="h-3.5 w-3.5" />
                            <span>{areAllSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
                        </Button>
                    )}
                </div>
            </div>
            <TabsContent value="all-shipments">{renderShipmentList(filteredShipments)}</TabsContent>
            <TabsContent value="unassigned">{renderShipmentList(unassignedShipments)}</TabsContent>
            <TabsContent value="assigned">{renderShipmentList(assignedShipments)}</TabsContent>
            <TabsContent value="recently-updated">{renderShipmentList(recentlyUpdatedShipments)}</TabsContent>
            <TabsContent value="delivered">{renderShipmentList(getShipmentsByStatus(['Delivered']))}</TabsContent>
            <TabsContent value="postponed">{renderShipmentList(getShipmentsByStatus('Postponed'))}</TabsContent>
            <TabsContent value="returns-with-couriers">{renderShipmentList(returnsWithCouriers)}</TabsContent>
            <TabsContent value="returns-in-warehouse">{renderShipmentList(inWarehouseShipments)}</TabsContent>
            <TabsContent value="returned-to-company">{renderShipmentList(returnedToCompanyShipments)}</TabsContent>
            <TabsContent value="archived-company">{renderShipmentList(archivedShipmentsCompany)}</TabsContent>
            <TabsContent value="archived-courier">{renderShipmentList(archivedShipmentsCourier)}</TabsContent>
            {selectedCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 shadow-lg flex items-center justify-around flex-wrap gap-2 z-40">
                     <span className="text-sm font-medium">{selectedCount} شحنات محددة</span>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm">
                                <CheckSquare className="me-2 h-4 w-4" />
                                <span>تغيير الحالة</span>
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {statuses.filter(s => s.enabled).map((status) => (
                                 <DropdownMenuItem key={status.id} onSelect={() => handleMobileBulkUpdate({ status: status.id })}>
                                     {status.label}
                                 </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ retryAttempt: true })}>
                        <BellRing className="me-2 h-4 w-4" />
                        <span>إعادة محاولة</span>
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm">
                                <CourierIcon className="me-2 h-4 w-4" />
                                <span>تعيين مندوب</span>
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {courierUsers.map((courier) => (
                                 <DropdownMenuItem key={courier.id} onSelect={() => handleMobileBulkUpdate({ assignedCourierId: courier.id })}>
                                     {courier.name}
                                 </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm">
                                <Building className="me-2 h-4 w-4" />
                                <span>تعيين شركة</span>
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {companies.map((company) => (
                                 <DropdownMenuItem key={company.id} onSelect={() => handleMobileBulkUpdate({ companyId: company.id })}>
                                     {company.name}
                                 </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" onClick={handleMobileBulkPrint}>
                        <Printer className="me-2 h-4 w-4" />
                        <span>طباعة</span>
                    </Button>
                    {activeTab === 'returns-with-couriers' && (
                        <>
                           <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ isWarehouseReturn: true })}>
                                <Warehouse className="me-2 h-4 w-4" />
                                للمخزن
                            </Button>
                             <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ isReturnedToCompany: true })}>
                                <Building className="me-2 h-4 w-4" />
                                للشركة
                            </Button>
                        </>
                    )}
                    {activeTab === 'returns-in-warehouse' && (
                         <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ isReturnedToCompany: true })}>
                            <Building className="me-2 h-4 w-4" />
                            تم الرجوع للشركة
                        </Button>
                    )}
                     {activeTab === 'returned-to-company' && (
                        <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ isArchivedForCompany: true })}>
                            <Archive className="me-2 h-4 w-4" />
                            أرشفة
                        </Button>
                    )}
                     {(activeTab === 'archived-company') && (
                        <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ isArchivedForCompany: false })}>
                            <ArchiveRestore className="me-2 h-4 w-4" />
                            إلغاء أرشفة الشركة
                        </Button>
                    )}
                    {(activeTab === 'archived-courier') && (
                        <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ isArchivedForCourier: false })}>
                            <ArchiveRestore className="me-2 h-4 w-4" />
                            إلغاء أرشفة المندوب
                        </Button>
                    )}
                    <Button variant="destructive" size="icon" onClick={handleMobileBulkDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </Tabs>
      )
  }

const DesktopShipmentsView = ({
    listIsLoading,
    role,
    filteredShipments,
    getShipmentsByStatus,
    archivedShipmentsCompany,
    archivedShipmentsCourier,
    inWarehouseShipments,
    returnsWithCouriers,
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
    archivedShipmentsCompany: Shipment[];
    archivedShipmentsCourier: Shipment[];
    inWarehouseShipments: Shipment[];
    returnsWithCouriers: Shipment[];
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
    const renderShipmentTable = (shipmentList: Shipment[], activeTab: 'none' | 'company' | 'courier' | 'returns-with-couriers' | 'returns-in-warehouse' | 'returned-to-company' = 'none') => (
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
        <Tabs defaultValue="all-shipments">
            <TabsList className="flex-nowrap overflow-x-auto justify-start mt-4">
                <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                <TabsTrigger value="unassigned">غير معينة</TabsTrigger>
                <TabsTrigger value="assigned">معينة</TabsTrigger>
                <TabsTrigger value="recently-updated">
                    <RefreshCw className="h-4 w-4 me-1" />
                    المُحدَّثة مؤخراً
                </TabsTrigger>
                <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
                <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
                <TabsTrigger value="returns-with-couriers">مرتجعات لدى المناديب</TabsTrigger>
                <TabsTrigger value="returns-in-warehouse">مرتجعات وصلت المخزن</TabsTrigger>
                <TabsTrigger value="returned-to-company">وصلت للشركة</TabsTrigger>
                <TabsTrigger value="archived-company">مؤرشفة الشركات</TabsTrigger>
                <TabsTrigger value="archived-courier">مؤرشفة المناديب</TabsTrigger>
            </TabsList>
            <TabsContent value="all-shipments">{renderShipmentTable(filteredShipments)}</TabsContent>
            <TabsContent value="unassigned">{renderShipmentTable(unassignedShipments)}</TabsContent>
            <TabsContent value="assigned">{renderShipmentTable(assignedShipments)}</TabsContent>
            <TabsContent value="recently-updated">{renderShipmentTable(recentlyUpdatedShipments)}</TabsContent>
            <TabsContent value="delivered">{renderShipmentTable(getShipmentsByStatus(['Delivered']))}</TabsContent>
            <TabsContent value="postponed">{renderShipmentTable(getShipmentsByStatus('Postponed'))}</TabsContent>
            <TabsContent value="returns-with-couriers">{renderShipmentTable(returnsWithCouriers, 'returns-with-couriers')}</TabsContent>
            <TabsContent value="returns-in-warehouse">{renderShipmentTable(inWarehouseShipments, 'returns-in-warehouse')}</TabsContent>
            <TabsContent value="returned-to-company">{renderShipmentTable(returnedToCompanyShipments, 'returned-to-company')}</TabsContent>
            <TabsContent value="archived-company">{renderShipmentTable(archivedShipmentsCompany, 'company')}</TabsContent>
            <TabsContent value="archived-courier">{renderShipmentTable(archivedShipmentsCourier, 'courier')}</TabsContent>
        </Tabs>
    )
  }

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
      // Step 1: Update Firestore
      await onGenericBulkUpdate(selectedRows, { isLabelPrinted: true });
  
      // Step 2: Open print window
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


interface AdminDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}
export default function AdminDashboard({ user, role, searchTerm }: AdminDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [isUserSheetOpen, setIsUserSheetOpen] = React.useState(false);
  const [isCourierPaymentSheetOpen, setIsCourierPaymentSheetOpen] = React.useState(false);
  const [isCompanyPaymentSheetOpen, setIsCompanyPaymentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [editingUser, setEditingUser] = React.useState<User | undefined>(undefined);
  const [editingCompany, setEditingCompany] = React.useState<Company | undefined>(undefined);
  
  const [payingCourier, setPayingCourier] = React.useState<User | undefined>(undefined);
  const [editingCourierPayment, setEditingCourierPayment] = React.useState<CourierPayment | undefined>(undefined);
  
  const [payingCompany, setPayingCompany] = React.useState<Company | undefined>(undefined);
  const [editingCompanyPayment, setEditingCompanyPayment] = React.useState<CompanyPayment | undefined>(undefined);

  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [shipmentToDelete, setShipmentToDelete] = React.useState<Shipment | null>(null);
  const [courierPaymentToDelete, setCourierPaymentToDelete] = React.useState<CourierPayment | null>(null);
  const [companyPaymentToDelete, setCompanyPaymentToDelete] = React.useState<CompanyPayment | null>(null);
  
  const [courierToArchive, setCourierToArchive] = React.useState<User | null>(null);
  const [companyToArchive, setCompanyToArchive] = React.useState<Company | null>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  // State for search terms in management tabs
  const [managementSearchTerm, setManagementSearchTerm] = React.useState('');

  // We use useUser here to get the auth user (with .uid) for the import logic.
  const { user: authUser } = useUser();

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

  const courierPaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courier_payments'));
  }, [firestore, user]);
  const { data: courierPayments } = useCollection<CourierPayment>(courierPaymentsQuery);

  const companyPaymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'company_payments'));
  }, [firestore, user]);
  const { data: companyPayments } = useCollection<CompanyPayment>(companyPaymentsQuery);
  
  const statusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'shipment_statuses'));
  }, [firestore]);
  const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);

  const courierUsers = React.useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);
  
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
  
  const openCompanyPaymentForm = (company: Company, payment?: CompanyPayment) => {
    setPayingCompany(company);
    setEditingCompanyPayment(payment);
    setIsCompanyPaymentSheetOpen(true);
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
    if (!file || !firestore || !authUser || !companies || !governorates) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = read(data, { type: 'binary', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = utils.sheet_to_json<any>(worksheet);

            const result: ImportResult = {
                added: 0,
                updated: 0,
                rejected: 0,
                total: json.length,
                errors: [],
                processing: true
            };
            setImportResult(result);

            const validRows: any[] = [];
            const rejectedRows: any[] = [];
            
            // --- 1. Validation Phase ---
            for (const row of json) {
                let errorReason = "";
                const recipientName = String(row['المرسل اليه'] || '').trim();
                let recipientPhone = String(row['التليفون']?.toString() || '').trim();
                const governorateName = String(row['المحافظة'] || '').trim();

                // Format phone number
                if (recipientPhone.length === 10 && recipientPhone.startsWith("1")) {
                    recipientPhone = "0" + recipientPhone;
                    row['التليفون'] = recipientPhone; // Update row data for consistency
                }

                if (!recipientName) errorReason = "اسم المرسل إليه مفقود";
                else if (!recipientPhone) errorReason = "رقم الهاتف مفقود";
                else if (!governorateName) errorReason = "المحافظة مفقودة";
                else if (governorates.find(g => g.name === governorateName) === undefined) errorReason = `المحافظة "${governorateName}" غير موجودة في النظام`;
                
                if (errorReason) {
                    rejectedRows.push({ ...row, 'سبب الرفض': errorReason });
                } else {
                    validRows.push(row);
                }
            }
            
            result.rejected = rejectedRows.length;
            result.errors = rejectedRows;
            setImportResult({ ...result });

            // --- 2. Processing Phase ---
            const batch = writeBatch(firestore);
            const shipmentsCollection = collection(firestore, 'shipments');

            for (const row of validRows) {
                const orderNumberValue = row['رقم الطلب']?.toString().trim();
                const recipientNameValue = String(row['المرسل اليه'] || '').trim();
                const recipientPhoneValue = String(row['التليفون']?.toString() || '').trim();
                
                let querySnapshot;
                
                const companyNameFromSheet = row['الشركة']?.toString().trim() || row['العميل']?.toString().trim();
                const foundCompany = companies.find(c => c.name === companyNameFromSheet);
                const companyIdForQuery = foundCompany ? foundCompany.id : authUser.uid;

                // Priority 1: Find by Order Number (if it exists)
                if (orderNumberValue) {
                    const q = query(shipmentsCollection, where("orderNumber", "==", orderNumberValue), where("companyId", "==", companyIdForQuery));
                    querySnapshot = await getDocs(q);
                }

                // Priority 2: Find by Recipient Name + Phone (if order number not found or doesn't exist)
                if ((!querySnapshot || querySnapshot.empty) && recipientNameValue && recipientPhoneValue) {
                    const q = query(shipmentsCollection, 
                        where("recipientName", "==", recipientNameValue),
                        where("recipientPhone", "==", recipientPhoneValue),
                        where("companyId", "==", companyIdForQuery)
                    );
                     querySnapshot = await getDocs(q);
                }
                
                const deliveryDate = parseExcelDate(row['تاريخ التسليم للمندوب']);
                const creationDate = parseExcelDate(row['التاريخ']);
                const totalAmountValue = row['الاجمالي'] || row['الاجمالى'] || '0';
                const senderNameValue = row['الراسل'] || row['العميل الفرعى'];
                
                // Prioritize 'كود الشحنة', then 'رقم الشحنه'
                const codeFromSheet = row['كود الشحنة'] || row['رقم الشحنه'];
                let shipmentCodeValue = codeFromSheet ? String(codeFromSheet).trim() : null;

                if (!shipmentCodeValue) {
                    const date = new Date();
                    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
                    const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
                    shipmentCodeValue = `SK-${dateString}-${randomNum}`;
                }

                const shipmentData: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>> = {
                    shipmentCode: shipmentCodeValue,
                    senderName: senderNameValue,
                    orderNumber: orderNumberValue,
                    recipientName: recipientNameValue,
                    recipientPhone: recipientPhoneValue,
                    governorateId: governorates?.find(g => g.name === row['المحافظة'])?.id || '',
                    address: String(row['العنوان'] || 'N/A').trim(),
                    totalAmount: parseFloat(String(totalAmountValue).replace(/[^0-9.]/g, '')),
                    status: 'Pending',
                    reason: String(row['السبب'] || ''),
                    deliveryDate: deliveryDate || new Date(),
                    isArchivedForCompany: false,
                    isArchivedForCourier: false,
                    companyId: companyIdForQuery,
                };
                const cleanShipmentData = Object.fromEntries(Object.entries(shipmentData).filter(([_, v]) => v !== undefined && v !== null && v !== ''));

                if (!querySnapshot || querySnapshot.empty) {
                    const docRef = doc(shipmentsCollection);
                    batch.set(docRef, { ...cleanShipmentData, id: docRef.id, createdAt: creationDate || serverTimestamp(), updatedAt: serverTimestamp() });
                    result.added++;
                } else {
                    const existingDoc = querySnapshot.docs[0];
                    const existingShipment = existingDoc.data() as Shipment;

                    let updateData: Partial<Shipment> = { ...cleanShipmentData, updatedAt: serverTimestamp() };
                    
                    // Smart Update: If shipment is already assigned, don't change its status or courier
                    if (existingShipment.assignedCourierId) {
                      delete updateData.status;
                      delete updateData.assignedCourierId;
                    }

                    batch.update(existingDoc.ref, updateData);
                    result.updated++;
                }
                setImportResult({ ...result });
            }

            await batch.commit().catch(serverError => {
              if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
                  errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'shipments', operation: 'write', requestResourceData: {note: "Batch import operation failed"} }));
              }
            });

            setImportResult(prev => prev ? { ...prev, processing: false } : null);

        } catch (error: any) {
            console.error("Error importing file:", error);
            setImportResult(prev => prev ? { ...prev, processing: false, finalError: "حدث خطأ أثناء معالجة الملف. يرجى التحقق من تنسيق الملف." } : null);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsBinaryString(file);
};


  const handleSaveShipment = async (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !authUser) {
      toast({ title: "خطأ في المصادقة", variant: "destructive" });
      return;
    }
  
    const batch = writeBatch(firestore);
    const shipmentRef = id ? doc(firestore, "shipments", id) : doc(collection(firestore, "shipments"));
    let oldStatus: string | undefined;
  
    if (id) {
      const docSnap = await getDoc(shipmentRef);
      if (docSnap.exists()) oldStatus = docSnap.data().status;
      batch.update(shipmentRef, { ...data, updatedAt: serverTimestamp() });
    } else {
      batch.set(shipmentRef, { ...data, id: shipmentRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  
    const newStatus = data.status;
    if (newStatus && newStatus !== oldStatus) {
      const historyRef = doc(collection(shipmentRef, 'history'));
      const historyEntry: Omit<ShipmentHistory, 'id'> = {
        status: newStatus,
        reason: data.reason || 'تحديث من لوحة التحكم',
        updatedAt: serverTimestamp(),
        updatedBy: authUser.displayName || authUser.email || 'Admin',
        userId: authUser.uid,
      };
      batch.set(historyRef, historyEntry);
    }
  
    try {
      await batch.commit();
      toast({
        title: id ? "تم تحديث الشحنة" : "تم حفظ الشحنة",
        description: "تمت العملية بنجاح",
      });
      handleSheetOpenChange(false);
      if (data.assignedCourierId && (!editingShipment || data.assignedCourierId !== editingShipment.assignedCourierId)) {
        const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/?edit=${id || shipmentRef.id}` : `/?edit=${id || shipmentRef.id}`;
        sendPushNotification({
          recipientId: data.assignedCourierId,
          title: 'شحنة جديدة',
          body: `تم تعيين شحنة جديدة لك: ${data.recipientName}`,
          url: notificationUrl,
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Error saving shipment:", error);
      toast({
        title: "فشل تحديث الشحنة",
        description: "حدث خطأ غير متوقع.",
        variant: "destructive",
      });
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
            setShipmentToDelete(null); // Assuming single deletion state, might need adjustment for bulk
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

    if (userId) { // --- UPDATE LOGIC ---
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
            phone: data.phone,
            createdAt: serverTimestamp(),
        };

        if (data.role === 'company') {
            const companyRef = doc(firestore, 'companies', newUid);
            batch.set(companyRef, { id: newUid, name: data.name, governorateCommissions: data.governorateCommissions || {} });
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

    // 1. Delete from Auth
    const authResult = await deleteAuthUser({ uid: userToDelete.id });
    if (!authResult.success) {
      toast({ variant: "destructive", title: "فشل حذف المستخدم من نظام المصادقة", description: `حدث خطأ: ${authResult.error}` });
      setUserToDelete(null);
      return;
    }

    // 2. Delete from Firestore (users, roles_*, and couriers/companies)
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
          if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: paymentDocRef.path,
                operation: 'update',
                requestResourceData: dataToUpdate,
            });
            errorEmitter.emit('permission-error', permissionError);
          }
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
    
    if (paymentId) { // Update existing payment
      const paymentDocRef = doc(firestore, 'company_payments', paymentId);
      const dataToUpdate = { ...paymentData, updatedAt: serverTimestamp() };
      updateDoc(paymentDocRef, dataToUpdate)
        .catch(serverError => {
          if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: paymentDocRef.path, operation: 'update', requestResourceData: dataToUpdate });
            errorEmitter.emit('permission-error', permissionError);
          }
        });

    } else { // Create new payment
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

      // Step 1: Create a settlement payment record if there's an amount due
      if (netDue > 0) {
          const paymentsCollection = collection(firestore, 'courier_payments');
          const paymentDocRef = doc(paymentsCollection);
          const newPayment: CourierPayment = {
              id: paymentDocRef.id,
              courierId: courierToArchive.id,
              amount: netDue,
              paymentDate: serverTimestamp(),
              recordedById: user.id,
              notes: "تسوية وحفظ تلقائي للحساب",
              isArchived: true, // Archive this settlement payment immediately
          };
          batch.set(paymentDocRef, newPayment);
      }

      // Step 2: Archive all currently active payments for this courier.
      const activePayments = courierPayments?.filter(p => p.courierId === courierToArchive.id && !p.isArchived) || [];
      activePayments.forEach(payment => {
          const paymentRef = doc(firestore, 'courier_payments', payment.id);
          batch.update(paymentRef, { isArchived: true });
      });

      // Step 3: Archive finished shipments for this courier
      const finishedStatuses = statuses.filter(s => s.requiresFullCollection || s.requiresPartialCollection || s.affectsCourierBalance).map(s => s.id);
      const courierShipmentsToArchive = shipments?.filter(s => s.assignedCourierId === courierToArchive.id && !s.isArchivedForCourier && finishedStatuses.includes(s.status)) || [];
      courierShipmentsToArchive.forEach(shipment => {
          const shipmentRef = doc(firestore, 'shipments', shipment.id);
          batch.update(shipmentRef, { isArchivedForCourier: true });
      });

      // Commit all changes
      await batch.commit()
          .then(() => {
              toast({ title: "اكتملت التسوية بنجاح!", description: `تمت تسوية حساب ${courierToArchive.name} وأرشفة الشحنات والدفعات.` });
          })
          .catch(serverError => {
              if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({ path: `batch_archive_settle`, operation: 'write', requestResourceData: { note: `Batch archive/settle for courier ${courierToArchive.id} failed.` }});
                errorEmitter.emit('permission-error', permissionError);
              }
          })
          .finally(() => setCourierToArchive(null));
  };
  
  const handleArchiveCompanyData = async () => {
    if (!firestore || !companyToArchive || !user || !statuses) return;
    toast({ title: `جاري أرشفة وتسوية حساب ${companyToArchive.name}...` });
    
    const companyDueData = companyDues.find(d => d.id === companyToArchive.id);
    if (!companyDueData) {
        toast({ title: "خطأ", description: "لم يتم العثور على البيانات المالية للشركة.", variant: "destructive" });
        setCompanyToArchive(null);
        return;
    }
  
    const netDue = companyDueData.netDue;
    const batch = writeBatch(firestore);
  
    // Step 1: Create a settlement payment if there's a positive balance (owed TO the company)
    if (netDue > 0) {
      const paymentsCollection = collection(firestore, 'company_payments');
      const paymentDocRef = doc(paymentsCollection);
      const newPayment: CompanyPayment = {
        id: paymentDocRef.id,
        companyId: companyToArchive.id,
        amount: netDue,
        paymentDate: serverTimestamp(),
        recordedById: user.id,
        notes: "تسوية وحفظ تلقائي للحساب",
        isArchived: true, // Archive this settlement payment immediately
      };
      batch.set(paymentDocRef, newPayment);
    }
  
    // Step 2: Archive all currently active payments for this company.
    const activePayments = companyPayments?.filter(p => p.companyId === companyToArchive.id && !p.isArchived) || [];
    activePayments.forEach(payment => {
      const paymentRef = doc(firestore, 'company_payments', payment.id);
      batch.update(paymentRef, { isArchived: true });
    });
  
    // Step 3: Archive finished shipments for this company
    const finishedStatuses = statuses.filter(s => s.requiresFullCollection || s.requiresPartialCollection || s.affectsCourierBalance).map(s => s.id);
    const companyShipmentsToArchive = shipments?.filter(s => s.companyId === companyToArchive.id && !s.isArchivedForCompany && finishedStatuses.includes(s.status)) || [];
    companyShipmentsToArchive.forEach(shipment => {
      const shipmentRef = doc(firestore, 'shipments', shipment.id);
      batch.update(shipmentRef, { isArchivedForCompany: true });
    });
  
    // Commit all changes
    await batch.commit()
      .then(() => {
        toast({ title: "اكتملت التسوية والأرشفة بنجاح!", description: `تمت تسوية حساب ${companyToArchive.name} وأرشفة جميع الشحنات والدفعات المنتهية.` });
      })
      .catch(serverError => {
        if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({ path: `batch_archive_settle`, operation: 'write', requestResourceData: { note: `Batch archive/settle for company ${companyToArchive.id} failed.` } });
          errorEmitter.emit('permission-error', permissionError);
        }
      })
      .finally(() => setCompanyToArchive(null));
  };


  const filteredShipments = React.useMemo(() => {
    let baseShipments = shipments || [];

    // Apply column filters
    if (columnFilters.length > 0) {
        baseShipments = baseShipments.filter(shipment => {
            return columnFilters.every(filter => {
                const value = (shipment as any)[filter.id];
                if (filter.id === 'isAssigned') {
                    const filterValue = filter.value;
                    if (filterValue === 'assigned') return !!shipment.assignedCourierId;
                    if (filterValue === 'unassigned') return !shipment.assignedCourierId;
                    return true;
                }
                if (!value && filter.id !== 'status') return false;
                const filterValue = filter.value as string[];
                if (Array.isArray(filterValue) && filterValue.length > 0) {
                  return filterValue.includes(value);
                }
                return true;
            });
        });
    }

    if (!searchTerm) return baseShipments;
    
    const lowercasedTerm = searchTerm.toLowerCase();
    return baseShipments.filter(shipment => 
        String(shipment.shipmentCode || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.orderNumber || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.recipientName || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.recipientPhone || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [shipments, searchTerm, columnFilters]);
  
  const unassignedShipments = React.useMemo(() => filteredShipments.filter(s => !s.assignedCourierId), [filteredShipments]);
  const assignedShipments = React.useMemo(() => filteredShipments.filter(s => !!s.assignedCourierId), [filteredShipments]);

    const archivedShipmentsCompany = React.useMemo(() => {
        const archived = shipments?.filter(s => s.isArchivedForCompany) || [];
        if (!searchTerm) return archived;
        const lowercasedTerm = searchTerm.toLowerCase();
        return archived.filter(shipment =>
            String(shipment.shipmentCode || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.orderNumber || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.recipientName || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.recipientPhone || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
        );
    }, [shipments, searchTerm]);

    const archivedShipmentsCourier = React.useMemo(() => {
        const archived = shipments?.filter(s => s.isArchivedForCourier) || [];
        if (!searchTerm) return archived;
        const lowercasedTerm = searchTerm.toLowerCase();
        return archived.filter(shipment =>
            String(shipment.shipmentCode || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.orderNumber || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.recipientName || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.recipientPhone || '').toLowerCase().includes(lowercasedTerm) ||
            String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
        );
    }, [shipments, searchTerm]);

  const recentlyUpdatedShipments = React.useMemo(() => {
    const activeShipments = shipments?.filter(shipment => !shipment.isArchivedForCompany && !shipment.isArchivedForCourier) || [];
    return activeShipments.sort((a, b) => {
        const timeA = a.updatedAt?.toDate?.()?.getTime() || 0;
        const timeB = b.updatedAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
    }).slice(0, 50); // Get the last 50 updated shipments
}, [shipments]);


const returnedShipmentStatuses = React.useMemo(() => statuses?.filter(s => s.isReturnedStatus).map(s => s.id) || [], [statuses]);

const returnsWithCouriers = React.useMemo(() => {
    return shipments?.filter(s => returnedShipmentStatuses.includes(s.status) && !s.isWarehouseReturn && !s.isReturnedToCompany && !s.isArchivedForCourier) || [];
}, [shipments, returnedShipmentStatuses]);

const inWarehouseShipments = React.useMemo(() => {
    return shipments?.filter(s => s.isWarehouseReturn && !s.isReturnedToCompany && !s.isArchivedForCompany) || [];
}, [shipments]);

const returnedToCompanyShipments = React.useMemo(() => {
    return shipments?.filter(s => s.isReturnedToCompany && !s.isArchivedForCompany) || [];
}, [shipments]);


  const courierDues = React.useMemo(() => {
    if (!users || !shipments || !courierPayments || !statuses) return [];

    return courierUsers.map(courier => {
        const activeShipments = shipments?.filter(s => s.assignedCourierId === courier.id && !s.isArchivedForCourier) || [];
        const activePayments = courierPayments?.filter(p => p.courierId === courier.id && !p.isArchived) || [];
        
        const totalCollected = activeShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCommission = activeShipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
        const totalPaidByCourier = activePayments.reduce((acc, p) => acc + p.amount, 0);

        const netDue = (totalCollected - totalCommission) - totalPaidByCourier;
        
        const allPaymentsForCourier = courierPayments?.filter(p => p.courierId === courier.id) || [];
        
        const returnedStatuses = statuses?.filter(s => s.affectsCourierBalance && !s.requiresFullCollection).map(s => s.id) || [];
        
        return {
            ...courier,
            totalShipments: activeShipments.length,
            deliveredCount: activeShipments.filter(s => statuses?.find(st => st.id === s.status)?.requiresFullCollection).length,
            returnedCount: activeShipments.filter(s => returnedStatuses.includes(s.status)).length,
            totalCollected,
            totalCommission,
            totalPaidByCourier,
            netDue,
            paymentHistory: allPaymentsForCourier.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0)),
        }
    })
  }, [users, shipments, courierUsers, courierPayments, statuses]);
  
  const companyDues = React.useMemo(() => {
    if (!companies || !shipments || !companyPayments) return [];
    
    return companies.map(company => {
        const activeShipments = shipments?.filter(s => s.companyId === company.id && !s.isArchivedForCompany) || [];
        const activePayments = companyPayments?.filter(p => p.companyId === company.id && !p.isArchived) || [];
        
        const totalRevenue = activeShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCompanyCommission = activeShipments.reduce((acc, s) => acc + (s.companyCommission || 0), 0);
        const totalPaidToCompany = activePayments.reduce((acc, p) => acc + p.amount, 0);
        
        const netDue = totalRevenue - totalCompanyCommission - totalPaidToCompany;
        
        const allPaymentsForCompany = companyPayments?.filter(p => p.companyId === company.id) || [];

        return {
            ...company,
            totalShipments: activeShipments.length,
            totalRevenue,
            totalCompanyCommission,
            totalPaidToCompany,
            netDue,
            paymentHistory: allPaymentsForCompany.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0)),
        }
    })
  }, [companies, shipments, companyPayments]);

  const shownNotificationsRef = React.useRef<Set<string>>(new Set());

  const returnedShipmentsNeedingAction = React.useMemo(() => shipments?.filter(s => s.status === 'Returned' && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [shipments]);
  const longPostponedShipments = React.useMemo(() => shipments?.filter(s => s.status === 'Postponed' && s.updatedAt && differenceInDays(new Date(), s.updatedAt.toDate()) > 3 && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [shipments]);
  const staleInTransitShipments = React.useMemo(() => shipments?.filter(s => s.status === 'In-Transit' && s.updatedAt && differenceInHours(new Date(), s.updatedAt.toDate()) > 24 && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [shipments]);
  const priceChangeRequests = React.useMemo(() => shipments?.filter(s => s.status === 'PriceChangeRequested' && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [shipments]);
  
  const problemCount = returnedShipmentsNeedingAction.length + longPostponedShipments.length + staleInTransitShipments.length + priceChangeRequests.length;


  React.useEffect(() => {
    if (usersLoading || shipmentsLoading || companiesLoading) return;
  
    // Check for high courier dues
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

    // Check for overloaded couriers
    courierUsers.forEach(courier => {
        const activeShipmentCount = shipments?.filter(s => s.assignedCourierId === courier.id && !s.isArchivedForCourier).length || 0;
        const notificationId = `overload_${courier.id}`;
        if (activeShipmentCount > 20 && !shownNotificationsRef.current.has(notificationId)) {
            toast({
                title: "تنبيه: ضغط عمل على مندوب",
                description: `لدى ${courier.name} حاليًا ${activeShipmentCount} شحنة نشطة.`,
            });
            shownNotificationsRef.current.add(notificationId);
        }
    });

    // Check for high return rates per company for the day
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    companies?.forEach(company => {
      const notificationId = `returns_${company.id}_${today}`;
      const todaysReturns = shipments?.filter(s => {
        if (s.companyId !== company.id || (s.status !== 'Returned' && s.status !== 'Refused (Unpaid)')) return false;
        const updatedAt = s.updatedAt?.toDate();
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

  }, [courierDues, courierUsers, shipments, companies, toast, usersLoading, shipmentsLoading, companiesLoading]);
  

  const currentCourierNetDue = courierDues.find(c => c.id === payingCourier?.id)?.netDue;
  const currentCompanyNetDue = companyDues.find(c => c.id === payingCompany?.id)?.netDue;
  
  const handleGenericBulkUpdate = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !authUser) return;
  
    const batch = writeBatch(firestore);
    selectedRows.forEach(row => {
      const shipmentRef = doc(firestore, 'shipments', row.id);
      const finalUpdate: { [key: string]: any } = { ...update, updatedAt: serverTimestamp() };
      batch.update(shipmentRef, finalUpdate);
  
      if (update.status) {
        const historyRef = doc(collection(shipmentRef, 'history'));
        const historyEntry: Omit<ShipmentHistory, 'id'> = {
          status: update.status,
          reason: 'تحديث جماعي',
          updatedAt: serverTimestamp(),
          updatedBy: authUser.displayName || authUser.email!,
          userId: authUser.uid,
        };
        batch.set(historyRef, historyEntry);
      }
    });
  
    try {
      await batch.commit();
      toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
  
      if (update.assignedCourierId && selectedRows.length > 0) {
        const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
        await sendPushNotification({
          recipientId: update.assignedCourierId,
          title: 'شحنات جديدة',
          body: `تم تعيين ${selectedRows.length} شحنة جديدة لك.`,
          url: notificationUrl,
        });
      }
    } catch (error) {
      console.error("Bulk update failed:", error);
      toast({ title: "فشل التحديث المجمع", variant: "destructive" });
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
  
  const listIsLoading = shipmentsLoading || governoratesLoading || companiesLoading || usersLoading || statusesLoading;

  // Filtered data for management tabs
  const filteredCourierDues = React.useMemo(() => {
    if (!managementSearchTerm) return courierDues;
    return courierDues.filter(c => c.name?.toLowerCase().includes(managementSearchTerm.toLowerCase()));
  }, [courierDues, managementSearchTerm]);

  const filteredCompanyDues = React.useMemo(() => {
    if (!managementSearchTerm) return companyDues;
    return companyDues.filter(c => c.name?.toLowerCase().includes(managementSearchTerm.toLowerCase()));
  }, [companyDues, managementSearchTerm]);

  const handlePriceChangeDecision = (shipment: Shipment, approved: boolean) => {
    if (!firestore || !authUser) return;
    
    let updatePayload: any = {};
    if (approved) {
        updatePayload = {
            totalAmount: shipment.requestedAmount,
            status: 'In-Transit',
            reason: `تمت الموافقة على تعديل السعر من ${shipment.totalAmount} إلى ${shipment.requestedAmount}.`,
        };
    } else {
        updatePayload = {
            status: 'PriceChangeRejected',
            reason: `تم رفض طلب تعديل السعر (السعر المقترح: ${shipment.requestedAmount}).`,
        };
    }

    const finalUpdate = {
        ...updatePayload,
        requestedAmount: null,
        amountChangeReason: null,
    };

    handleSaveShipment(finalUpdate, shipment.id);

    // Send notification to the courier
    if (shipment.assignedCourierId) {
        const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/?edit=${shipment.id}` : `/?edit=${shipment.id}`;
        const message = approved 
            ? `تمت الموافقة على طلب تعديل سعر شحنة ${shipment.recipientName}.`
            : `تم رفض طلب تعديل سعر شحنة ${shipment.recipientName}.`;
        sendPushNotification({
            recipientId: shipment.assignedCourierId,
            title: 'تحديث بخصوص طلب تعديل السعر',
            body: message,
            url: notificationUrl,
        }).catch(console.error);
    }
  };


  return (
    <div className="flex flex-col w-full">
        <Tabs defaultValue="shipments">
        <div className="flex items-center">
            <TabsList className="flex-nowrap overflow-x-auto justify-start">
            <TabsTrigger value="shipments">الشحنات</TabsTrigger>
            <TabsTrigger value="print-center">
                <Printer className="w-4 h-4 me-2"/>
                مركز الطباعة
            </TabsTrigger>
            <TabsTrigger value="problem-inbox" className="relative">
              صندوق المشاكل
              {problemCount > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{problemCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="courier-management">إدارة المناديب</TabsTrigger>
            <TabsTrigger value="company-management">إدارة الشركات</TabsTrigger>
            <TabsTrigger value="account-statements">
              <FileSpreadsheet className="w-4 h-4 me-2"/>
              كشوفات الحسابات
            </TabsTrigger>
            <TabsTrigger value="user-management">إدارة المستخدمين</TabsTrigger>
             <TabsTrigger value="settings">
                <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>الإعدادات</span>
                </Link>
            </TabsTrigger>
            <TabsTrigger value="audit-log">
                <History className="w-4 h-4 me-2" />
                سجل التغييرات
            </TabsTrigger>
            <TabsTrigger value="reports">التقارير</TabsTrigger>
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
                <Button asChild variant="outline" size="sm">
                    <Link href="/scan">
                        <ScanLine className="h-4 w-4 me-2" />
                        <span className="sr-only sm:not-sr-only">مسح باركود</span>
                    </Link>
                </Button>
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
        <TabsContent value="shipments" className={isMobile ? "pb-20" : ""}>
            {isMobile ? 
                <MobileShipmentsView 
                    archivedShipmentsCompany={archivedShipmentsCompany}
                    archivedShipmentsCourier={archivedShipmentsCourier}
                    inWarehouseShipments={inWarehouseShipments}
                    returnsWithCouriers={returnsWithCouriers}
                    returnedToCompanyShipments={returnedToCompanyShipments}
                    filteredShipments={filteredShipments}
                    recentlyUpdatedShipments={recentlyUpdatedShipments}
                    unassignedShipments={unassignedShipments}
                    assignedShipments={assignedShipments}
                    listIsLoading={listIsLoading}
                    governorates={governorates || []}
                    companies={companies || []}
                    courierUsers={courierUsers}
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
                /> : 
                <DesktopShipmentsView
                    listIsLoading={listIsLoading}
                    role={role}
                    filteredShipments={filteredShipments}
                    getShipmentsByStatus={getShipmentsByStatus}
                    archivedShipmentsCompany={archivedShipmentsCompany}
                    archivedShipmentsCourier={archivedShipmentsCourier}
                    inWarehouseShipments={inWarehouseShipments}
                    returnsWithCouriers={returnsWithCouriers}
                    returnedToCompanyShipments={returnedToCompanyShipments}
                    recentlyUpdatedShipments={recentlyUpdatedShipments}
                    unassignedShipments={unassignedShipments}
                    assignedShipments={assignedShipments}
                    governorates={governorates || []}
                    companies={companies || []}
                    courierUsers={courierUsers}
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
        <TabsContent value="print-center">
            <PrintCenterPage 
                shipments={shipments || []}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                courierUsers={courierUsers || []}
                statuses={statuses || []}
                onEdit={openShipmentForm}
                role={role}
                onGenericBulkUpdate={handleGenericBulkUpdate}
            />
        </TabsContent>
         <TabsContent value="problem-inbox">
            <div className="mt-4 space-y-6">
                <ProblemShipmentList title="طلبات تعديل أسعار" icon={<DollarSign className="h-5 w-5 text-yellow-500" />} shipments={priceChangeRequests} onEdit={openShipmentForm}>
                    {(s: Shipment) => {
                        const courierName = courierUsers.find(c => c.id === s.assignedCourierId)?.name;
                        const requestedAmountString = s.requestedAmount ? s.requestedAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : 'N/A';
                        return (
                            <div>
                                <p className="font-bold">{s.recipientName} - <span className="text-sm text-muted-foreground">بواسطة {courierName}</span></p>
                                <div className="text-sm text-muted-foreground flex items-center gap-4">
                                    <span>السعر الحالي: <span className="font-mono">{s.totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span></span>
                                    <span className="font-bold text-primary">←</span>
                                    <span>السعر المقترح: <span className="font-mono font-bold text-primary">{requestedAmountString}</span></span>
                                </div>
                                <p className="text-xs text-amber-600 mt-1">السبب: {s.amountChangeReason || 'لم يذكر'}</p>
                                <div className="mt-2 flex gap-2">
                                    <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => handlePriceChangeDecision(s, true)}><Check className="me-2 h-4 w-4" /> موافقة</Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={() => handlePriceChangeDecision(s, false)}><X className="me-2 h-4 w-4" /> رفض</Button>
                                </div>
                            </div>
                        );
                    }}
                </ProblemShipmentList>
                <ProblemShipmentList title="مرتجعات بحاجة لقرار" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} shipments={returnedShipmentsNeedingAction} onEdit={openShipmentForm}>
                    {(s: Shipment) => {
                         const companyName = companies?.find(c => c.id === s.companyId)?.name || "N/A";
                         const govName = governorates?.find(g => g.id === s.governorateId)?.name || "N/A";
                        return (<div>
                            <p className="font-bold">{s.recipientName} - <span className="text-primary">{companyName}</span></p>
                            <p className="text-sm text-muted-foreground">{s.address}, {govName}</p>
                        </div>)
                    }}
                </ProblemShipmentList>
                <ProblemShipmentList title="شحنات مؤجلة لفترة طويلة" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} shipments={longPostponedShipments} onEdit={openShipmentForm}>
                     {(s: Shipment) => {
                         const companyName = companies?.find(c => c.id === s.companyId)?.name || "N/A";
                         const lastUpdate = s.updatedAt?.toDate ? differenceInDays(new Date(), s.updatedAt.toDate()) : 0;
                        return (<div>
                            <p className="font-bold">{s.recipientName} - <span className="text-primary">{companyName}</span></p>
                            <p className="text-xs text-amber-600">مؤجلة منذ {lastUpdate} أيام</p>
                        </div>)
                    }}
                </ProblemShipmentList>
                <ProblemShipmentList title="شحنات متأخرة عند المناديب" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} shipments={staleInTransitShipments} onEdit={openShipmentForm}>
                    {(s: Shipment) => {
                         const companyName = companies?.find(c => c.id === s.companyId)?.name || "N/A";
                        return (<div>
                            <p className="font-bold">{s.recipientName} - <span className="text-primary">{companyName}</span></p>
                            <p className="text-xs text-red-600">لم يتم تحديثها منذ أكثر من 24 ساعة</p>
                        </div>)
                    }}
                </ProblemShipmentList>
                {problemCount === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-16 bg-muted/40 rounded-lg">
                    <CheckSquare className="h-16 w-16 text-green-500 mb-4" />
                    <h3 className="text-2xl font-bold">لا توجد مشاكل حاليًا</h3>
                    <p className="text-muted-foreground mt-2">صندوق المشاكل فارغ. كل الأمور تسير على ما يرام!</p>
                </div>
                )}
          </div>
        </TabsContent>
        <TabsContent value="courier-management">
             <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-headline font-semibold">إدارة حسابات المناديب</h2>
                     <div className="relative">
                        <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ابحث عن مندوب..."
                            value={managementSearchTerm}
                            onChange={(e) => setManagementSearchTerm(e.target.value)}
                            className="pr-8 sm:w-[300px]"
                        />
                    </div>
                </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredCourierDues.map(courier => (
                            <Card key={courier.id} className="flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        {courier.name}
                                    </CardTitle>
                                    <div className={`text-xl font-bold ${courier.netDue >= 0 ? 'text-destructive' : 'text-green-600'}`}>
                                        {Math.abs(courier.netDue).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-xs text-muted-foreground">
                                        {courier.netDue > 0 ? "المبلغ المستحق على المندوب" : (courier.netDue < 0 ? "المبلغ المستحق للمندوب" : "الحساب مسوى")}
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
                                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openCourierPaymentForm(courier, payment)}>
                                                                  <Pencil className="h-3 w-3" />
                                                              </Button>
                                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setCourierPaymentToDelete(payment)}>
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
                                <CardFooter className="flex flex-col items-stretch gap-2">
                                    <Button variant="outline" className="w-full" onClick={() => openCourierPaymentForm(courier)} disabled={courier.netDue <= 0}>
                                        <HandCoins className="me-2 h-4 w-4" />
                                        تسوية الحساب
                                    </Button>
                                    {courier.totalShipments > 0 && (
                                        <Button variant="secondary" className="w-full" onClick={() => setCourierToArchive(courier)}>
                                            <Archive className="me-2 h-4 w-4" />
                                            أرشفة وتسوية الكل
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
        </TabsContent>
         <TabsContent value="company-management">
               <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl fontheadline font-semibold">إدارة حسابات الشركات</h2>
                    <div className="relative">
                        <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ابحث عن شركة..."
                            value={managementSearchTerm}
                            onChange={(e) => setManagementSearchTerm(e.target.value)}
                            className="pr-8 sm:w-[300px]"
                        />
                    </div>
                </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredCompanyDues.map(company => (
                             <Card key={company.id} className="flex flex-col">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <Building className="h-4 w-4 text-muted-foreground" />
                                        {company.name}
                                    </CardTitle>
                                    <div className={`text-xl font-bold ${company.netDue >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                        {company.netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-xs text-muted-foreground">
                                        المبلغ المستحق للدفع للشركة
                                    </p>
                                    <div className="mt-4 space-y-2 text-sm">
                                         <div className="flex justify-between items-center border-b pb-2">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <Package className="h-4 w-4" />
                                                إجمالي الشحنات:
                                            </span>
                                            <span className="font-medium">{company.totalShipments}</span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <DollarSign className="h-4 w-4" />
                                                إجمالي التحصيل:
                                            </span>
                                            <span className="font-medium">{company.totalRevenue.toLocaleString('ar-EG', {style: 'currency', currency: 'EGP'})}</span>
                                        </div>
                                          <div className="flex justify-between items-center">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <BadgePercent className="h-4 w-4 text-indigo-500" />
                                                عمولات الشركة:
                                            </span>
                                            <span className="font-medium">{company.totalCompanyCommission.toLocaleString('ar-EG', {style: 'currency', currency: 'EGP'})}</span>
                                        </div>
                                         <div className="flex justify-between items-center border-t pt-2 mt-2">
                                            <span className="flex items-center gap-2 text-muted-foreground">
                                                <WalletCards className="h-4 w-4" />
                                                إجمالي المدفوعات:
                                            </span>
                                            <span className="font-medium text-green-700">{company.totalPaidToCompany.toLocaleString('ar-EG', {style: 'currency', currency: 'EGP'})}</span>
                                        </div>
                                        
                                        {company.paymentHistory && company.paymentHistory.length > 0 && (
                                            <Collapsible className="pt-2 text-xs">
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="flex items-center gap-2 w-full justify-start p-0 h-auto text-xs">
                                                        <History className="h-3 w-3"/>
                                                        <span>عرض سجل الدفعات ({company.paymentHistory.length})</span>
                                                    </Button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="space-y-2 mt-2">
                                                  {company.paymentHistory.map(payment => (
                                                      <div key={payment.id} className="flex justify-between items-center text-muted-foreground p-2 rounded-md bg-muted/50">
                                                          <div>
                                                              <span className="font-semibold">{payment.amount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span>
                                                              <span className="mx-2">-</span>
                                                              <span>{new Date(payment.paymentDate?.toDate?.() || Date.now()).toLocaleDateString('ar-EG')}</span>
                                                          </div>
                                                          <div className="flex items-center">
                                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openCompanyPaymentForm(company, payment)}>
                                                                  <Pencil className="h-3 w-3" />
                                                              </Button>
                                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setCompanyPaymentToDelete(payment)}>
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
                                <CardFooter className="flex flex-col items-stretch gap-2">
                                    <Button variant="outline" className="w-full" onClick={() => openCompanyPaymentForm(company)} disabled={company.netDue <= 0}>
                                        <Banknote className="me-2 h-4 w-4" />
                                        تسوية الحساب
                                    </Button>
                                    {company.totalShipments > 0 && (
                                        <Button variant="secondary" className="w-full" onClick={() => setCompanyToArchive(company)}>
                                            <Archive className="me-2 h-4 w-4" />
                                            أرشفة وتسوية الكل
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
        </TabsContent>
        <TabsContent value="account-statements">
            <AccountStatementsPage />
        </TabsContent>
        <TabsContent value="user-management">
            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-headline font-semibold">إدارة المستخدمين والشركات</h2>
                        <div className="relative mt-2">
                             <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                             <Input
                                placeholder="ابحث عن مستخدم..."
                                value={managementSearchTerm}
                                onChange={(e) => setManagementSearchTerm(e.target.value)}
                                className="pr-8 sm:w-[300px]"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <UserFormSheet 
                            open={isUserSheetOpen}
                            onOpenChange={setIsUserSheetOpen}
                            onSave={handleSaveUser}
                            user={editingUser}
                            companyDetails={editingCompany}
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
                 {isMobile ? 
                     <div className="space-y-4">
                        {(users || []).map(user => (
                            <UserCard 
                                key={user.id} 
                                user={user}
                                company={companies?.find(c => c.id === user.id)}
                                onEdit={openUserForm}
                                onDelete={setUserToDelete}
                            />
                        ))}
                    </div> : 
                    <UsersTable listIsLoading={usersLoading || companiesLoading} users={users || []} onEdit={openUserForm} onDelete={setUserToDelete} searchTerm={managementSearchTerm} />
                 }
            </div>
        </TabsContent>
        <TabsContent value="audit-log">
             <AuditLogPage 
                users={users || []}
                shipments={shipments || []}
                companies={companies || []}
                governorates={governorates || []}
                isLoading={listIsLoading}
             />
        </TabsContent>
        <TabsContent value="reports">
             <ReportsPage 
                shipments={shipments || []}
                companies={companies || []}
                couriers={courierUsers || []}
                governorates={governorates || []}
                companyPayments={companyPayments || []}
                courierPayments={courierPayments || []}
                isLoading={listIsLoading}
             />
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
        statuses={statuses || []}
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
        <AlertDialog open={!!shipmentToDelete} onOpenChange={(open) => !open && setShipmentToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من حذف الشحنة؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف الشحنة ({shipmentToDelete?.recipientName}) بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
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
              سيتم حذف سجل هذه الدفعة بشكل نهائي. سيؤثر هذا على المبلغ المستحق على المندوب. لا يمكن التراجع عن هذا الإجراء.
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
              سيتم حذف سجل هذه الدفعة بشكل نهائي. سيؤثر هذا على المبلغ المستحق للشركة. لا يمكن التراجع عن هذا الإجراء.
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
             سيقوم هذا الإجراء بتسجيل دفعة بالمبلغ المستحق على المندوب حاليًا، ثم أرشفة جميع الشحنات المنتهية والدفعات الحالية للمندوب. لا يمكن التراجع عن هذا الإجراء.
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
              سيؤدي هذا الإجراء إلى أرشفة جميع الشحنات المنتهية والدفعات الحالية للشركة. سيتم تصفير حسابها لتبدأ دورة عمل جديدة.
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
       {importResult && (
        <ImportProgressDialog
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}
    </div>
  );
}
