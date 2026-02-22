
"use client";
import React, { useState, useMemo } from 'react';
import type { Expense, User } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash2, Pencil, Wallet, CalendarDays, Users, Truck, Search, FileUp } from 'lucide-react';
import { formatToCairoTime } from '@/lib/utils';
import { ExpenseFormSheet } from '@/components/expenses/expense-form-sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { expenseCategories, expenseEntities } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ar } from 'date-fns/locale';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/export';


export default function ExpensesPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Filters state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedCourier, setSelectedCourier] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const expensesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'expenses'), orderBy('expenseDate', 'desc')) : null, [firestore]);
  const { data: expenses, isLoading: expensesLoading } = useCollection<Expense>(expensesQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const courierUsers = useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];

    return expenses.filter(exp => {
      // Date filter
      const expenseDate = exp.expenseDate instanceof Date 
        ? exp.expenseDate 
        : exp.expenseDate?.toDate();
      if (!expenseDate) return false;
      if (dateRange?.from && expenseDate < startOfDay(dateRange.from)) return false;
      if (dateRange?.to && expenseDate > endOfDay(dateRange.to)) return false;

      // Courier filter
      if (selectedCourier !== 'all' && exp.relatedUserId !== selectedCourier) return false;

      // Category filter
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) return false;

      // Search term filter
      const lowerSearchTerm = searchTerm.toLowerCase();
      if (searchTerm && !(
          exp.description.toLowerCase().includes(lowerSearchTerm) ||
          (exp.notes && exp.notes.toLowerCase().includes(lowerSearchTerm))
      )) return false;

      return true;
    });
  }, [expenses, dateRange, selectedCourier, selectedCategory, searchTerm]);

  const openExpenseForm = (expense?: Expense) => {
    setEditingExpense(expense);
    setIsSheetOpen(true);
  };

  const handleSaveExpense = async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>, id?: string) => {
    if (!firestore || !currentUser) return;
    try {
      // Clean the data to remove any undefined fields before sending to Firestore
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));

      if (id) {
        const expenseDocRef = doc(firestore, 'expenses', id);
        await updateDoc(expenseDocRef, { ...cleanData, updatedAt: serverTimestamp() });
        toast({ title: "تم تحديث المصروف بنجاح" });
      } else {
        const expensesCollectionRef = collection(firestore, 'expenses');
        await addDoc(expensesCollectionRef, { 
          ...cleanData, 
          createdBy: currentUser.uid, 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "تم إضافة المصروف بنجاح" });
      }
      setIsSheetOpen(false);
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    }
  };

  const handleDeleteExpense = async () => {
    if (!firestore || !expenseToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'expenses', expenseToDelete.id));
      toast({ title: "تم حذف المصروف" });
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({ title: "حدث خطأ أثناء الحذف", variant: "destructive" });
    } finally {
        setExpenseToDelete(null);
    }
  };
  
  const stats = useMemo(() => {
    if (!expenses) return { today: 0, month: 0, byCourier: {}, totalShipping: 0 };
    const today = new Date();
    const startOfThisMonth = startOfMonth(today);
    const endOfThisMonth = endOfMonth(today);
    const startOfThisDay = startOfDay(today);
    const endOfThisDay = endOfDay(today);

    let todayTotal = 0;
    let monthTotal = 0;
    let byCourier: Record<string, number> = {};
    let totalShipping = 0;

    expenses.forEach(exp => {
      // Handle both JS Date and Firestore Timestamp objects
      const expenseDate = exp.expenseDate instanceof Date 
        ? exp.expenseDate 
        : exp.expenseDate?.toDate();

      if (!expenseDate) return;

      if (expenseDate >= startOfThisDay && expenseDate <= endOfThisDay) {
        todayTotal += exp.amount;
      }
      if (expenseDate >= startOfThisMonth && expenseDate <= endOfThisMonth) {
        monthTotal += exp.amount;
      }
      if (exp.entityType === 'courier' && exp.relatedUserId) {
        byCourier[exp.relatedUserId] = (byCourier[exp.relatedUserId] || 0) + exp.amount;
      }
      if (exp.category === 'transport' || exp.category === 'parking') {
        totalShipping += exp.amount;
      }
    });

    return {
      today: todayTotal,
      month: monthTotal,
      byCourier,
      totalShipping,
    };
  }, [expenses]);
  
  const handleExport = () => {
    if (filteredExpenses.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير" });
      return;
    }
    const dataToExport = filteredExpenses.map(exp => ({
        date: formatToCairoTime(exp.expenseDate),
        entity: expenseEntities[exp.entityType],
        courier: exp.entityType === 'courier' ? users?.find(u => u.id === exp.relatedUserId)?.name : 'N/A',
        category: expenseCategories[exp.category],
        amount: exp.amount,
        notes: exp.notes
    }));
    const columns = [
        { accessorKey: "date", header: "التاريخ" },
        { accessorKey: "entity", header: "الجهة" },
        { accessorKey: "courier", header: "المندوب" },
        { accessorKey: "category", header: "النوع" },
        { accessorKey: "amount", header: "القيمة" },
        { accessorKey: "notes", header: "ملاحظات" },
    ];
    exportToExcel(dataToExport, columns, "expenses_report", [], [], []);
  }


  const formatCurrency = (amount: number) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-headline">إدارة المصروفات</h1>
        <Button onClick={() => openExpenseForm()}>
          <PlusCircle className="me-2 h-4 w-4" />
          إضافة مصروف جديد
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">مصاريف اليوم</CardTitle><CalendarDays className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.today)}</div></CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">مصاريف الشهر الحالي</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.month)}</div></CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">مصاريف المناديب (الإجمالية)</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(Object.values(stats.byCourier).reduce((a,b) => a+b, 0))}</div></CardContent>
        </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">مصاريف الشحن</CardTitle><Truck className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalShipping)}</div></CardContent>
        </Card>
      </div>

       <Card className="mb-6">
        <CardHeader>
          <CardTitle>الفلترة والبحث</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={`w-full md:w-[300px] justify-start text-left font-normal ${!dateRange && "text-muted-foreground"}`}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y", { locale: ar })} -{" "}
                        {format(dateRange.to, "LLL dd, y", { locale: ar })}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>اختر فترة</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ar}
                />
              </PopoverContent>
            </Popover>
             <Select value={selectedCourier} onValueChange={setSelectedCourier}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="حسب المندوب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المناديب</SelectItem>
                {courierUsers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="حسب النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                 {Object.entries(expenseCategories).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="بحث في الوصف والملاحظات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                />
            </div>
             <Button onClick={handleExport} variant="outline">
                <FileUp className="me-2 h-4 w-4" />
                تصدير إلى Excel
            </Button>
        </CardContent>
       </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل المصروفات</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الجهة</TableHead>
                <TableHead>المندوب</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>القيمة</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expensesLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center">جاري تحميل البيانات...</TableCell></TableRow>
              ) : filteredExpenses.length > 0 ? (
                filteredExpenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatToCairoTime(expense.expenseDate)}</TableCell>
                    <TableCell>{expenseEntities[expense.entityType]}</TableCell>
                    <TableCell>{expense.entityType === 'courier' ? users?.find(u => u.id === expense.relatedUserId)?.name : 'N/A'}</TableCell>
                    <TableCell>{expenseCategories[expense.category]}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell className="max-w-xs truncate">{expense.notes}</TableCell>
                    <TableCell>
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">فتح القائمة</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openExpenseForm(expense)}>
                                <Pencil className="me-2 h-4 w-4" /> تعديل
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setExpenseToDelete(expense)}>
                                <Trash2 className="me-2 h-4 w-4" /> حذف
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="h-24 text-center">لا توجد مصروفات تطابق الفلاتر.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <ExpenseFormSheet
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        expense={editingExpense}
        onSave={handleSaveExpense}
        couriers={courierUsers}
      />
      
      <AlertDialog open={!!expenseToDelete} onOpenChange={() => setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا المصروف بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpense} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
