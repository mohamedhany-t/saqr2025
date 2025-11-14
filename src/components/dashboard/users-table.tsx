
"use client"
import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { MoreHorizontal, User as UserIcon, Building, Truck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User, Role, Company } from "@/lib/types"
import { Skeleton } from "../ui/skeleton"

const roleIcons: Record<Role, React.ReactNode> = {
    admin: <UserIcon className="h-4 w-4 text-red-500" />,
    company: <Building className="h-4 w-4 text-blue-500" />,
    courier: <Truck className="h-4 w-4 text-green-500" />,
}

const roleText: Record<Role, string> = {
    admin: "مسؤول",
    company: "شركة",
    courier: "مندوب",
}

const roleVariants: Record<Role, "default" | "secondary" | "destructive" | "outline"> = {
    admin: "destructive",
    company: "secondary",
    courier: "outline",
}

export const getColumns = (companies: Company[], deliveryCompanies: Company[]): ColumnDef<User>[] => [
  {
    accessorKey: "name",
    header: "الاسم",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar>
            <AvatarImage src={row.original.avatarUrl} />
            <AvatarFallback>{row.original.name ? row.original.name.charAt(0) : row.original.email.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
            <span className="font-medium">{row.original.name || 'N/A'}</span>
            <span className="text-sm text-muted-foreground">{row.original.email}</span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "role",
    header: "الدور",
    cell: ({ row }) => {
        const role = row.getValue("role") as Role;
        if (!role) return null;
        return (
            <Badge variant={roleVariants[role]} className="capitalize flex gap-2">
                {roleIcons[role]}
                <span>{roleText[role]}</span>
            </Badge>
        )
    },
  },
  {
    accessorKey: "companyName",
    header: "الشركة",
    cell: ({ row }) => {
        const user = row.original;
        if (user.role === 'company') {
            return <div>{user.companyName || 'N/A'}</div>;
        }
        if (user.role === 'courier') {
            const deliveryCompany = deliveryCompanies.find(dc => dc.id === user.deliveryCompanyId);
            return <div>{deliveryCompany?.name || 'N/A'}</div>
        }
        return <div>N/A</div>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "تاريخ الإنشاء",
    cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as any;
        if (!createdAt) return 'N/A';
        const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        return <div>{date.toLocaleDateString("ar-EG")}</div>
    }
  },
  {
    id: "actions",
    cell: () => {
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
            <DropdownMenuItem disabled>تعديل</DropdownMenuItem>
            <DropdownMenuItem disabled>حذف</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]


export function UsersTable({ users, isLoading, companies, deliveryCompanies }: { users: User[], isLoading: boolean, companies: Company[], deliveryCompanies: Company[] }) {
  
  const columns = React.useMemo(() => getColumns(companies, deliveryCompanies), [companies, deliveryCompanies]);
  
  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
            {isLoading ? (
                Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={columns.length}>
                            <Skeleton className="h-6 w-full" />
                        </TableCell>
                    </TableRow>
                ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
                  لا يوجد مستخدمون.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
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

    