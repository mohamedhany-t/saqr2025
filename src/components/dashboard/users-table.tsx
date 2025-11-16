

"use client"
import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { MoreHorizontal, User as UserIcon, Building, Truck, Pencil, Trash2, BadgeDollarSign } from "lucide-react"

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
import type { User, Role } from "@/lib/types"
import { Skeleton } from "../ui/skeleton"

const roleIcons: Record<Role, React.ReactNode> = {
    admin: <UserIcon className="h-4 w-4 text-red-500" />,
    company: <Building className="h-4 w-4 text-blue-500" />,
    courier: <Truck className="h-4 w-4 text-green-500" />,
}

const roleText: Record<Role, string> = {
    admin: "مسؤول",
    company: "شركة شحن",
    courier: "مندوب",
}

const roleVariants: Record<Role, "default" | "secondary" | "destructive" | "outline"> = {
    admin: "destructive",
    company: "secondary",
    courier: "outline",
}

export const getColumns = (onEdit: (user: User) => void): ColumnDef<User>[] => [
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
    accessorKey: "commissionRate",
    header: "العمولة",
    cell: ({ row }) => {
        const user = row.original;
        if (user.role === 'courier') {
            const rate = user.commissionRate || 0;
            return <Badge variant="outline" className="flex items-center gap-1">
                <BadgeDollarSign className="h-3.5 w-3.5 text-primary"/>
                <span>{rate.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span>
            </Badge>
        }
        return <div className="text-muted-foreground text-center">N/A</div>;
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
    cell: ({ row }) => {
      const user = row.original;
       if (user.role === 'admin' && user.email === 'mhanyt21@gmail.com') {
        return null; // Cannot edit the main admin
      }
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
            <DropdownMenuItem onClick={() => onEdit(user)}>
                <Pencil className="me-2 h-4 w-4" /> تعديل
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
                <Trash2 className="me-2 h-4 w-4" /> حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]


export function UsersTable({ users, isLoading, onEdit }: { users: User[], isLoading: boolean, onEdit: (user: User) => void }) {
  
  const columns = React.useMemo(() => getColumns(onEdit), [onEdit]);
  
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
