
"use client"
import * as React from "react"
import { useVirtualizer } from '@tanstack/react-virtual'
import type {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
  Table as TableType,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
    CheckCircle2,
    Truck,
    Truck as CourierIcon,
    XCircle,
    MoreHorizontal,
    Pencil,
    Printer,
    Hourglass,
    Archive,
    ArrowUpDown,
    ChevronDown,
    FileUp,
    Trash2,
    User as UserIcon,
    Building,
    CheckSquare,
    AlertTriangle,
    MinusCircle,
    CalendarClock,
    ThumbsDown,
    HandCoins,
    Share2,
    PhoneOff,
    Warehouse,
    Edit,
    BellRing,
    History,
    RefreshCcw,
    QrCode,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { Shipment, Governorate, Company, Role, User, ShipmentStatusConfig } from "@/lib/types"
import { exportToExcel } from "@/lib/export"
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase"
import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { sendPushNotification } from "@/lib/actions"
import { cn, formatToCairoTime } from "@/lib/utils"
import { ShipmentDetailsDialog } from "../shipments/shipment-details-dialog"
import { ShipmentFilters } from "./shipment-filters"
import type { DateRange } from "react-day-picker"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

export const statusIcons: Record<string, React.ReactNode> = {
    Pending: <Hourglass className="h-4 w-4 text-yellow-500" />,
    "In-Transit": <Truck className="h-4 w-4 text-blue-500" />,
    Delivered: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    "Partially Delivered": <MinusCircle className="h-4 w-4 text-green-600" />,
    "Evasion (Phone)": <PhoneOff className="h-4 w-4 text-purple-500" />,
    "Evasion (Delivery Attempt)": <AlertTriangle className="h-4 w-4 text-purple-600" />,
    Cancelled: <XCircle className="h-4 w-4 text-red-500" />,
    Returned: <Archive className="h-4 w-4 text-orange-500" />,
    "Custom-Return": <Archive className="h-4 w-4 text-orange-500" />,
    Postponed: <CalendarClock className="h-4 w-4 text-gray-500" />,
    "Returned to Sender": <Archive className="h-4 w-4 text-orange-700" />,
    "Refused (Paid)": <HandCoins className="h-4 w-4 text-green-500" />,
    "Refused (Unpaid)": <ThumbsDown className="h-4 w-4 text-red-500" />,
    "PriceChangeRequested": <Edit className="h-4 w-4 text-yellow-600" />,
    "PriceChangeRejected": <ThumbsDown className="h-4 w-4 text-red-600" />,
}

export const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    Pending: "outline",
    "In-Transit": "secondary",
    Delivered: "default",
    "Partially Delivered": "default",
    "Evasion (Phone)": "secondary",
    "Evasion (Delivery Attempt)": "secondary",
    Cancelled: "destructive",
    Returned: "secondary",
    "Custom-Return": "secondary",
    Postponed: "outline",
    "Returned to Sender": "secondary",
    "Refused (Paid)": "default",
    "Refused (Unpaid)": "destructive",
    "PriceChangeRequested": "outline",
    "PriceChangeRejected": "destructive",
}

export const statusText: Record<string, string> = {
    Pending: 'قيد الانتظار',
    'In-Transit': 'قيد التوصيل',
    Delivered: 'تم التسليم',
    'Partially Delivered': 'تم التسليم جزئياً',
    'Evasion (Phone)': 'تهرب هاتفياً',
    'Evasion (Delivery Attempt)': 'تهرب بعد الوصول',
    Cancelled: 'فشل التسليم',
    Returned: 'مرتجع',
    'Custom-Return': 'استرجاع مخصص',
    Postponed: 'مؤجل',
    'Returned to Sender': 'تم الرجوع للراسل',
    'Refused (Paid)': 'رفض ودفع مصاريف شحن',
    'Refused (Unpaid)': 'رفض ولم يدفع مصاريف شحن',
    'PriceChangeRequested': 'طلب تعديل سعر',
    'PriceChangeRejected': 'مرفوض - تابع مع الإدارة'
};


type ActionCellProps = {
  row: Row<Shipment>;
  onEdit: (shipment: Shipment) => void;
  onBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
  role: Role | null;
  governorates: Governorate[];
  companies: Company[];
  couriers: User[];
};

const ActionsCell: React.FC<ActionCellProps> = ({ row, onEdit, onBulkUpdate, role, governorates, companies, couriers }) => {
  const shipment = row.original;
  const { toast } = useToast();
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const handlePrint = () => {
    if (role === 'courier') return; // Couriers can't print
    const printUrl = `/print/${shipment.id}`;
    window.open(printUrl, '_blank', 'width=800,height=600');
  };

  const handleShare = () => {
      const companyName = companies.find(c => c.id === shipment.companyId)?.name || 'غير محدد';
      const governorateName = governorates.find(g => g.id === shipment.governorateId)?.name || 'غير محدد';

      const shipmentDetails = [
          `*تقرير شحنة*`,
          `--------------------------`,
          `*كود الشحنة:* ${shipment.shipmentCode}`,
          `*الشركة (العميل الرئيسي):* ${companyName}`,
          `*الراسل (العميل الفرعي):* ${shipment.senderName || 'غير محدد'}`,
          `*المرسل إليه:* ${shipment.recipientName}`,
          `*الهاتف:* ${shipment.recipientPhone}`,
          `*العنوان:* ${shipment.address}, ${governorateName}`,
          `*المبلغ الإجمالي:* ${shipment.totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}`,
          `*الحالة الحالية:* ${statusText[shipment.status] || shipment.status}`,
          `*ملاحظات:* ${shipment.reason || 'لا يوجد'}`,
      ].join('\n');

      const encodedMessage = encodeURIComponent(shipmentDetails);
      window.open(`whatsapp://send?text=${encodedMessage}`, '_blank');
  };
  
    const handleToggleWarehouseReturn = () => {
      onBulkUpdate([shipment], { isWarehouseReturn: !shipment.isWarehouseReturn });
    };

    const handleToggleArchive = (type: 'company' | 'courier') => {
        const key = type === 'company' ? 'isArchivedForCompany' : 'isArchivedForCourier';
        onBulkUpdate([shipment], { [key]: !shipment[key] });
    }


  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">فتح القائمة</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setDetailsOpen(true)}>
            <History className="ms-2 h-4 w-4" /> سجل التعديلات
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(shipment)}>
          <Pencil className="ms-2 h-4 w-4" /> تعديل
        </DropdownMenuItem>
        {role === 'admin' && (
            <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleToggleArchive('company')} >
                    <Building className="ms-2 h-4 w-4 text-blue-500" /> 
                    {shipment.isArchivedForCompany ? 'إلغاء أرشفة الشركة' : 'أرشفة للشركة'}
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => handleToggleArchive('courier')}>
                    <UserIcon className="ms-2 h-4 w-4 text-green-500" />
                    {shipment.isArchivedForCourier ? 'إلغاء أرشفة المندوب' : 'أرشفة للمندوب'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleToggleWarehouseReturn}>
                    <Warehouse className="ms-2 h-4 w-4" /> 
                    {shipment.isWarehouseReturn ? 'إزالة من المخزن' : 'تحديد كمرتجع للمخزن'}
                </DropdownMenuItem>
            </>
        )}
        <DropdownMenuItem onClick={handleShare}>
            <Share2 className="ms-2 h-4 w-4" /> مشاركة عبر واتساب
        </DropdownMenuItem>
        {role !== 'courier' && <DropdownMenuItem onClick={handlePrint}>
          <Printer className="ms-2 h-4 w-4" /> طباعة الملصق
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
     <ShipmentDetailsDialog 
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        shipment={shipment}
        company={companies.find(c => c.id === shipment.companyId)}
        courier={couriers.find(c => c.id === shipment.assignedCourierId)}
        governorate={governorates.find(g => g.id === shipment.governorateId)}
      />
    </>
  );
};


interface GetColumnsProps {
    governorates: Governorate[];
    companies: Company[];
    couriers: User[];
    statuses: ShipmentStatusConfig[];
    onEdit: (shipment: Shipment) => void;
    onBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
    role: Role | null;
}

export const getColumns = ({
    governorates,
    companies,
    couriers,
    statuses,
    onEdit,
    onBulkUpdate,
    role,
}: GetColumnsProps): ColumnDef<Shipment>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "orderNumber",
    header: "رقم الطلب",
    cell: ({ row }) => <div>{row.getValue("orderNumber")}</div>,
  },
   {
    accessorKey: "shipmentCode",
    header: "كود الشحنة",
    cell: ({ row }) => <div>{row.getValue("shipmentCode")}</div>,
  },
   {
    accessorKey: "companyId",
    header: "الشركة",
    cell: ({ row }) => {
        const company = companies.find(c => c.id === row.getValue("companyId"));
        return <div className="flex items-center gap-2">
            {company && <Building className="h-4 w-4 text-muted-foreground" />}
            <span>{company?.name || ''}</span>
        </div>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "senderName",
    header: "الراسل",
    cell: ({ row }) => <div>{row.getValue("senderName")}</div>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        التاريخ
        <ArrowUpDown className="ms-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
       const createdAt = row.getValue("createdAt") as any;
       // Handle both Firestore Timestamp and JS Date objects
       const date = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
       return <div>{formatToCairoTime(date)}</div>;
    },
     filterFn: (row, id, value: DateRange) => {
        const createdAt = row.original.createdAt;
        if (!createdAt) return false;
        
        let date: Date | null = null;
        if (typeof createdAt.toDate === 'function') { // It's a Firestore Timestamp
            date = createdAt.toDate();
        } else if (createdAt instanceof Date) { // It's already a Date object
            date = createdAt;
        } else { // It might be a string or number, try to parse it
            const parsedDate = new Date(createdAt);
            if (!isNaN(parsedDate.getTime())) {
                date = parsedDate;
            }
        }
        
        if (!date) return false;

        if (value.from && date < value.from) return false;
        if (value.to && date > value.to) return false;
        return true;
    },
  },
  {
    accessorKey: "recipientName",
    header: "المرسل اليه",
    cell: ({ row }) => (
        <div className="font-medium">{row.getValue("recipientName")}</div>
    ),
  },
  {
    accessorKey: "recipientPhone",
    header: "التليفون",
    cell: ({ row }) => <div>{row.getValue("recipientPhone")}</div>,
  },
  {
    accessorKey: "governorateId",
    header: "المحافظة",
    cell: ({ row }) => {
        const governorate = governorates.find(g => g.id === row.getValue("governorateId"));
        return <div>{governorate?.name || row.getValue("governorateId")}</div>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "address",
    header: "العنوان",
    cell: ({ row }) => <div className="max-w-xs truncate">{row.getValue("address")}</div>
  },
  {
    accessorKey: "assignedCourierId",
    header: "المندوب",
    cell: ({ row }) => {
        const courier = couriers.find(c => c.id === row.getValue("assignedCourierId"));
        return <div className="flex items-center gap-2">
            {courier && <Truck className="h-4 w-4 text-muted-foreground" />}
            <span>{courier?.name || ''}</span>
        </div>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "status",
    header: "حالة الأوردر",
    cell: ({ row }) => {
        const statusKey = row.getValue("status") as string;
        const shipment = row.original;
        const statusLabel = statuses.find(s => s.id === statusKey)?.label || statusText[statusKey] || statusKey;
        return (
          <div className="flex items-center gap-2 min-w-[180px]">
            <Badge variant={statusVariants[statusKey]} className="capitalize flex gap-2">
                {statusIcons[statusKey]}
                <span>{statusLabel}</span>
            </Badge>
             {(shipment.isArchivedForCompany || shipment.isArchivedForCourier) && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Archive className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                            {shipment.isArchivedForCompany && <p>مؤرشفة للشركة</p>}
                             {shipment.isArchivedForCourier && <p>مؤرشفة للمندوب</p>}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            {shipment.isWarehouseReturn && (
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "reason",
    header: "السبب",
    cell: ({ row }) => <div>{row.getValue("reason")}</div>,
  },
  {
    accessorKey: "totalAmount",
    header: () => <div className="text-start">الاجمالي</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("totalAmount"))
      const formatted = new Intl.NumberFormat("ar-EG", {
        style: "currency",
        currency: "EGP",
      }).format(amount)
 
      return <div className="text-start font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "paidAmount",
    header: () => <div className="text-start">المدفوع</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("paidAmount"))
      const formatted = new Intl.NumberFormat("ar-EG", {
        style: "currency",
        currency: "EGP",
      }).format(amount)
 
      return <div className="text-start font-medium">{formatted}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: (props) => (
      <ActionsCell
        {...props}
        onEdit={onEdit}
        onBulkUpdate={onBulkUpdate!}
        role={role}
        governorates={governorates}
        companies={companies}
        couriers={couriers}
      />
    ),
  },
]



const BulkActions = ({ 
    table, 
    role, 
    activeTab,
    statuses,
    companies,
    couriers,
    handleGenericBulkUpdate,
    handleBulkPrintInternal,
    handleBulkDeleteInternal,
}: { 
    table: TableType<Shipment>,
    role: Role | null,
    activeTab?: string, 
    statuses: ShipmentStatusConfig[], 
    companies: Company[], 
    couriers: User[],
    handleGenericBulkUpdate: (update: Partial<Shipment>) => void,
    handleBulkPrintInternal: () => void,
    handleBulkDeleteInternal: () => void,
}) => {
    const selectedCount = table.getFilteredSelectedRowModel().rows.length;
    if (selectedCount === 0) return null;

    // --- All Buttons --- 
    const changeStatusButton = (
        <DropdownMenu>
           <DropdownMenuTrigger asChild>
                <Button variant="outline" className="bg-white border-slate-200 h-10 px-3 gap-2 text-slate-700">
                   <CheckSquare className="h-4 w-4" />
                   تغيير الحالة
                </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent align="end">
               {statuses.filter(s => s.enabled).map((status) => (
                    <DropdownMenuItem key={status.id} onSelect={() => handleGenericBulkUpdate({ status: status.id })}>
                        {status.label}
                    </DropdownMenuItem>
               ))}
           </DropdownMenuContent>
       </DropdownMenu>
   );

    const resetButton = (
        (role === 'admin' || role === 'customer-service') && (
            <Button variant="outline" className="bg-white border-slate-200 h-10 px-3 gap-2 text-orange-500" onClick={() => handleGenericBulkUpdate({ 
                status: 'Pending', assignedCourierId: '', reason: 'إعادة تعيين الشحنة', isWarehouseReturn: false, isReturningToCompany: false, isReturnedToCompany: false, isArchivedForCompany: false, isArchivedForCourier: false, retryAttempt: false, requestedAmount: 0, amountChangeReason: ""
            })}>
                <RefreshCcw className="h-4 w-4" />
                إعادة تعيين
            </Button>
        )
    );

    const retryButton = (
        (role === 'admin' || role === 'customer-service') && (
            <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-blue-600 font-medium" onClick={() => handleGenericBulkUpdate({ retryAttempt: true })}>
                <BellRing className="h-4 w-4" />
                إعادة محاولة
            </Button>
        )
    );

    const assignCourierButton = (
        (role === 'admin' || role === 'customer-service' || role === 'company') && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700">
                        <UserIcon className="h-4 w-4" />
                        تعيين مندوب
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-60 overflow-y-auto">
                {(couriers || []).map(courier => (
                        <DropdownMenuItem key={courier.id} onSelect={() => handleGenericBulkUpdate({ assignedCourierId: courier.id })}>
                            {courier.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    );
    
    const toWarehouseButton = (
         (role === 'admin' || role === 'customer-service') && (
            <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700" onClick={() => handleGenericBulkUpdate({ isWarehouseReturn: true })}>
                <Warehouse className="h-4 w-4" />
                للمخزن
            </Button>
        )
    );
    
    const assignCompanyButton = (
        role === 'admin' && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700">
                        <Building className="h-4 w-4" />
                        تعيين شركة
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-60 overflow-y-auto">
                {(companies || []).map(company => (
                        <DropdownMenuItem key={company.id} onSelect={() => handleGenericBulkUpdate({ companyId: company.id })}>
                            {company.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    );
    
    const printButton = (
        role !== 'courier' && (
            <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700" onClick={handleBulkPrintInternal}>
                <Printer className="h-4 w-4" />
                طباعة
            </Button>
        )
    );

    const deliverToCompanyButton = (
        (role === 'admin' || role === 'customer-service') && (
            <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700" onClick={() => handleGenericBulkUpdate({ isReturningToCompany: true })}>
                <QrCode className="h-4 w-4" />
                توصيل للشركة
            </Button>
        )
    );

    const arrivedAtCompanyButton = (
        (role === 'admin' || role === 'customer-service') && (
            <Button variant="outline" className="flex-1 bg-white border-slate-100 h-14 gap-3 text-slate-700 font-medium" onClick={() => handleGenericBulkUpdate({ isReturnedToCompany: true })}>
                <Building className="h-5 w-5" />
                وصلت للشركة
            </Button>
        )
    );

    const deleteButton = (
         role === 'admin' && (
            <Button variant="destructive" className="w-14 h-14 p-0 bg-red-500 hover:bg-red-600" onClick={handleBulkDeleteInternal}>
                <Trash2 className="h-6 w-6" />
            </Button>
        )
    );


    return (
        <>
            {/* --- Mobile View --- */}
             <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-50 rounded-t-xl" dir="rtl">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-[#5ba4a4] font-bold text-lg">شحنات محددة {selectedCount}</span>
                    <Button variant="ghost" size="sm" onClick={() => table.resetRowSelection()}>إلغاء</Button>
                </div>
                
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        {changeStatusButton}
                        {resetButton}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        {retryButton}
                        {assignCourierButton}
                        {toWarehouseButton}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {assignCompanyButton}
                        {printButton}
                        {deliverToCompanyButton}
                    </div>

                    <div className="flex gap-2">
                        {arrivedAtCompanyButton}
                        {deleteButton}
                    </div>
                </div>
            </div>

            {/* --- Desktop View --- */}
            <div className="hidden lg:flex items-center gap-2 flex-wrap justify-end">
                 <span className="text-sm text-muted-foreground">
                    {selectedCount} شحنات محددة
                </span>
                {role !== 'courier' && <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleBulkPrintInternal}>
                    <Printer className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">طباعة المحدد</span>
                </Button>}
                
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="sm" className="h-8 gap-1">
                            <CheckSquare className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only">تغيير الحالة</span>
                         </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        {statuses.filter(s => s.enabled).map((status) => (
                             <DropdownMenuItem key={status.id} onSelect={() => handleGenericBulkUpdate({ status: status.id })}>
                                 {status.label}
                             </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                {(role === 'admin' || role === 'customer-service') && (
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-orange-600 hover:text-orange-700" onClick={() => handleGenericBulkUpdate({ 
                        status: 'Pending', assignedCourierId: '', reason: 'إعادة تعيين الشحنة', isWarehouseReturn: false, isReturningToCompany: false, isReturnedToCompany: false, isArchivedForCompany: false, isArchivedForCourier: false, retryAttempt: false, requestedAmount: 0, amountChangeReason: ""
                    })}>
                        <RefreshCcw className="me-2 h-3.5 w-3.5" />
                        إعادة تعيين
                    </Button>
                )}
                {role === 'admin' && (
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ retryAttempt: true })}>
                        <BellRing className="me-2 h-3.5 w-3.5" />
                        إعادة محاولة
                    </Button>
                )}
                {(role === 'admin' || role === 'customer-service') && activeTab === 'returns-with-couriers' && (
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isWarehouseReturn: true })}>
                        <Warehouse className="me-2 h-3.5 w-3.5" />
                        للمخزن
                    </Button>
                )}
                {(role === 'admin' || role === 'customer-service') && activeTab === 'returns-in-warehouse' && (
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isReturningToCompany: true })}>
                        <CourierIcon className="me-2 h-3.5 w-3.5" />
                        توصيل للشركة
                    </Button>
                )}
                {(role === 'admin' || role === 'customer-service') && activeTab === 'returning-to-company' && (
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isReturnedToCompany: true })}>
                        <Building className="me-2 h-3.5 w-3.5" />
                        وصلت للشركة
                    </Button>
                )}
                {role === 'admin' && (
                    <>
                         <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isArchivedForCompany: true })}>
                            <Building className="ms-2 h-4 w-4" /> أرشفة للشركة
                        </Button>
                         <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isArchivedForCourier: true })}>
                            <UserIcon className="ms-2 h-4 w-4" /> أرشفة للمندوب
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <Building className="h-3.5 w-3.5" />
                                    <span>تعيين شركة</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                            {(companies || []).map(company => (
                                    <DropdownMenuItem key={company.id} onSelect={() => handleGenericBulkUpdate({ companyId: company.id })}>
                                        {company.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <UserIcon className="h-3.5 w-3.5" />
                                    <span>تعيين مندوب</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                            {(couriers || []).map(courier => (
                                    <DropdownMenuItem key={courier.id} onSelect={() => handleGenericBulkUpdate({ assignedCourierId: courier.id })}>
                                        {courier.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {activeTab === 'none' && <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={handleBulkDeleteInternal}>
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only">حذف</span>
                        </Button>}
                    </>
                )}
                {(role === 'company' || role === 'customer-service') && (
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-1">
                                <UserIcon className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only">تعيين مندوب</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                        {couriers.map(courier => (
                                <DropdownMenuItem key={courier.id} onSelect={() => handleGenericBulkUpdate({ assignedCourierId: courier.id })}>
                                    {courier.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
             </div>
        </>
    )
}

export function ShipmentsTable({ 
    shipments, 
    isLoading, 
    governorates, 
    companies, 
    couriers,
    statuses,
    onEdit, 
    role, 
    onBulkUpdate,
    onBulkDelete,
    onBulkPrint,
    filters,
    onFiltersChange,
    activeTab = 'none',
}: { 
    shipments: Shipment[], 
    isLoading: boolean, 
    governorates: Governorate[], 
    companies: Company[], 
    couriers: User[], 
    statuses: ShipmentStatusConfig[],
    onEdit: (shipment: Shipment) => void, 
    role: Role | null, 
    onBulkUpdate?: (selectedRows: Shipment[], update: Partial<Shipment>) => void,
    onBulkDelete?: (selectedRows: Shipment[]) => void,
    onBulkPrint?: (selectedRows: Shipment[]) => void,
    filters?: ColumnFiltersState,
    onFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>,
    activeTab?: 'none' | 'company' | 'courier' | 'returns-with-couriers' | 'returns-in-warehouse' | 'returned-to-company' | 'returning-to-company',
}) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const { toast } = useToast()
  const firestore = useFirestore();

  const parentRef = React.useRef<HTMLDivElement>(null)
  
  const columns = React.useMemo(() => getColumns({ governorates, companies, couriers, statuses, onEdit, onBulkUpdate: onBulkUpdate!, role }), [governorates, companies, couriers, statuses, onEdit, onBulkUpdate, role]);
  
  const table = useReactTable({
    data: shipments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: onFiltersChange || setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters: filters || columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
        columnVisibility: {
          companyId: role !== 'admin',
          deliveryDate: false,
          assignedCourierId: role === 'courier', // Hide courier column for couriers
        }
    }
  })

  const { rows } = table.getRowModel()

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 58, 
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  
  React.useEffect(() => {
    table.getColumn('companyId')?.toggleVisibility(role === 'admin' || role === 'customer-service');
    table.getColumn('assignedCourierId')?.toggleVisibility(role !== 'courier');
  }, [role, table]);


  const handleExport = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
    const dataToExport = selectedRows.length > 0 ? selectedRows : shipments;
    if (dataToExport.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    exportToExcel(dataToExport, columns.filter(c => c.id !== 'select' && c.id !== 'actions'), "shipments", governorates, companies, couriers);
  }

  const handleBulkPrintInternal = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات للطباعة", variant: "destructive" });
        return;
    }
    
    if (onBulkPrint) {
        onBulkPrint(selectedRows.map(row => row.original));
        table.resetRowSelection();
        return;
    }

    const ids = selectedRows.map(row => row.original.id);
    const printUrl = `/print/bulk?ids=${ids.join(',')}`;
    window.open(printUrl, '_blank', 'width=800,height=600');
  }


  const handleBulkDeleteInternal = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }
    if (onBulkDelete) {
      onBulkDelete(selectedRows.map(row => row.original));
      table.resetRowSelection();
    }
  }

  const handleGenericBulkUpdate = (update: Partial<Shipment>) => {
    if (!firestore) return;
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }
    
    if (onBulkUpdate) {
        onBulkUpdate(selectedRows.map(row => row.original), update);
        table.resetRowSelection();
        return;
    }

    const batch = writeBatch(firestore);
    selectedRows.forEach(row => {
        const docRef = doc(firestore, "shipments", row.original.id);
        const finalUpdate: { [key: string]: any } = { ...update, updatedAt: serverTimestamp() };
        batch.update(docRef, finalUpdate);
    });

    batch.commit().then(async () => {
        if (update.assignedCourierId) {
            await sendPushNotification({
                recipientId: update.assignedCourierId,
                title: 'شحنات جديدة',
                body: `تم تعيين ${selectedRows.length} شحنة جديدة لك.`,
                url: '/',
            });
        }

        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
        table.resetRowSelection();
    }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: 'shipments',
            operation: 'update',
            requestResourceData: { update, note: `Bulk update of ${selectedRows.length} documents.` }
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  }

  return (
    <div className="w-full">
        { onFiltersChange && (
            <div className="flex items-center justify-between py-4 gap-2 flex-wrap">
                 <ShipmentFilters 
                    governorates={governorates}
                    companies={companies}
                    courierUsers={couriers}
                    statuses={statuses}
                    onFiltersChange={onFiltersChange}
                />
            </div>
        )}
        <div className="flex items-center justify-between py-4">
             <div className="flex items-center gap-2 flex-wrap">
                 <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleExport}>
                    <FileUp className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">تصدير Excel</span>
                </Button>
            </div>
             <BulkActions 
                table={table}
                role={role}
                activeTab={activeTab}
                statuses={statuses}
                companies={companies}
                couriers={couriers}
                handleGenericBulkUpdate={handleGenericBulkUpdate}
                handleBulkPrintInternal={handleBulkPrintInternal}
                handleBulkDeleteInternal={handleBulkDeleteInternal}
            />
        </div>
      <div ref={parentRef} className="rounded-md border bg-card overflow-auto" style={{ height: `calc(100vh - 25rem)` }}>
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10 grid">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="flex w-full">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-right whitespace-nowrap flex items-center" style={{ width: header.getSize() }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody style={{ height: `${totalSize}px`, position: 'relative' }}>
            {isLoading ? (
                Array.from({length: 10}).map((_, i) => (
                    <TableRow key={i}>
                         {columns.map(col => <TableCell key={(col as any).id || (col as any).accessorKey}><Skeleton className="h-6 w-full" /></TableCell>)}
                    </TableRow>
                ))
            ) : virtualRows.length > 0 ? (
                virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index] as Row<Shipment>;
                  
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      data-index={virtualRow.index}
                      className={cn(
                        "flex absolute w-full",
                        row.original.retryAttempt ? "bg-yellow-100/50 dark:bg-yellow-900/20" : ""
                      )}
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                            key={cell.id} 
                            className={cn("text-right p-4 flex items-center")}
                            style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  لا توجد شحنات.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
