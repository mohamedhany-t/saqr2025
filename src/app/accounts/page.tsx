
"use client";
import React, { useState, useMemo, useEffect } from "react";
import type { Shipment, User, Company, CourierPayment, CompanyPayment, Governorate, ShipmentStatusConfig, ShipmentHistory } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2, Package, HandCoins, MinusCircle, ArrowDown, ArrowUp } from "lucide-react";
import { cn, formatToCairoTime } from "@/lib/utils";
import { exportToExcel } from "@/lib/export";
import { useCollection, useFirestore, useMemoFirebase, WithIdAndRef } from "@/firebase";
import { collection, query, collectionGroup } from "firebase/firestore";

type TransactionType = 'shipment' | 'payment' | 'custom_return';

type Transaction = {
    date: Date;
    description: string;
    type: TransactionType;
    debit: number;  // For Company: what admin owes them. For Courier: what they earn/get back.
    credit: number; // For Company: what they owe admin. For Courier: what they owe admin.
    balance: number;
    relatedId: string;
    status?: string;
    reason?: string;
};

const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || amount === 0) return '-';
    return new Intl.NumberFormat("ar-EG", {
        style: "currency",
        currency: "EGP",
    }).format(amount);
};

const transactionIcons: Record<TransactionType, React.ReactNode> = {
    shipment: <Package className="h-4 w-4 text-blue-500" />,
    payment: <HandCoins className="h-4 w-4 text-green-600" />,
    custom_return: <MinusCircle className="h-4 w-4 text-red-600" />
};

function AccountStatementsPage() {
    const firestore = useFirestore();

    const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]));
    const { data: history, isLoading: historyLoading } = useCollection<ShipmentHistory>(useMemoFirebase(() => firestore ? query(collectionGroup(firestore, 'history')) : null, [firestore]));
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? query(collection(firestore, 'governorates')) : null, [firestore]));
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]));
    const { data: users, isLoading: usersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]));
    const { data: courierPayments, isLoading: courierPaymentsLoading } = useCollection<CourierPayment>(useMemoFirebase(() => firestore ? query(collection(firestore, 'courier_payments')) : null, [firestore]));
    const { data: companyPayments, isLoading: companyPaymentsLoading } = useCollection<CompanyPayment>(useMemoFirebase(() => firestore ? query(collection(firestore, 'company_payments')) : null, [firestore]));
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]));
    
    const couriers = useMemo(() => users?.filter(u => u.role === 'courier') || [], [users]);
    const isLoading = shipmentsLoading || historyLoading || governoratesLoading || companiesLoading || usersLoading || courierPaymentsLoading || companyPaymentsLoading || statusesLoading;
    
    const [entityType, setEntityType] = useState<"courier" | "company">("courier");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [includeArchived, setIncludeArchived] = useState(false);

    const transactions = useMemo((): Transaction[] => {
        if (!selectedId || !shipments || !history || !courierPayments || !companyPayments || !statuses) return [];

        let rawTransactions: { date: Date, type: 'shipment' | 'payment', data: any }[] = [];

        if (entityType === 'courier') {
            const entityShipments = shipments.filter(s => s.assignedCourierId === selectedId);
            const entityPayments = courierPayments.filter(p => p.courierId === selectedId && (includeArchived || !p.isArchived));

            entityShipments.forEach(s => {
                const shipmentHistory = history.filter(h => h.ref.parent.parent?.id === s.id && (includeArchived || !s.isArchivedForCourier));
                shipmentHistory.forEach(h => {
                    const statusConfig = statuses.find(st => st.id === h.status);
                    if (statusConfig && statusConfig.affectsCourierBalance) {
                        rawTransactions.push({ date: h.updatedAt as Date, type: 'shipment', data: { shipment: s, history: h } });
                    }
                });
            });
            entityPayments.forEach(p => rawTransactions.push({ date: p.paymentDate as Date, type: 'payment', data: p }));

        } else { // company
            const entityShipments = shipments.filter(s => s.companyId === selectedId);
            const entityPayments = companyPayments.filter(p => p.companyId === selectedId && (includeArchived || !p.isArchived));

            entityShipments.forEach(s => {
                 const shipmentHistory = history.filter(h => h.ref.parent.parent?.id === s.id && (includeArchived || !s.isArchivedForCompany));
                 shipmentHistory.forEach(h => {
                     const statusConfig = statuses.find(st => st.id === h.status);
                     if (statusConfig && statusConfig.affectsCompanyBalance) {
                         rawTransactions.push({ date: h.updatedAt as Date, type: 'shipment', data: { shipment: s, history: h } });
                     }
                 });
            });
            entityPayments.forEach(p => rawTransactions.push({ date: p.paymentDate as Date, type: 'payment', data: p }));
        }
        
        rawTransactions = rawTransactions.filter(tx => tx.date); // Filter out transactions with invalid dates
        rawTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        let runningBalance = 0;
        const processedTransactions: Transaction[] = [];
        
        for (const rawTx of rawTransactions) {
            let credit = 0; // The entity owes admin (increases their debt)
            let debit = 0;  // The admin owes entity (decreases their debt)
            let description = '';
            let txType: TransactionType = 'shipment';
            let status, reason, relatedId;

            if (rawTx.type === 'shipment') {
                const s = rawTx.data.shipment as Shipment;
                const h = rawTx.data.history as WithIdAndRef<ShipmentHistory>;
                relatedId = `${s.id}-${h.id}`;
                status = h.status;
                reason = h.reason;
                description = `شحنة: ${s.recipientName} (${s.orderNumber}) - حالة: ${statuses.find(st => st.id === h.status)?.label || h.status}`;
                const statusConfig = statuses.find(st => st.id === h.status);
                
                if (statusConfig) {
                    if (entityType === 'courier') {
                        credit = statusConfig.requiresFullCollection ? s.totalAmount : (statusConfig.requiresPartialCollection ? (s.collectedAmount || 0) : 0);
                        debit = statusConfig.affectsCourierBalance ? (s.courierCommission || 0) : 0;
                         if (s.isCustomReturn && statusConfig.isDeliveredStatus) {
                            credit = -Math.abs(s.totalAmount);
                        }
                    } else { // company
                        debit = statusConfig.requiresFullCollection ? s.totalAmount : (statusConfig.requiresPartialCollection ? (s.collectedAmount || 0) : 0);
                        credit = statusConfig.affectsCompanyBalance ? (s.companyCommission || 0) : 0;
                        if (s.isCustomReturn && statusConfig.isDeliveredStatus) {
                            debit = -Math.abs(s.totalAmount);
                        }
                    }
                }
                if (s.isCustomReturn) txType = 'custom_return';
                
            } else { // payment
                const p = rawTx.data as (CourierPayment | CompanyPayment);
                relatedId = p.id;
                description = `دفعة ${p.notes ? `(${p.notes})` : ''}`;
                debit = p.amount;
                txType = 'payment';
            }
            
            if (entityType === 'courier') {
                runningBalance += (credit - debit);
            } else {
                 runningBalance += (debit - credit);
            }
            
            processedTransactions.push({
                date: rawTx.date,
                description,
                type: txType,
                credit,
                debit,
                balance: runningBalance,
                relatedId,
                status,
                reason
            });
        }
        
        // Final filter based on shipment status if selected
        const finalFiltered = statusFilter === 'all' 
            ? processedTransactions 
            : processedTransactions.filter(tx => tx.type === 'payment' || tx.status === statusFilter);

        return finalFiltered.reverse(); // Display newest first
    }, [selectedId, entityType, shipments, history, courierPayments, companyPayments, statuses, statusFilter, includeArchived]);

    const selectedEntity = entityType === 'courier' 
        ? couriers.find(c => c.id === selectedId)
        : companies?.find(c => c.id === selectedId);

    const handleExport = () => {
        if (!transactions || transactions.length === 0 || !selectedEntity) {
            return;
        }
        const reportHeader = {
            title: `كشف حساب: ${selectedEntity.name}`,
            date: `تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`
        };

        const reportColumns = [
          { accessorKey: "date", header: "التاريخ" },
          { accessorKey: "description", header: "البيان" },
          { accessorKey: "status", header: "الحالة" },
          { accessorKey: "reason", header: "السبب" },
          { accessorKey: "debit", header: entityType === 'courier' ? "مدين (له)" : "دائن (له)" },
          { accessorKey: "credit", header: entityType === 'courier' ? "دائن (عليه)" : "مدين (عليه)" },
          { accessorKey: "balance", header: "الرصيد" },
        ];
        
        const dataToExport = transactions.map(tx => ({
            date: formatToCairoTime(tx.date),
            description: tx.description,
            credit: formatCurrency(tx.credit),
            debit: formatCurrency(tx.debit),
            balance: formatCurrency(tx.balance),
            status: tx.status ? (statuses?.find(s => s.id === tx.status)?.label || tx.status) : 'دفعة',
            reason: tx.type === 'custom_return' ? `استرجاع مخصص - ${tx.reason || ''}`.trim() : tx.reason
        }));

        exportToExcel(dataToExport, reportColumns, `kashf_hisab_${selectedEntity.name?.replace(/\s/g, '_')}`, governorates || [], companies || [], couriers, reportHeader);
    }

    const finalBalance = transactions[0]?.balance || 0;
    let balanceDescription = '';
    let balanceClass = '';

    if (entityType === 'courier') {
        if (finalBalance > 0) {
            balanceDescription = 'مستحق على المندوب';
            balanceClass = 'text-destructive';
        } else if (finalBalance < 0) {
            balanceDescription = 'مستحق للمندوب';
            balanceClass = 'text-green-600';
        } else {
            balanceDescription = 'الحساب مُسوى';
        }
    } else { // company
        if (finalBalance > 0) {
            balanceDescription = 'مستحق للشركة';
            balanceClass = 'text-green-600';
        } else if (finalBalance < 0) {
            balanceDescription = 'مستحق على الشركة';
            balanceClass = 'text-destructive';
        } else {
            balanceDescription = 'الحساب مُسوى';
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <h1 className="text-3xl font-bold font-headline mb-2">كشوفات الحسابات المالية</h1>
            <p className="text-muted-foreground mb-6">
                اختر مندوبًا أو شركة لعرض كشف حساب تفصيلي بجميع معاملاته المالية.
            </p>

            <Card>
                <CardHeader>
                    <CardTitle>اختيار الحساب والفلترة</CardTitle>
                    <CardDescription>
                        حدد نوع الحساب، الاسم، وحالة الشحنات لعرض كشف حساب مخصص.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <RadioGroup defaultValue="courier" value={entityType} onValueChange={(value: "courier" | "company") => { setEntityType(value); setSelectedId(null); }} className="flex gap-4 md:col-span-1">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="courier" id="r-courier" />
                                <Label htmlFor="r-courier">مندوب</Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="company" id="r-company" />
                                <Label htmlFor="r-company">شركة</Label>
                            </div>
                        </RadioGroup>

                        <Select dir="rtl" onValueChange={setSelectedId} value={selectedId || ''}>
                            <SelectTrigger>
                                <SelectValue placeholder={`اختر ${entityType === 'courier' ? 'مندوبًا' : 'شركة'}...`} />
                            </SelectTrigger>
                            <SelectContent>
                                {entityType === 'courier' ?
                                    couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) :
                                    companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                                }
                            </SelectContent>
                        </Select>
                         <Select dir="rtl" onValueChange={setStatusFilter} value={statusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="فلترة حسب الحالة..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الحالات</SelectItem>
                                {statuses?.filter(s => s.enabled).map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <div className="flex items-center space-x-2 space-x-reverse justify-start">
                            <Checkbox id="include-archived" checked={includeArchived} onCheckedChange={(checked) => setIncludeArchived(!!checked)} />
                            <Label htmlFor="include-archived" className="cursor-pointer">إظهار الحركات المؤرشفة</Label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {selectedId && (
                 <Card className="mt-8">
                     <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <CardTitle>كشف حساب: {selectedEntity?.name}</CardTitle>
                             <div className="text-sm text-muted-foreground mt-1">
                                <span>الرصيد النهائي {balanceDescription} هو </span>
                                <Badge variant={finalBalance === 0 ? 'default' : 'secondary'} className={cn("mx-1 text-base", balanceClass)}>{formatCurrency(Math.abs(finalBalance))}</Badge>
                            </div>
                        </div>
                        <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
                            <FileUp className="me-2 h-4 w-4" />
                            تصدير إلى Excel
                        </Button>
                     </CardHeader>
                     <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>التاريخ</TableHead>
                                        <TableHead>البيان</TableHead>
                                        <TableHead className={cn("text-center", entityType === 'courier' ? "text-red-600" : "text-green-600")}>
                                            {entityType === 'courier' ? "دائن (عليه)" : "دائن (له)"}
                                        </TableHead>
                                        <TableHead className={cn("text-center", entityType === 'courier' ? "text-green-600" : "text-red-600")}>
                                             {entityType === 'courier' ? "مدين (له)" : "مدين (عليه)"}
                                        </TableHead>
                                        <TableHead className="text-center font-bold">الرصيد</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                                لا توجد حركات مالية تطابق الفلاتر المحددة.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {transactions.map((tx, index) => (
                                        <TableRow key={`${tx.relatedId}-${index}`}>
                                            <TableCell className="whitespace-nowrap">{formatToCairoTime(tx.date)}</TableCell>
                                            <TableCell className="max-w-xs truncate flex items-center gap-2">
                                                {transactionIcons[tx.type]}
                                                {tx.description}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-red-600">{formatCurrency(tx.credit)}</TableCell>
                                            <TableCell className="text-center font-mono text-green-600">{formatCurrency(tx.debit)}</TableCell>
                                            <TableCell className={cn("text-center font-mono font-bold", (entityType === 'courier' && tx.balance > 0) || (entityType === 'company' && tx.balance < 0) ? "text-red-700" : "text-green-700")}>{formatCurrency(tx.balance)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                     </CardContent>
                 </Card>
            )}
        </div>
    );
}

export default AccountStatementsPage;

    