

"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PlusCircle, FileUp, Database, User as UserIcon, Building, BadgePercent, DollarSign, Truck as CourierIcon, CalendarClock, MessageSquare, HandCoins, History, Pencil, Trash2, WalletCards, Archive, Banknote, Package, FileText, Loader2, Printer, ChevronDown, Bot, CheckSquare, ListChecks, AlertTriangle, ArchiveRestore, Warehouse, RefreshCw, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, User, CourierPayment, Chat, CompanyPayment, ShipmentStatus } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable, UserCard } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { UserFormSheet } from "@/components/users/user-form-sheet";
import { CourierPaymentFormSheet } from "@/components/users/courier-payment-form-sheet";
import { CompanyPaymentFormSheet } from "@/components/users/company-payment-form-sheet";
import { ImportProgressDialog, type ImportProgress } from "@/components/shipments/import-progress-dialog";
import { read, utils } from 'xlsx';
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, writeBatch, doc, getDocs, query, where, updateDoc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
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
import AutoAssignPage from "../ai/auto-assign-page";
import { statusText } from './shipments-table';
import { exportToExcel } from "@/lib/export";
import { getColumns as getShipmentColumns } from './shipments-table';
import { differenceInDays, differenceInHours } from "date-fns";
import { ReportsPage } from "@/components/reports/reports-page";


interface AdminDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}

const calculateCommissionAndPaidAmount = (
    status: ShipmentStatus,
    totalAmount: number,
    collectedAmount: number,
    courierCommissionRate: number,
    companyCommission: number,
) => {
    const update: { paidAmount?: number; courierCommission?: number; companyCommission?: number; collectedAmount?: number } = {};
    
    const safeTotalAmount = totalAmount || 0;
    const safeCollectedAmount = collectedAmount || 0;
    const safeCourierCommissionRate = courierCommissionRate || 0;
    const safeCompanyCommission = companyCommission || 0;
    

    switch (status) {
        case 'Delivered':
            update.courierCommission = safeCourierCommissionRate;
            update.paidAmount = safeTotalAmount;
            update.collectedAmount = safeTotalAmount;
            update.companyCommission = safeCompanyCommission;
            break;

        case 'Partially Delivered':
        case 'Refused (Paid)':
            update.courierCommission = safeCourierCommissionRate;
            update.paidAmount = safeCollectedAmount;
            update.companyCommission = safeCompanyCommission;
            break;

        case 'Evasion (Delivery Attempt)':
        case 'Refused (Unpaid)':
            update.courierCommission = safeCourierCommissionRate;
            update.paidAmount = 0;
            update.collectedAmount = 0;
            update.companyCommission = 0; 
            break;
            
        case 'Evasion (Phone)':
        case 'Returned':
        case 'Cancelled':
        case 'Postponed':
        case 'Returned to Sender':
            update.courierCommission = 0;
            update.paidAmount = 0;
            update.collectedAmount = 0;
            update.companyCommission = 0;
            break;

        default: // Includes 'Pending', 'In-Transit', and any other status
            update.paidAmount = 0;
            update.courierCommission = 0;
            update.companyCommission = 0;
            update.collectedAmount = 0;
            break;
    }

    return update;
}


const Filters = ({
  governorates,
  companies,
  courierUsers,
  onFiltersChange
}: {
  governorates: Governorate[];
  companies: Company[];
  courierUsers: User[];
  onFiltersChange: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
}) => {
    const [localFilters, setLocalFilters] = React.useState<ColumnFiltersState>([]);

    const handleFilterChange = React.useCallback(() => {
        onFiltersChange(localFilters);
    }, [localFilters, onFiltersChange]);

    React.useEffect(() => {
        handleFilterChange();
    }, [handleFilterChange]);

    const governorateFilterValue = localFilters.find(f => f.id === 'governorateId')?.value as string[] | undefined;
    const companyFilterValue = localFilters.find(f => f.id === 'companyId')?.value as string[] | undefined;
    const courierFilterValue = localFilters.find(f => f.id === 'assignedCourierId')?.value as string[] | undefined;

    const setFilter = (id: string, value: any) => {
        setLocalFilters(prev => {
            const newFilters = prev.filter(f => f.id !== id);
            if (value !== undefined && (!Array.isArray(value) || value.length > 0)) {
                newFilters.push({ id, value });
            }
            return newFilters;
        });
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                        <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            المحافظة
                            {governorateFilterValue && governorateFilterValue.length > 0 && ` (${governorateFilterValue.length})`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {(governorates || []).map((governorate) => (
                    <DropdownMenuCheckboxItem
                        key={governorate.id}
                        checked={governorateFilterValue?.includes(governorate.id)}
                        onCheckedChange={(checked) => {
                            const current = governorateFilterValue || [];
                            const newFilter = checked
                                ? [...current, governorate.id]
                                : current.filter((id) => id !== governorate.id);
                            setFilter("governorateId", newFilter.length ? newFilter : undefined);
                        }}
                    >
                        {governorate.name}
                    </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                         <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            الشركة
                            {companyFilterValue && companyFilterValue.length > 0 && ` (${companyFilterValue.length})`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {(companies || []).map((company) => (
                    <DropdownMenuCheckboxItem
                        key={company.id}
                        checked={companyFilterValue?.includes(company.id)}
                        onCheckedChange={(checked) => {
                            const current = companyFilterValue || [];
                            const newFilter = checked
                                ? [...current, company.id]
                                : current.filter((id) => id !== company.id);
                            setFilter("companyId", newFilter.length ? newFilter : undefined);
                        }}
                    >
                        {company.name}
                    </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                         <ChevronDown className="h-3.5 w-3.5 ms-1" />
                        <span>
                            المندوب
                            {courierFilterValue && courierFilterValue.length > 0 && ` (${courierFilterValue.length})`}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {courierUsers.map((courier) => (
                    <DropdownMenuCheckboxItem
                        key={courier.id}
                        checked={courierFilterValue?.includes(courier.id)}
                        onCheckedChange={(checked) => {
                            const current = courierFilterValue || [];
                            const newFilter = checked
                                ? [...current, courier.id]
                                : current.filter((id) => id !== courier.id);
                            setFilter("assignedCourierId", newFilter.length ? newFilter : undefined);
                        }}
                    >
                        {courier.name}
                    </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

const MobileShipmentsView = ({
    shipments,
    archivedShipments,
    filteredShipments,
    recentlyUpdatedShipments,
    listIsLoading,
    governorates,
    companies,
    courierUsers,
    onEdit,
    onDelete,
    onPrint,
    onBulkUpdate,
    onBulkDelete,
    columnFilters,
    setColumnFilters,
    role,
  }: {
    shipments: Shipment[];
    archivedShipments: Shipment[];
    filteredShipments: Shipment[];
    recentlyUpdatedShipments: Shipment[];
    listIsLoading: boolean;
    governorates: Governorate[];
    companies: Company[];
    courierUsers: User[];
    onEdit: (shipment: Shipment) => void;
    onDelete: (shipment: Shipment) => void;
    onPrint: (shipment: Shipment) => void;
    onBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
    onBulkDelete: (selectedRows: Shipment[]) => void;
    columnFilters: ColumnFiltersState;
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
    role: Role | null;
  }) => {

    const [activeTab, setActiveTab] = React.useState("all-shipments");
    const [mobileRowSelection, setMobileRowSelection] = React.useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const selectedCount = Object.values(mobileRowSelection).filter(Boolean).length;
    const selectedShipments = React.useMemo(() => {
        const selectedIds = Object.keys(mobileRowSelection).filter(id => mobileRowSelection[id]);
        return shipments?.filter(s => selectedIds.includes(s.id)) || [];
    }, [mobileRowSelection, shipments]);

    const getShipmentsByStatus = (status: ShipmentStatus | ShipmentStatus[]) => {
        const statuses = Array.isArray(status) ? status : [status];
        return filteredShipments.filter(s => statuses.includes(s.status));
    }

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


    const handleExport = () => {
        if (selectedShipments.length === 0) {
          toast({ title: "لا توجد بيانات للتصدير", description: "الرجاء تحديد شحنة واحدة على الأقل.", variant: "destructive" });
          return;
        }
        const shipmentColumns = getShipmentColumns({ onEdit, onBulkUpdate: handleGenericBulkUpdate, role, governorates, companies, couriers: courierUsers });
        exportToExcel(selectedShipments, shipmentColumns.filter(c => c.id !== 'select' && c.id !== 'actions'), "shipments", governorates || [], companies || [], courierUsers);
        setMobileRowSelection({});
    }

    const getCurrentShipmentList = () => {
      switch (activeTab) {
        case "recently-updated": return recentlyUpdatedShipments;
        case "pending": return getShipmentsByStatus('Pending');
        case "in-transit": return getShipmentsByStatus('In-Transit');
        case "delivered": return getShipmentsByStatus(['Delivered']);
        case "postponed": return getShipmentsByStatus('Postponed');
        case "returned": return getShipmentsByStatus(['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)']);
        case "returned-to-sender": return getShipmentsByStatus('Returned to Sender');
        case "archived": return archivedShipments;
        case "all-shipments":
        default: return filteredShipments;
      }
    };

    const currentList = getCurrentShipmentList();
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
                    <TabsTrigger value="recently-updated">
                        <RefreshCw className="h-4 w-4 me-1" />
                        المُحدَّثة
                    </TabsTrigger>
                    <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
                    <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
                    <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
                    <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
                    <TabsTrigger value="returned">مرتجعات</TabsTrigger>
                    <TabsTrigger value="returned-to-sender">مرتجع للراسل</TabsTrigger>
                    <TabsTrigger value="archived" className="col-span-4">المؤرشفة</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-4">
                    <Filters governorates={governorates || []} companies={companies || []} courierUsers={courierUsers} onFiltersChange={setColumnFilters} />
                    {currentList.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-8 gap-1">
                            <ListChecks className="h-3.5 w-3.5" />
                            <span>{areAllSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
                        </Button>
                    )}
                </div>
            </div>
            <TabsContent value="all-shipments">{renderShipmentList(filteredShipments)}</TabsContent>
            <TabsContent value="recently-updated">{renderShipmentList(recentlyUpdatedShipments)}</TabsContent>
            <TabsContent value="pending">{renderShipmentList(getShipmentsByStatus('Pending'))}</TabsContent>
            <TabsContent value="in-transit">{renderShipmentList(getShipmentsByStatus('In-Transit'))}</TabsContent>
            <TabsContent value="delivered">{renderShipmentList(getShipmentsByStatus(['Delivered']))}</TabsContent>
            <TabsContent value="postponed">{renderShipmentList(getShipmentsByStatus('Postponed'))}</TabsContent>
            <TabsContent value="returned">{renderShipmentList(getShipmentsByStatus(['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)']))}</TabsContent>
            <TabsContent value="returned-to-sender">{renderShipmentList(getShipmentsByStatus('Returned to Sender'))}</TabsContent>
            <TabsContent value="archived">{renderShipmentList(archivedShipments)}</TabsContent>
            {selectedCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-2 shadow-lg flex items-center justify-around gap-2 z-40">
                     <span className="text-sm font-medium">{selectedCount} شحنات محددة</span>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm">
                                <CheckSquare className="me-2 h-4 w-4" />
                                <span>تغيير الحالة</span>
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {Object.entries(statusText).map(([statusValue, statusLabel]) => (
                                 <DropdownMenuItem key={statusValue} onSelect={() => handleMobileBulkUpdate({ status: statusValue as ShipmentStatus })}>
                                     {statusLabel}
                                 </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <FileUp className="me-2 h-4 w-4" />
                        تصدير
                    </Button>
                    {activeTab === 'archived' &&
                        <Button variant="outline" size="sm" onClick={() => handleMobileBulkUpdate({ isArchived: false })}>
                            <ArchiveRestore className="me-2 h-4 w-4" />
                            إلغاء الأرشفة
                        </Button>
                    }
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
    archivedShipments,
    recentlyUpdatedShipments,
    governorates,
    companies,
    courierUsers,
    openShipmentForm,
    handleGenericBulkUpdate,
    handleBulkDelete,
    columnFilters,
    setColumnFilters,
  }: {
    listIsLoading: boolean;
    role: Role | null;
    filteredShipments: Shipment[];
    getShipmentsByStatus: (status: ShipmentStatus | ShipmentStatus[]) => Shipment[];
    archivedShipments: Shipment[];
    recentlyUpdatedShipments: Shipment[];
    governorates: Governorate[];
    companies: Company[];
    courierUsers: User[];
    openShipmentForm: (shipment?: Shipment) => void;
    handleGenericBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
    handleBulkDelete: (selectedRows: Shipment[]) => void;
    columnFilters: ColumnFiltersState,
    setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>,
  }) => {
    const renderShipmentTable = (shipmentList: Shipment[], isArchivedTab = false) => (
        <ShipmentsTable 
          shipments={shipmentList} 
          isLoading={listIsLoading}
          governorates={governorates || []}
          companies={companies || []}
          couriers={courierUsers}
          onEdit={openShipmentForm}
          role={role}
          onBulkUpdate={handleGenericBulkUpdate}
          onBulkDelete={handleBulkDelete}
          filters={columnFilters}
          onFiltersChange={setColumnFilters}
          isArchivedTab={isArchivedTab}
        />
    );

    return (
        <Tabs defaultValue="all-shipments">
            <TabsList className="flex-nowrap overflow-x-auto justify-start mt-4">
                <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                <TabsTrigger value="recently-updated">
                    <RefreshCw className="h-4 w-4 me-1" />
                    المُحدَّثة مؤخراً
                </TabsTrigger>
                <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
                <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
                <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
                <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
                <TabsTrigger value="returned">مرتجعات</TabsTrigger>
                <TabsTrigger value="returned-to-sender">مرتجع للراسل</TabsTrigger>
                <TabsTrigger value="archived">المؤرشفة</TabsTrigger>
            </TabsList>
            <TabsContent value="all-shipments">{renderShipmentTable(filteredShipments)}</TabsContent>
            <TabsContent value="recently-updated">{renderShipmentTable(recentlyUpdatedShipments)}</TabsContent>
            <TabsContent value="pending">{renderShipmentTable(getShipmentsByStatus('Pending'))}</TabsContent>
            <TabsContent value="in-transit">{renderShipmentTable(getShipmentsByStatus('In-Transit'))}</TabsContent>
            <TabsContent value="delivered">{renderShipmentTable(getShipmentsByStatus(['Delivered']))}</TabsContent>
            <TabsContent value="postponed">{renderShipmentTable(getShipmentsByStatus('Postponed'))}</TabsContent>
            <TabsContent value="returned">{renderShipmentTable(getShipmentsByStatus(['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)']))}</TabsContent>
            <TabsContent value="returned-to-sender">{renderShipmentTable(getShipmentsByStatus('Returned to Sender'))}</TabsContent>
            <TabsContent value="archived">{renderShipmentTable(archivedShipments, true)}</TabsContent>
        </Tabs>
    )
  }

const MobileUsersView = ({ listIsLoading, users, companies, onEdit, onDelete } : { listIsLoading: boolean, users: User[], companies: Company[], onEdit: (user: User, company?: Company) => void, onDelete: (user: User) => void }) => {
     if (listIsLoading) {
      return (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-card rounded-lg border">
                <div className="w-full h-6 bg-muted rounded animate-pulse"/>
                <div className="w-1/2 h-4 bg-muted rounded animate-pulse mt-2"/>
            </div>
          ))}
        </div>
      );
    }
    if ((users || []).length === 0) {
      return <div className="text-center py-10 text-muted-foreground">لا يوجد مستخدمون.</div>;
    }
    return (
        <div className="space-y-3 mt-4">
            {(users || []).map(u => (
                <UserCard
                    key={u.id}
                    user={u}
                    company={u.role === 'company' ? companies?.find(c => c.id === u.id) : undefined}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
  }
  
const DesktopUsersView = ({ listIsLoading, users, onEdit, onDelete }: { listIsLoading: boolean, users: User[], onEdit: (user: User, company?: Company) => void, onDelete: (user: User) => void }) => (
    <UsersTable users={users || []} isLoading={listIsLoading} onEdit={onEdit} onDelete={onDelete}/>
)

// Helper component for the Problem Inbox
const ProblemShipmentList = ({ title, shipments, onEdit, governorates, companies }: { title: string, shipments: Shipment[], onEdit: (s: Shipment) => void, governorates: Governorate[], companies: Company[] }) => {
  if (shipments.length === 0) {
    return null; // Don't render the card if there are no shipments
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          {title} ({shipments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {shipments.map(s => {
            const companyName = companies.find(c => c.id === s.companyId)?.name || "N/A";
            const govName = governorates.find(g => g.id === s.governorateId)?.name || "N/A";
            const lastUpdate = s.updatedAt?.toDate ? differenceInDays(new Date(), s.updatedAt.toDate()) : 0;
            return (
              <div key={s.id} className="border p-3 rounded-lg flex justify-between items-center bg-muted/30">
                <div>
                  <p className="font-bold">{s.recipientName} - <span className="text-primary">{companyName}</span></p>
                  <p className="text-sm text-muted-foreground">{s.address}, {govName}</p>
                   {title.includes("المؤجلة") && <p className="text-xs text-amber-600">مؤجلة منذ {lastUpdate} أيام</p>}
                   {title.includes("المتأخرة") && <p className="text-xs text-red-600">لم يتم تحديثها منذ أكثر من 24 ساعة</p>}
                </div>
                <Button variant="secondary" size="sm" onClick={() => onEdit(s)}>مراجعة</Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  )
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

  const [importProgress, setImportProgress] = React.useState<ImportProgress | null>(null);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

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
    if (file && firestore && authUser && companies) {
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
                  recipientName: String(row['المرسل اليه']),
                  recipientPhone: String(row['التليفون']?.toString()),
                  governorateId: governorates?.find(g => g.name === row['المحافظة'])?.id || '',
                  address: String(row['العنوان'] || 'N/A'),
                  totalAmount: parseFloat(String(totalAmountValue).replace(/[^0-9.]/g, '')),
                  paidAmount: parseFloat(String(row['المدفوع'] || '0').replace(/[^0-9.]/g, '')),
                  status: row['حالة الأوردر'] || 'Pending',
                  reason: String(row['السبب'] || ''),
                  deliveryDate: deliveryDate || new Date(),
                  updatedAt: serverTimestamp(),
                  isArchived: false,
                  companyId: foundCompany ? foundCompany.id : authUser.uid,
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

  const handleSaveShipment = async (shipmentData: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !user || !companies || !users) return;

    let dataToSave: { [key: string]: any } = Object.fromEntries(
        Object.entries(shipmentData).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    
    dataToSave.updatedAt = serverTimestamp();

    let originalShipment: Shipment | undefined;
    if (id) {
        const docSnap = await getDoc(doc(firestore, 'shipments', id));
        if (docSnap.exists()) {
            originalShipment = docSnap.data() as Shipment;
        }
    }
    
    const courierId = dataToSave.assignedCourierId || originalShipment?.assignedCourierId;
    const companyId = dataToSave.companyId || originalShipment?.companyId;
    const governorateId = dataToSave.governorateId || originalShipment?.governorateId;
    const newStatus = dataToSave.status || originalShipment?.status;
    
    // Always recalculate commission if a status is being set (even if it's the same)
    // and there is a courier assigned.
    if (courierId && newStatus) {
        const courierUser = users.find(u => u.id === courierId && u.role === 'courier');
        const company = companies.find(c => c.id === companyId);
        
        if (courierUser && company && governorateId) {
            const courierCommissionRate = courierUser.commissionRate || 0;
            const companyGovernorateCommission = company.governorateCommissions?.[governorateId] || 0;
            
            const totalAmount = dataToSave.totalAmount ?? originalShipment?.totalAmount ?? 0;
            const collectedAmount = dataToSave.collectedAmount ?? originalShipment?.collectedAmount ?? 0;

            const calculatedFields = calculateCommissionAndPaidAmount(
                newStatus,
                totalAmount,
                collectedAmount,
                courierCommissionRate,
                companyGovernorateCommission
            );
            dataToSave = { ...dataToSave, ...calculatedFields };
        }
    }


    const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';

    const savePromise = id
        ? updateDoc(doc(firestore, 'shipments', id), dataToSave)
        : setDoc(doc(collection(firestore, 'shipments')), { 
            ...dataToSave, 
            companyId: dataToSave.companyId || user.id, 
            isArchived: false, 
            createdAt: serverTimestamp() 
          });

    savePromise
      .then(() => {
        toast({
          title: id ? "تم تحديث الشحنة" : "تم حفظ الشحنة",
          description: `تمت العملية بنجاح`,
        });
        handleSheetOpenChange(false);
        // Send notification after successful save, don't block UI for it
        if (shipmentData.assignedCourierId && shipmentData.assignedCourierId !== originalShipment?.assignedCourierId) {
          sendPushNotification({
            recipientId: shipmentData.assignedCourierId,
            title: 'شحنة جديدة',
            body: `تم تعيين شحنة جديدة لك: ${shipmentData.recipientName}`,
            url: notificationUrl,
          }).catch(console.error); // Log notification error but don't bother user
        }
      })
      .catch(serverError => {
        // Only emit permission error if it's a Firestore error
        if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `shipments/${id || ''}`,
                operation: id ? 'update' : 'create',
                requestResourceData: dataToSave
            });
            errorEmitter.emit('permission-error', permissionError);
        } else {
             // For other errors (like notification failure), log it but don't show a destructive toast
            console.error("Error during save operation (possibly non-Firestore):", serverError);
        }
      });
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
        const userUpdatePayload: any = { name: data.name, updatedAt: serverTimestamp() };

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
      if (!firestore || !courierToArchive || !user) return;
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

      // Step 3: Archive finished shipments
      const finishedStatuses: ShipmentStatus[] = ['Delivered', 'Partially Delivered', 'Returned', 'Cancelled', 'Evasion (Phone)', 'Evasion (Delivery Attempt)', 'Refused (Paid)', 'Refused (Unpaid)', 'Returned to Sender'];
      const courierShipmentsToArchive = shipments?.filter(s => s.assignedCourierId === courierToArchive.id && !s.isArchived && finishedStatuses.includes(s.status)) || [];
      courierShipmentsToArchive.forEach(shipment => {
          const shipmentRef = doc(firestore, 'shipments', shipment.id);
          batch.update(shipmentRef, { isArchived: true });
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
      if (!firestore || !companyToArchive) return;
      toast({ title: `جاري أرشفة بيانات ${companyToArchive.name}...` });

      const batch = writeBatch(firestore);

      const companyShipments = shipments?.filter(s => s.companyId === companyToArchive.id && !s.isArchived) || [];
      companyShipments.forEach(shipment => {
          const shipmentRef = doc(firestore, 'shipments', shipment.id);
          batch.update(shipmentRef, { isArchived: true });
      });
      
      const companyPaymentsToArchive = companyPayments?.filter(p => p.companyId === companyToArchive.id && !p.isArchived) || [];
      companyPaymentsToArchive.forEach(payment => {
          const paymentRef = doc(firestore, 'company_payments', payment.id);
          batch.update(paymentRef, { isArchived: true });
      });
      
      await batch.commit()
          .then(() => {
              toast({ title: "اكتملت الأرشفة بنجاح!", description: `تمت أرشفة جميع شحنات ودفعات ${companyToArchive.name}.` });
          })
          .catch(serverError => {
            if (serverError instanceof Error && 'code' in serverError && serverError.code === 'permission-denied') {
                const permissionError = new FirestorePermissionError({ path: `batch_archive`, operation: 'update', requestResourceData: { note: `Batch archive for company ${companyToArchive.id} failed.` }});
                errorEmitter.emit('permission-error', permissionError);
            }
          })
          .finally(() => setCompanyToArchive(null));
  };


  const filteredShipments = React.useMemo(() => {
    let baseShipments = shipments?.filter(shipment => !shipment.isArchived) || [];

    // Apply column filters
    if (columnFilters.length > 0) {
        baseShipments = baseShipments.filter(shipment => {
            return columnFilters.every(filter => {
                const value = (shipment as any)[filter.id];
                if (!value) return false;
                const filterValue = filter.value as string[];
                return filterValue.includes(value);
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
        String(shipment.trackingNumber || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [shipments, searchTerm, columnFilters]);
  
  const archivedShipments = React.useMemo(() => {
    const archived = shipments?.filter(shipment => shipment.isArchived) || [];
     if (!searchTerm) return archived;
    const lowercasedTerm = searchTerm.toLowerCase();
    return archived.filter(shipment => 
        String(shipment.shipmentCode || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.orderNumber || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.recipientName || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.recipientPhone || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.trackingNumber || '').toLowerCase().includes(lowercasedTerm) ||
        String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [shipments, searchTerm]);

  const recentlyUpdatedShipments = React.useMemo(() => {
    const activeShipments = shipments?.filter(shipment => !shipment.isArchived) || [];
    return activeShipments.sort((a, b) => {
        const timeA = a.updatedAt?.toDate?.()?.getTime() || 0;
        const timeB = b.updatedAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
    }).slice(0, 50); // Get the last 50 updated shipments
}, [shipments]);


  const courierDues = React.useMemo(() => {
    if (!users || !shipments || !courierPayments) return [];
    
    return courierUsers.map(courier => {
        const activeShipments = shipments?.filter(s => s.assignedCourierId === courier.id && !s.isArchived) || [];
        const activePayments = courierPayments?.filter(p => p.courierId === courier.id && !p.isArchived) || [];
        
        const totalCollected = activeShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCommission = activeShipments.reduce((acc, s) => acc + (s.courierCommission || 0), 0);
        const totalPaidByCourier = activePayments.reduce((acc, p) => acc + p.amount, 0);

        const netDue = (totalCollected - totalCommission) - totalPaidByCourier;
        
        const allPaymentsForCourier = courierPayments?.filter(p => p.courierId === courier.id) || [];

        return {
            ...courier,
            totalShipments: activeShipments.length,
            deliveredCount: activeShipments.filter(s => s.status === 'Delivered' || s.status === 'Partially Delivered' || s.status === 'Evasion (Delivery Attempt)').length,
            returnedCount: activeShipments.filter(s => ['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)'].includes(s.status)).length,
            totalCollected,
            totalCommission,
            totalPaidByCourier,
            netDue,
            paymentHistory: allPaymentsForCourier.sort((a, b) => (b.paymentDate?.toDate?.() || 0) - (a.paymentDate?.toDate?.() || 0)),
        }
    })
  }, [users, shipments, courierUsers, courierPayments]);
  
  const companyDues = React.useMemo(() => {
    if (!companies || !shipments || !companyPayments) return [];
    
    return companies.map(company => {
        const activeShipments = shipments?.filter(s => s.companyId === company.id && !s.isArchived) || [];
        const activePayments = companyPayments?.filter(p => p.companyId === company.id && !p.isArchived) || [];
        
        const totalRevenue = activeShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
        const totalCompanyCommission = activeShipments.reduce((acc, s) => acc + (s.companyCommission || 0), 0);
        const totalPaidToCompany = activePayments.reduce((acc, p) => acc + p.amount, 0);
        
        const netDue = (totalRevenue - totalCompanyCommission) - totalPaidToCompany;
        
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

  // --- Start: Smart Notifications & Problem Inbox Logic ---

  // Use a ref to track which notifications have already been shown to avoid spamming the user
  const shownNotificationsRef = React.useRef<Set<string>>(new Set());

  // Problem Inbox Shipments
  const returnedShipmentsNeedingAction = React.useMemo(() => shipments?.filter(s => s.status === 'Returned' && !s.isArchived) || [], [shipments]);
  const longPostponedShipments = React.useMemo(() => shipments?.filter(s => s.status === 'Postponed' && s.updatedAt && differenceInDays(new Date(), s.updatedAt.toDate()) > 3 && !s.isArchived) || [], [shipments]);
  const staleInTransitShipments = React.useMemo(() => shipments?.filter(s => s.status === 'In-Transit' && s.updatedAt && differenceInHours(new Date(), s.updatedAt.toDate()) > 24 && !s.isArchived) || [], [shipments]);
  const problemCount = returnedShipmentsNeedingAction.length + longPostponedShipments.length + staleInTransitShipments.length;

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
        const activeShipmentCount = shipments?.filter(s => s.assignedCourierId === courier.id && !s.isArchived).length || 0;
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
  
  // --- End: Smart Notifications & Problem Inbox Logic ---

  const currentCourierNetDue = courierDues.find(c => c.id === payingCourier?.id)?.netDue;
  const currentCompanyNetDue = companyDues.find(c => c.id === payingCompany?.id)?.netDue;
  
  const handleGenericBulkUpdate = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !users || !companies || !governorates) return;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }
    
    const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';

    const batch = writeBatch(firestore);
    selectedRows.forEach(row => {
        const docRef = doc(firestore, "shipments", row.id);
        
        let finalUpdate: { [key: string]: any } = { ...update, updatedAt: serverTimestamp() };

        // If status is updated, re-calculate commissions
        if (update.status) {
            const courierId = row.assignedCourierId;
            const courierUser = users.find(u => u.id === courierId);
            const company = companies.find(c => c.id === row.companyId);

            if (courierUser && company) {
                const courierCommissionRate = courierUser.commissionRate || 0;
                const companyGovernorateCommission = company.governorateCommissions?.[row.governorateId || ''] || 0;

                const calculatedFields = calculateCommissionAndPaidAmount(
                    update.status as ShipmentStatus,
                    row.totalAmount,
                    row.collectedAmount || 0, // Assume not changed in bulk, use existing
                    courierCommissionRate,
                    companyGovernorateCommission
                );
                finalUpdate = { ...finalUpdate, ...calculatedFields };
            }
        }
        
        batch.update(docRef, finalUpdate);
    });

    try {
        await batch.commit();

        if (update.assignedCourierId && selectedRows.length > 0) {
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

  const getShipmentsByStatus = (status: ShipmentStatus | ShipmentStatus[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return filteredShipments.filter(s => statuses.includes(s.status));
  }
  
  const unassignedShipments = React.useMemo(() => {
    return shipments?.filter(s => !s.assignedCourierId && !s.isArchived) || [];
  }, [shipments]);

  const listIsLoading = shipmentsLoading || governoratesLoading || companiesLoading || usersLoading;

  return (
    <div className="flex flex-col w-full">
        <Tabs defaultValue="shipments">
        <div className="flex items-center">
            <TabsList className="flex-nowrap overflow-x-auto justify-start">
            <TabsTrigger value="shipments">الشحنات</TabsTrigger>
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
            <TabsTrigger value="reports">التقارير</TabsTrigger>
            <TabsTrigger value="ai-tools">
              <Bot className="w-4 h-4 me-2" />
              الذكاء الاصطناعي
            </TabsTrigger>
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
        <StatsCards shipments={shipments?.filter(s => !s.isArchived) || []} role={role} />
        <TabsContent value="shipments" className={isMobile ? "pb-20" : ""}>
            {isMobile ? 
                <MobileShipmentsView 
                    shipments={shipments || []}
                    archivedShipments={archivedShipments}
                    filteredShipments={filteredShipments}
                    recentlyUpdatedShipments={recentlyUpdatedShipments}
                    listIsLoading={listIsLoading}
                    governorates={governorates || []}
                    companies={companies || []}
                    courierUsers={courierUsers}
                    onEdit={openShipmentForm}
                    onDelete={(shipment) => setShipmentToDelete(shipment)}
                    onPrint={handlePrintShipment}
                    onBulkUpdate={handleGenericBulkUpdate}
                    onBulkDelete={handleDeleteShipment}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                    role={role}
                /> : 
                <DesktopShipmentsView
                    listIsLoading={listIsLoading}
                    role={role}
                    filteredShipments={filteredShipments}
                    getShipmentsByStatus={getShipmentsByStatus}
                    archivedShipments={archivedShipments}
                    recentlyUpdatedShipments={recentlyUpdatedShipments}
                    governorates={governorates || []}
                    companies={companies || []}
                    courierUsers={courierUsers}
                    openShipmentForm={openShipmentForm}
                    handleGenericBulkUpdate={handleGenericBulkUpdate}
                    handleBulkDelete={handleDeleteShipment}
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                />
            }
        </TabsContent>
         <TabsContent value="problem-inbox">
          <div className="mt-4 space-y-6">
            <ProblemShipmentList 
              title="مرتجعات بحاجة لقرار" 
              shipments={returnedShipmentsNeedingAction} 
              onEdit={openShipmentForm}
              governorates={governorates || []}
              companies={companies || []}
            />
            <ProblemShipmentList 
              title="شحنات مؤجلة لفترة طويلة" 
              shipments={longPostponedShipments}
              onEdit={openShipmentForm}
              governorates={governorates || []}
              companies={companies || []}
            />
            <ProblemShipmentList 
              title="شحنات متأخرة عند المناديب" 
              shipments={staleInTransitShipments}
              onEdit={openShipmentForm}
              governorates={governorates || []}
              companies={companies || []}
            />
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
                </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {companyDues.map(company => (
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
                    <h2 className="text-2xl font-headline font-semibold">إدارة المستخدمين والشركات</h2>
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
                    <MobileUsersView listIsLoading={usersLoading || companiesLoading} users={users || []} companies={companies || []} onEdit={openUserForm} onDelete={setUserToDelete} /> : 
                    <DesktopUsersView listIsLoading={usersLoading || companiesLoading} users={users || []} onEdit={openUserForm} onDelete={setUserToDelete} />
                 }
            </div>
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
        <TabsContent value="ai-tools">
            <AutoAssignPage 
                shipments={shipments || []}
                unassignedShipments={unassignedShipments}
                couriers={courierUsers}
                governorates={governorates || []}
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
             سيقوم هذا الإجراء بتسجيل دفعة بالمبلغ المستحق على المندوب حاليًا، ثم أرشفة جميع الشحنات والدفعات الحالية. لا يمكن التراجع عن هذا الإجراء.
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
              سيؤدي هذا الإجراء إلى أرشفة جميع الشحنات والدفعات الحالية للشركة. سيتم تصفير حسابها لتبدأ دورة عمل جديدة. لا يمكن التراجع عن هذا الإجراء.
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
       {importProgress && (
        <ImportProgressDialog
          progress={importProgress}
          onClose={() => setImportProgress(null)}
        />
      )}
    </div>
  );
}

    