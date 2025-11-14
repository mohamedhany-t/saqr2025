"use client"
import * as React from "react"
import {
  CaretSortIcon,
  ChevronDownIcon,
  DotsHorizontalIcon,
} from "@radix-ui/react-icons"
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
    Archive
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
import type { Shipment, ShipmentStatus } from "@/lib/types"

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


export const columns: ColumnDef<Shipment>[] = [
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
    accessorKey: "governorate",
    header: "المحافظة",
    cell: ({ row }) => <div>{row.getValue("governorate")}</div>,
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
        <CaretSortIcon className="ms-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>{new Date(row.getValue("createdAt")).toLocaleDateString("ar-EG")}</div>
    ),
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
              <DotsHorizontalIcon className="h-4 w-4" />
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
            <DropdownMenuItem><Printer className="me-2 h-4 w-4"/>طباعة</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]


export function ShipmentsTable({ shipments }: { shipments: Shipment[] }) {
  const [data, setData] = React.useState(() => [...shipments]);
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data,
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

  return (
    <div className="w-full">
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
            {table.getRowModel().rows?.length ? (
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
                  لا توجد نتائج.
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
