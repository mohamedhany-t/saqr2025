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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import type { Shipment, ShipmentStatus, Governorate, Company, Courier } from "@/lib/types"
import { exportToExcel, exportToPDF } from "@/lib/export"
import { useFirestore } from "@/firebase"
import { doc, writeBatch, deleteDoc } from "firebase/firestore"
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


export const getColumns = (governorates: Governorate[]): ColumnDef<Shipment>[] => [
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
    accessorKey: "shipmentCode",
    header: "كود الشحنة",
    cell: ({ row }) => <div>{row.getValue("shipmentCode")}</div>,
  },
  {
    accessorKey: "recipientName",
    header: "المرسل إليه",
    cell: ({ row }) => (
        <div className="font-medium">{row.getValue("recipientName")}</div>
    ),
  },
    {
    accessorKey: "recipientPhone",
    header: "الهاتف",
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
    accessorKey: "totalAmount",
    header: () => <div className="text-start">الإجمالي</div>,
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
    accessorKey: "status",
    header: "الحالة",
    cell: ({ row }) => {
        const status = row.getValue("status") as ShipmentStatus;
        return (
            <Badge variant={statusVariants[status]} className="capitalize flex gap-2">
                {statusIcons[status]}
                <span>{status}</span>
            </Badge>
        )
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        تاريخ الإنشاء
        <ArrowUpDown className="ms-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
       const createdAt = row.getValue("createdAt") as any;
       if (!createdAt) return null;
       const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
       return <div>{date.toLocaleDateString("ar-EG")}</div>
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
            <DropdownMenuItem onClick={() => exportToPDF([shipment], getColumns(governorates).filter(c => c.id !== 'select' && c.id !== 'actions'))}><Printer className="me-2 h-4 w-4"/>طباعة</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]


export function ShipmentsTable({ shipments, isLoading, governorates }: { shipments: Shipment[], isLoading: boolean, governorates: Governorate[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  
  const columns = React.useMemo(() => getColumns(governorates), [governorates]);
  
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
    exportToExcel(dataToExport, columns.filter(c => c.id !== 'select' && c.id !== 'actions'), "shipments", governorates);
  }

  const governorateFilterValue = columnFilters.find(f => f.id === 'governorateId')?.value as string[] | undefined;

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
                {/* Filters will go here */}
            </div>
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
                 <div className="flex items-center gap-2">
                   {/* Bulk actions will go here */}
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
                    <TableHead key={header.id}>
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
                    <TableCell key={cell.id}>
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
