
"use client"
import * as React from "react"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
} from "@tanstack/react-table"
import { MoreHorizontal, User as UserIcon, Building, Truck, Pencil, Trash2, BadgeDollarSign, ShieldQuestion } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { User, Role, Company } from "@/lib/types"
import { Skeleton } from "../ui/skeleton"
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { Card, CardContent } from "../ui/card"
import { formatToCairoTime } from "@/lib/utils"

const roleIcons: Record<Role, React.ReactNode> = {
    admin: <UserIcon className="h-4 w-4 text-red-500" />,
    company: <Building className="h-4 w-4 text-blue-500" />,
    courier: <Truck className="h-4 w-4 text-green-500" />,
    "customer-service": <ShieldQuestion className="h-4 w-4 text-indigo-500" />,
}

const roleText: Record<Role, string> = {
    admin: "مسؤول",
    company: "شركة شحن",
    courier: "مندوب",
    "customer-service": "خدمة عملاء",
}

const roleVariants: Record<Role, "default" | "secondary" | "destructive" | "outline"> = {
    admin: "destructive",
    company: "secondary",
    courier: "outline",
    "customer-service": "default",
}


export const UserCard = ({ user, company, onEdit, onDelete }: { user: User, company?: Company, onEdit: (user: User, company?: Company) => void, onDelete: (user: User) => void }) => {
    const { name, email, role, avatarUrl, commissionRate } = user;
    const canBeDeleted = !(role === 'admin' && email === 'mhanyt21@gmail.com');
    return (
        <Card>
            <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Avatar>
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback>{name ? name.charAt(0) : email.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold">{name}</span>
                        <span className="text-sm text-muted-foreground">{email}</span>
                        <div className="mt-1 flex items-center gap-2">
                             <Badge variant={roleVariants[role]} className="capitalize flex gap-2 text-xs">
                                {roleIcons[role]}
                                <span>{roleText[role]}</span>
                            </Badge>
                             {role === 'courier' && commissionRate !== undefined && (
                                <Badge variant="outline" className="flex items-center gap-1 text-xs">
                                    <BadgeDollarSign className="h-3 w-3 text-primary"/>
                                    <span>{commissionRate.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span>
                                </Badge>
                             )}
                        </div>
                    </div>
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">فتح القائمة</span>
                        <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>إجراءات</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(user, company)}>
                            <Pencil className="me-2 h-4 w-4" /> تعديل
                        </DropdownMenuItem>
                        {canBeDeleted && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-100" onClick={() => onDelete(user)}>
                                    <Trash2 className="me-2 h-4 w-4" /> حذف
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardContent>
        </Card>
    )
}

const getColumns = (onEdit: (user: User, company?: Company) => void, onDelete: (user: User) => void, companies: Company[]): ColumnDef<User>[] => [
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
        if (user.role === 'company') {
            return <Badge variant="secondary">لكل محافظة</Badge>
        }
        return <div className="text-muted-foreground text-center">--</div>;
    },
  },
  {
    accessorKey: "createdAt",
    header: "تاريخ الإنشاء",
    cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as any;
        return <div>{formatToCairoTime(createdAt)}</div>;
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const user = row.original;
       if (user.role === 'admin' && user.email === 'mhanyt21@gmail.com') {
        return null; // Cannot edit or delete the main admin
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
            <DropdownMenuItem onClick={() => {
                const companyDetails = user.role === 'company' ? companies.find(c => c.id === user.id) : undefined;
                onEdit(user, companyDetails);
            }}>
                <Pencil className="me-2 h-4 w-4" /> تعديل
            </DropdownMenuItem>
             <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-100" onClick={() => onDelete(user)}>
                <Trash2 className="me-2 h-4 w-4" /> حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]


export function UsersTable({ users, listIsLoading, onEdit, onDelete, searchTerm }: { users: User[], listIsLoading: boolean, onEdit: (user: User, company?: Company) => void, onDelete: (user: User) => void, searchTerm: string }) {
  const [sorting, setSorting] = React.useState<SortingState>([])

  const firestore = useFirestore();
  const companiesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'companies');
  }, [firestore]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);
  
  const columns = React.useMemo(() => getColumns(onEdit, onDelete, companies || []), [onEdit, onDelete, companies]);

  const filteredUsers = React.useMemo(() => {
    if (!searchTerm) return users;
    const lowercasedTerm = searchTerm.toLowerCase();
    return users.filter(user => 
        user.name?.toLowerCase().includes(lowercasedTerm) ||
        user.email.toLowerCase().includes(lowercasedTerm)
    );
  }, [users, searchTerm]);
  
  const table = useReactTable({
    data: filteredUsers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
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
            {listIsLoading || companiesLoading ? (
                Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                         {columns.map(col => <TableCell key={(col as any).id || (col as any).accessorKey}><Skeleton className="h-6 w-full" /></TableCell>)}
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
                  {searchTerm ? "لا يوجد مستخدمون يطابقون بحثك." : "لا يوجد مستخدمون."}
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
