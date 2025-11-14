"use client"
import * as React from "react"
import type {
  ColumnDef,
  ColumnFiltersState,
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
    User,
    Building,
    CheckSquare
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { Shipment, ShipmentStatus, Governorate, Company, Courier, Client, SubClient } from "@/lib/types"
import { exportToExcel, exportToPDF } from "@/lib/export"
import { useFirestore } from "@/firebase"
import { doc, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

const statusIcons: Record<ShipmentStatus, React.ReactNode> = {
    Pending: <Hourglass className="h-4 w-4 text-yellow-500" />,
    "In-Transit": <Truck className="h-4 w-4 text-blue-500" />,
    Delivered: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    Cancelled: <XCircle className="h-4 w-4 text-red-500" />,
    Returned: <Archive className="h-4 w-4 text-orange-500" />,
}

const statusVariants: Record<ShipmentStatus, "default" | "secondary" | "destructive" | "outline"> = {
    Pending: "outline",
    "In-Transit": "secondary",
    Delivered: "default",
    Cancelled: "destructive",
    Returned: "secondary",
}

const statusText: Record<ShipmentStatus, string> = {
    Pending: 'قيد الانتظار',
    'In-Transit': 'قيد التوصيل',
    Delivered: 'تم التوصيل',
    Cancelled: 'تم الإلغاء',
    Returned: 'مرتجع',
};


export const getColumns = (
    governorates: Governorate[],
    clients: Client[],
    subClients: SubClient[],
    couriers: Courier[]
    ): ColumnDef<Shipment>[] => [
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
    accessorKey: "trackingNumber",
    header: "رقم الشحنة",
    cell: ({ row }) => <div>{row.getValue("trackingNumber")}</div>,
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
       if (!createdAt) return null;
       const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
       return <div>{date.toLocaleDateString("ar-EG", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
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
    cell: ({ row }) => <div>{row.getValue("address")}</div>
  },
  {
    accessorKey: "deliveryDate",
    header: "تاريخ التسليم للمندوب",
     cell: ({ row }) => {
       const deliveryDate = row.getValue("deliveryDate") as any;
       if (!deliveryDate) return null;
       const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
       return <div>{date.toLocaleDateString("ar-EG", { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
    },
  },
  {
    accessorKey: "clientId",
    header: "العميل",
    cell: ({ row }) => {
        const client = clients.find(c => c.id === row.getValue("clientId"));
        return <div>{client?.name || row.getValue("clientId")}</div>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
   {
    accessorKey: "subClientId",
    header: "العميل الفرعي",
    cell: ({ row }) => {
        const subClient = subClients.find(sc => sc.id === row.getValue("subClientId"));
        return <div>{subClient?.name || ''}</div>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "status",
    header: "حالة الأوردر",
    cell: ({ row }) => {
        const status = row.getValue("status") as ShipmentStatus;
        return (
            <Badge variant={statusVariants[status]} className="capitalize flex gap-2">
                {statusIcons[status]}
                <span>{statusText[status] || status}</span>
            </Badge>
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
      const formatted = new Intl.NumberFormat("ar-SA", {
        style: "currency",
        currency: "SAR",
      }).format(amount)
 
      return <div className="text-start font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "paidAmount",
    header: () => <div className="text-start">المدفوع</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("paidAmount"))
      const formatted = new Intl.NumberFormat("ar-SA", {
        style: "currency",
        currency: "SAR",
      }).format(amount)
 
      return <div className="text-start font-medium">{formatted}</div>
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const shipment = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">فتح القائمة</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(shipment.shipmentCode)}
            >
              نسخ كود الشحنة
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Pencil className="me-2 h-4 w-4"/>تعديل</DropdownMenuItem>
            <DropdownMenuItem><FileText className="me-2 h-4 w-4"/>تفاصيل</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToPDF([shipment], getColumns(governorates, clients, subClients, couriers).filter(c => c.id !== 'select' && c.id !== 'actions'), governorates, clients, subClients, couriers)}><Printer className="me-2 h-4 w-4"/>طباعة</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]


export function ShipmentsTable({ shipments, isLoading, governorates, companies, couriers, clients, subClients }: { shipments: Shipment[], isLoading: boolean, governorates: Governorate[], companies: Company[], couriers: Courier[], clients: Client[], subClients: SubClient[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const { toast } = useToast()
  const firestore = useFirestore();
  
  const columns = React.useMemo(() => getColumns(governorates, clients, subClients, couriers), [governorates, clients, subClients, couriers]);
  
  const table = useReactTable({
    data: shipments,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  const handleExport = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
    const dataToExport = selectedRows.length > 0 ? selectedRows : shipments;
    exportToExcel(dataToExport, columns.filter(c => c.id !== 'select' && c.id !== 'actions'), "shipments", governorates, clients, subClients, couriers);
  }

  const handleBulkDelete = async () => {
    if (!firestore) return;
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }

    try {
        const batch = writeBatch(firestore);
        selectedRows.forEach(row => {
            const docRef = doc(firestore, "shipments", row.original.id);
            batch.delete(docRef);
        });
        await batch.commit();
        toast({ title: `تم حذف ${selectedRows.length} شحنة بنجاح` });
        table.resetRowSelection();
    } catch (error) {
        console.error("Error deleting shipments: ", error);
        toast({ title: "خطأ أثناء الحذف", description: "حدث خطأ غير متوقع.", variant: "destructive"});
    }
  }

  const handleBulkUpdate = async (update: Partial<Shipment>) => {
    if (!firestore) return;
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }
    
    try {
        const batch = writeBatch(firestore);
        selectedRows.forEach(row => {
            const docRef = doc(firestore, "shipments", row.original.id);
            batch.update(docRef, {...update, updatedAt: new Date()});
        });
        await batch.commit();
        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
        table.resetRowSelection();
    } catch (error) {
        console.error("Error updating shipments: ", error);
        toast({ title: "خطأ أثناء التحديث", description: "حدث خطأ غير متوقع.", variant: "destructive"});
    }
  }

  const governorateFilterValue = columnFilters.find(f => f.id === 'governorateId')?.value as string[] | undefined;
  const companyFilterValue = columnFilters.find(f => f.id === 'assignedCompanyId')?.value as string[] | undefined;
  const courierFilterValue = columnFilters.find(f => f.id === 'assignedCourierId')?.value as string[] | undefined;


  return (
    <div className="w-full">
        <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleExport}>
                    <FileUp className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        تصدير Excel
                    </span>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 gap-1">
                            <ChevronDown className="h-3.5 w-3.5" />
                            <span>
                                المحافظة
                                {governorateFilterValue && governorateFilterValue.length > 0 && ` (${governorateFilterValue.length})`}
                            </span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {governorates.map((governorate) => (
                        <DropdownMenuCheckboxItem
                            key={governorate.id}
                            checked={governorateFilterValue?.includes(governorate.id)}
                            onCheckedChange={(checked) => {
                                const current = governorateFilterValue || [];
                                const newFilter = checked
                                    ? [...current, governorate.id]
                                    : current.filter((id) => id !== governorate.id);
                                table.getColumn("governorateId")?.setFilterValue(newFilter.length ? newFilter : undefined);
                            }}
                        >
                            {governorate.name}
                        </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
                 <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        {table.getFilteredSelectedRowModel().rows.length} شحنات محددة
                    </span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm" className="h-8 gap-1">
                                <CheckSquare className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only">تغيير الحالة</span>
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {Object.entries(statusText).map(([statusValue, statusLabel]) => (
                                 <DropdownMenuItem key={statusValue} onSelect={() => handleBulkUpdate({ status: statusValue as ShipmentStatus })}>
                                     {statusLabel}
                                 </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm" className="h-8 gap-1">
                                <Building className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only">تعيين شركة</span>
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {companies.map(company => (
                                <DropdownMenuItem key={company.id} onSelect={() => handleBulkUpdate({ assignedCompanyId: company.id })}>
                                    {company.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm" className="h-8 gap-1">
                                <User className="h-3.5 w-3.5" />
                                <span className="sr-only sm:not-sr-only">تعيين مندوب</span>
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                           {couriers.map(courier => (
                                <DropdownMenuItem key={courier.id} onSelect={() => handleBulkUpdate({ assignedCourierId: courier.id })}>
                                    {courier.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                     <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={handleBulkDelete}>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only">حذف</span>
                    </Button>
                 </div>
            )}
        </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-right">
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
                        <TableCell colSpan={columns.length}>
                            <Skeleton className="h-6 w-full" />
                        </TableCell>
                    </TableRow>
                ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-right">
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
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} من{" "}
          {table.getFilteredRowModel().rows.length} صفوف محددة.
        </div>
        <div className="space-x-2">
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
    </div>
  )
}
