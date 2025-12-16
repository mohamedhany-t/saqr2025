

"use client"
import * as React from "react"
import type {
  ColumnDef,
  ColumnFiltersState,
  Row,
  SortingState,
  VisibilityState,
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
    XCircle,
    FileText,
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
    ArchiveRestore,
    Warehouse,
    Edit,
    BellRing,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import type { Shipment, ShipmentStatusKey, Governorate, Company, Role, User, ShipmentStatusConfig } from "@/lib/types"
import { exportToExcel, exportToPDF } from "@/lib/export"
import { useFirestore, errorEmitter, FirestorePermissionError } from "@/firebase"
import { doc, writeBatch, serverTimestamp } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import { sendPushNotification } from "@/lib/actions"
import { cn, formatToCairoTime } from "@/lib/utils"
import { ShipmentDetailsDialog } from "../shipments/shipment-details-dialog"
import { ShipmentFilters } from "./shipment-filters"

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
    'Evasion (Phone)': 'تهرب هاتفيًا',
    'Evasion (Delivery Attempt)': 'تهرب بعد الوصول',
    Cancelled: 'تم الإلغاء',
    Returned: 'مرتجع',
    'Custom-Return': 'استرجاع مخصص',
    Postponed: 'مؤجل',
    'Returned to Sender': 'تم الرجوع للراسل',
    'Refused (Paid)': 'رفض ودفع الشحن',
    'Refused (Unpaid)': 'رفض ولم يدفع',
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
            <FileText className="ms-2 h-4 w-4" /> تفاصيل
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(shipment)}>
          <Pencil className="ms-2 h-4 w-4" /> تعديل
        </DropdownMenuItem>
        {role === 'admin' && (
            <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onBulkUpdate([shipment], { isArchivedForCompany: true })}>
                    <Building className="ms-2 h-4 w-4 text-blue-500" /> أرشفة للشركة
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => onBulkUpdate([shipment], { isArchivedForCourier: true })}>
                    <UserIcon className="ms-2 h-4 w-4 text-green-500" /> أرشفة للمندوب
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
       return <div>{formatToCairoTime(createdAt?.toDate())}</div>;
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
          <div className="flex items-center gap-2">
            <Badge variant={statusVariants[statusKey]} className="capitalize flex gap-2">
                {statusIcons[statusKey]}
                <span>{statusLabel}</span>
            </Badge>
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
    activeTab?: 'none' | 'company' | 'courier' | 'returns-with-couriers' | 'returns-in-warehouse' | 'returned-to-company',
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
  
  const columns = React.useMemo(() => getColumns({ governorates, companies, couriers, statuses, onEdit, onBulkUpdate: onBulkUpdate!, role }), [governorates, companies, couriers, statuses, onEdit, onBulkUpdate, role]);
  
  const table = useReactTable({
    data: shipments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: onFiltersChange || setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
        pagination: {
            pageSize: 50, 
        },
        columnVisibility: {
          companyId: role !== 'admin',
          deliveryDate: false,
          assignedCourierId: role === 'courier', // Hide courier column for couriers
        }
    }
  })
  
  React.useEffect(() => {
    table.getColumn('companyId')?.toggleVisibility(role === 'admin');
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

  const currentFilters = filters || columnFilters;
  const governorateFilterValue = currentFilters.find(f => f.id === 'governorateId')?.value as string[] | undefined;
  const companyFilterValue = currentFilters.find(f => f.id === 'companyId')?.value as string[] | undefined;
  const courierFilterValue = currentFilters.find(f => f.id === 'assignedCourierId')?.value as string[] | undefined;
  const statusFilterValue = currentFilters.find(f => f.id === 'status')?.value as string[] | undefined;
  
  const handleSetFilter = (id: string, value: any) => {
    if (onFiltersChange) {
      onFiltersChange(prev => {
        const newFilters = prev.filter(f => f.id !== id);
        if (value !== undefined && (!Array.isArray(value) || value.length > 0)) {
          newFilters.push({ id, value });
        }
        return newFilters;
      });
    } else {
      table.getColumn(id)?.setFilterValue(value);
    }
  };


  return (
    <div className="w-full">
        <div className="flex items-center justify-between py-4 gap-2 flex-wrap">
            { onFiltersChange && (
              <div className="flex items-center gap-2 flex-wrap">
                  <ShipmentFilters 
                    governorates={governorates}
                    companies={companies}
                    courierUsers={couriers}
                    statuses={statuses}
                    onFiltersChange={onFiltersChange}
                  />
              </div>
            )}
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
                 <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-sm text-muted-foreground hidden lg:inline">
                        {table.getFilteredSelectedRowModel().rows.length} شحنات محددة
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
                    {role === 'admin' && (
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ retryAttempt: true })}>
                            <BellRing className="me-2 h-3.5 w-3.5" />
                            إعادة محاولة
                        </Button>
                    )}
                    {role === 'admin' && activeTab === 'returns-with-couriers' && (
                        <>
                           <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isWarehouseReturn: true })}>
                                <Warehouse className="me-2 h-3.5 w-3.5" />
                                تم الرجوع للمخزن
                            </Button>
                             <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isReturnedToCompany: true })}>
                                <Building className="me-2 h-3.5 w-3.5" />
                                تم الرجوع للشركة
                            </Button>
                        </>
                    )}
                    {role === 'admin' && activeTab === 'returns-in-warehouse' && (
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isReturnedToCompany: true })}>
                            <Building className="me-2 h-3.5 w-3.5" />
                            تم الرجوع للشركة
                        </Button>
                    )}
                    {role === 'admin' && activeTab === 'returned-to-company' && (
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isArchivedForCompany: true })}>
                            <Archive className="me-2 h-3.5 w-3.5" />
                            أرشفة للشركة
                        </Button>
                    )}
                    {role === 'admin' && activeTab !== 'returns-with-couriers' && activeTab !== 'returns-in-warehouse' && activeTab !== 'returned-to-company' && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 gap-1">
                                    <Archive className="h-3.5 w-3.5" />
                                    <span className="sr-only sm:not-sr-only">أرشفة</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleGenericBulkUpdate({ isArchivedForCompany: true })}>
                                    <Building className="ms-2 h-4 w-4" /> أرشفة للشركة
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleGenericBulkUpdate({ isArchivedForCourier: true })}>
                                    <UserIcon className="ms-2 h-4 w-4" /> أرشفة للمندوب
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {activeTab === 'company' && role === 'admin' && (
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isArchivedForCompany: false })}>
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only">إلغاء أرشفة الشركة</span>
                        </Button>
                    )}
                     {activeTab === 'courier' && role === 'admin' && (
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleGenericBulkUpdate({ isArchivedForCourier: false })}>
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            <span className="sr-only sm:not-sr-only">إلغاء أرشفة المندوب</span>
                        </Button>
                    )}
                    {role === 'admin' && (
                        <>
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
                    {(role === 'company') && (
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
            )}
        </div>
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-right whitespace-nowrap">
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
          <TableBody>
            {isLoading ? (
                Array.from({length: 10}).map((_, i) => (
                    <TableRow key={i}>
                         {columns.map(col => <TableCell key={(col as any).id || (col as any).accessorKey}><Skeleton className="h-6 w-full" /></TableCell>)}
                    </TableRow>
                ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={row.original.retryAttempt ? "bg-yellow-100/50 dark:bg-yellow-900/20" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("text-right", cell.column.id === 'status' && 'min-w-[180px]')}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
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
      <div className="flex items-center justify-end space-x-2 py-4 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          السابق
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          التالي
        </Button>
      </div>
    </div>
  )
}
