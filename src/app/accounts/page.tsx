
"use client";
import React, { useState, useMemo } from "react";
import type { Shipment, User, Company, CourierPayment, CompanyPayment, Governorate } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUp, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { exportToExcel } from "@/lib/export";

interface AccountStatementsPageProps {
    couriers: User[];
    companies: Company[];
    shipments: Shipment[];
    courierPayments: CourierPayment[];
    companyPayments: CompanyPayment[];
    governorates: Governorate[];
}

type Transaction = {
    date: Date;
    description: string;
    totalAmount?: number;
    paidAmount?: number;
    courierCommission?: number;
    companyCommission?: number;
    netDue: number; // Positive if courier/company owes money, negative if they are owed money.
    balance: number;
    relatedId: string; // Shipment or Payment ID
};

const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return 'N/A';
    return new Intl.NumberFormat("ar-EG", {
        style: "currency",
        currency: "EGP",
    }).format(amount);
};

export default function AccountStatementsPage({ couriers, companies, shipments, courierPayments, companyPayments, governorates }: AccountStatementsPageProps) {
    const [entityType, setEntityType] = useState<"courier" | "company">("courier");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const transactions = useMemo((): Transaction[] => {
        if (!selectedId) return [];

        let rawTransactions: { date: Date, type: 'shipment' | 'payment', data: any }[] = [];
        let entityShipments: Shipment[];
        let entityPayments: (CourierPayment | CompanyPayment)[];

        if (entityType === 'courier') {
            entityShipments = shipments.filter(s => s.assignedCourierId === selectedId && (s.paidAmount || 0) > 0);
            entityPayments = courierPayments.filter(p => p.courierId === selectedId);
        } else { // company
            entityShipments = shipments.filter(s => s.companyId === selectedId && (s.paidAmount || 0) > 0);
            entityPayments = companyPayments.filter(p => p.companyId === selectedId);
        }
        
        entityShipments.forEach(s => {
            if (s.updatedAt?.toDate) {
                rawTransactions.push({ date: s.updatedAt.toDate(), type: 'shipment', data: s });
            }
        });
        entityPayments.forEach(p => {
             if (p.paymentDate?.toDate) {
                rawTransactions.push({ date: p.paymentDate.toDate(), type: 'payment', data: p });
             }
        });

        rawTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

        let runningBalance = 0;
        const processedTransactions: Transaction[] = [];
        
        for (const rawTx of rawTransactions) {
            let tx: Partial<Transaction> = {
                date: rawTx.date,
                relatedId: rawTx.data.id,
            };

            if (entityType === 'courier') {
                if (rawTx.type === 'shipment') {
                    const s = rawTx.data as Shipment;
                    tx.description = `شحنة: ${s.recipientName} (${s.trackingNumber})`;
                    tx.totalAmount = s.totalAmount || 0;
                    tx.paidAmount = s.paidAmount || 0;
                    tx.courierCommission = s.courierCommission || 0;
                    // Net due for THIS shipment is what the courier collected minus their commission.
                    tx.netDue = tx.paidAmount - tx.courierCommission;
                    runningBalance += tx.netDue;
                } else { // payment
                    const p = rawTx.data as CourierPayment;
                    tx.description = `دفعة مُسددة ${p.notes ? `(${p.notes})` : ''}`;
                    // The courier paid money, so it reduces their due amount.
                    tx.netDue = -p.amount;
                    runningBalance += tx.netDue;
                }
            } else { // company
                 if (rawTx.type === 'shipment') {
                    const s = rawTx.data as Shipment;
                    tx.description = `شحنة: ${s.recipientName} (${s.trackingNumber})`;
                    tx.totalAmount = s.totalAmount || 0;
                    tx.paidAmount = s.paidAmount || 0;
                    tx.companyCommission = s.companyCommission || 0;
                    // Net due for THIS shipment is the revenue for the company minus the system's commission.
                    tx.netDue = tx.paidAmount - tx.companyCommission;
                    runningBalance += tx.netDue;
                 } else { // payment
                    const p = rawTx.data as CompanyPayment;
                    tx.description = `دفعة مُستلمة ${p.notes ? `(${p.notes})` : ''}`;
                    // Admin paid the company, so it reduces the balance owed TO them.
                    tx.netDue = -p.amount;
                    runningBalance += tx.netDue;
                 }
            }
            tx.balance = runningBalance;
            processedTransactions.push(tx as Transaction);
        }

        return processedTransactions.reverse(); // Display newest first

    }, [selectedId, entityType, shipments, courierPayments, companyPayments]);

    const selectedEntity = entityType === 'courier' 
        ? couriers.find(c => c.id === selectedId)
        : companies.find(c => c.id === selectedId);

    const handleExport = () => {
        if (!transactions || transactions.length === 0 || !selectedEntity) {
            return;
        }

        const reportColumns = [
          { accessorKey: "date", header: "التاريخ" },
          { accessorKey: "description", header: "البيان" },
          { accessorKey: "totalAmount", header: "إجمالي الشحنة" },
          { accessorKey: "paidAmount", header: "المبلغ المحصَّل" },
          { accessorKey: "courierCommission", header: `عمولة ${entityType === 'courier' ? 'المندوب' : 'الشركة'}` },
          { accessorKey: "netDue", header: "صافي المستحق" },
          { accessorKey: "balance", header: "الرصيد التراكمي" },
        ];
        
        const dataToExport = transactions.map(tx => ({
            date: format(tx.date, 'PPpp', { locale: ar }),
            description: tx.description,
            totalAmount: tx.totalAmount !== undefined ? formatCurrency(tx.totalAmount) : '-',
            paidAmount: tx.paidAmount !== undefined ? formatCurrency(tx.paidAmount) : '-',
            courierCommission: tx.courierCommission !== undefined ? formatCurrency(tx.courierCommission) : '-',
            companyCommission: tx.companyCommission !== undefined ? formatCurrency(tx.companyCommission) : '-',
            netDue: formatCurrency(tx.netDue),
            balance: formatCurrency(tx.balance)
        }));

        exportToExcel(dataToExport, reportColumns, `kashf_hisab_${selectedEntity.name?.replace(/\s/g, '_')}`, governorates, companies, couriers);
    }

    const finalBalance = transactions[0]?.balance || 0;
    let balanceDescription = '';
    if (entityType === 'courier') {
        balanceDescription = finalBalance > 0 ? 'مستحق على المندوب' : (finalBalance < 0 ? 'مستحق للمندوب' : 'الحساب مُسوى');
    } else { // company
        balanceDescription = finalBalance > 0 ? 'مستحق للشركة' : (finalBalance < 0 ? 'مستحق على الشركة' : 'الحساب مُسوى');
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <h1 className="text-3xl font-bold font-headline mb-2">كشوفات الحسابات المالية</h1>
            <p className="text-muted-foreground mb-6">
                اختر مندوبًا أو شركة لعرض كشف حساب تفصيلي بجميع معاملاته المالية.
            </p>

            <Card>
                <CardHeader>
                    <CardTitle>اختيار الحساب</CardTitle>
                    <CardDescription>
                        حدد نوع الحساب (مندوب أو شركة) ثم اختر الاسم من القائمة.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <RadioGroup defaultValue="courier" value={entityType} onValueChange={(value: "courier" | "company") => { setEntityType(value); setSelectedId(null); }} className="flex gap-4">
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
                                    companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                                }
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {selectedId && (
                 <Card className="mt-8">
                     <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <CardTitle>كشف حساب: {selectedEntity?.name}</CardTitle>
                             <div className="text-sm text-muted-foreground">
                                <span>الرصيد النهائي {balanceDescription} هو </span>
                                <Badge variant={finalBalance > 0 ? 'destructive' : 'default'} className="mx-1">{formatCurrency(Math.abs(finalBalance))}</Badge>
                            </div>
                        </div>
                        <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
                            <FileUp className="me-2 h-4 w-4" />
                            تصدير إلى Excel
                        </Button>
                     </CardHeader>
                     <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>البيان</TableHead>
                                    <TableHead className="text-center">إجمالي الشحنة</TableHead>
                                    <TableHead className="text-center">المبلغ المحصَّل</TableHead>
                                    <TableHead className="text-center">العمولة</TableHead>
                                    <TableHead className="text-center font-bold">صافي المستحق</TableHead>
                                    <TableHead className="text-center">الرصيد</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                            لا توجد حركات مالية لعرضها لهذا الحساب.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {transactions.map((tx, index) => (
                                    <TableRow key={`${tx.relatedId}-${index}`}>
                                        <TableCell>{format(tx.date, 'PP', { locale: ar })}</TableCell>
                                        <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(tx.totalAmount)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(tx.paidAmount)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(entityType === 'courier' ? tx.courierCommission : tx.companyCommission)}</TableCell>
                                        <TableCell className={`text-center font-mono font-bold ${tx.netDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(tx.netDue)}</TableCell>
                                        <TableCell className="text-center font-mono font-bold">{formatCurrency(tx.balance)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                     </CardContent>
                 </Card>
            )}
        </div>
    );
}
