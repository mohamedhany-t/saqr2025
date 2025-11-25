
"use client";
import React, { useState, useMemo } from "react";
import type { Shipment, User, Company, CourierPayment, CompanyPayment } from "@/lib/types";
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
    governorates: any[];
}

type Transaction = {
    date: Date;
    description: string;
    for: number; // Amount for the entity (e.g., commissions, payments made)
    against: number; // Amount against the entity (e.g., cash collected)
    balance: number;
    relatedId: string; // Shipment or Payment ID
};

const formatCurrency = (amount: number) => {
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

        let rawTransactions: { date: Date, type: string, data: any }[] = [];

        if (entityType === 'courier') {
            const courierShipments = shipments.filter(s => s.assignedCourierId === selectedId && s.paidAmount > 0);
            const payments = courierPayments.filter(p => p.courierId === selectedId);

            courierShipments.forEach(s => {
                rawTransactions.push({ date: s.updatedAt?.toDate() || new Date(), type: 'shipment', data: s });
            });
            payments.forEach(p => {
                rawTransactions.push({ date: p.paymentDate?.toDate() || new Date(), type: 'payment', data: p });
            });
        } else { // company
            const companyShipments = shipments.filter(s => s.companyId === selectedId && s.paidAmount > 0);
            const payments = companyPayments.filter(p => p.companyId === selectedId);
            
            companyShipments.forEach(s => {
                rawTransactions.push({ date: s.updatedAt?.toDate() || new Date(), type: 'shipment', data: s });
            });
            payments.forEach(p => {
                 rawTransactions.push({ date: p.paymentDate?.toDate() || new Date(), type: 'payment', data: p });
            });
        }

        rawTransactions.sort((a, b) => a.date.getTime() - b.date.getTime()); // Sort oldest to newest

        let runningBalance = 0;
        const processedTransactions: Transaction[] = [];
        
        for (const rawTx of rawTransactions) {
            let amountFor = 0;
            let amountAgainst = 0;
            let description = '';
            let relatedId = '';

            if (entityType === 'courier') {
                if (rawTx.type === 'shipment') {
                    const s = rawTx.data as Shipment;
                    // The courier owes the collected amount
                    amountAgainst = s.paidAmount || 0;
                    // The courier earns their commission
                    amountFor = s.courierCommission || 0;
                    runningBalance = runningBalance + amountAgainst - amountFor;
                    description = `تسليم شحنة ${s.recipientName} (رقم: ${s.trackingNumber})`;
                    relatedId = s.id;
                } else { // payment
                    const p = rawTx.data as CourierPayment;
                    // The courier paid money, so it's a credit for them (reduces their due amount)
                    amountFor = p.amount;
                    amountAgainst = 0;
                    runningBalance = runningBalance - amountFor;
                    description = `دفعة مُسددة${p.notes ? ` (${p.notes})` : ''}`;
                    relatedId = p.id;
                }
            } else { // company
                 if (rawTx.type === 'shipment') {
                    const s = rawTx.data as Shipment;
                    // The company earns the shipment revenue
                    amountFor = s.paidAmount || 0;
                    // The system's commission is a debit from the company's balance
                    amountAgainst = s.companyCommission || 0;
                    runningBalance = runningBalance + amountFor - amountAgainst;
                    description = `إيراد شحنة ${s.recipientName} (رقم: ${s.trackingNumber})`;
                    relatedId = s.id;
                 } else { // payment
                    const p = rawTx.data as CompanyPayment;
                    // Admin paid the company, so it's a debit from the balance due to them
                    amountFor = 0;
                    amountAgainst = p.amount;
                    runningBalance = runningBalance - amountAgainst;
                    description = `دفعة مُستلمة من الإدارة${p.notes ? ` (${p.notes})` : ''}`;
                    relatedId = p.id;
                 }
            }
             processedTransactions.push({ date: rawTx.date, description, for: amountFor, against: amountAgainst, balance: runningBalance, relatedId });
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
          { accessorKey: "against", header: "عليه (مطالبات)" },
          { accessorKey: "for", header: "له (مستحقات)" },
          { accessorKey: "balance", header: "الرصيد" },
        ];
        
        const dataToExport = transactions.map(tx => ({
            ...tx,
            date: format(tx.date, 'PPpp', { locale: ar }),
            against: formatCurrency(tx.against),
            for: formatCurrency(tx.for),
            balance: formatCurrency(tx.balance),
        }));

        exportToExcel(dataToExport, reportColumns, `kashf_hisab_${selectedEntity.name?.replace(/\s/g, '_')}`, governorates, companies, couriers);
    }

    const finalBalance = transactions[0]?.balance || 0;
    const balanceDescription = entityType === 'courier' 
        ? (finalBalance >= 0 ? 'مستحق على المندوب' : 'مستحق للمندوب') 
        : (finalBalance >= 0 ? 'مستحق للشركة' : 'مستحق على الشركة');

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
                                    <TableHead className="text-center text-destructive">عليه (مطالبات)</TableHead>
                                    <TableHead className="text-center text-green-600">له (مستحقات)</TableHead>
                                    <TableHead className="text-center">الرصيد</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                                            لا توجد حركات مالية لعرضها لهذا الحساب.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {transactions.map((tx, index) => (
                                    <TableRow key={`${tx.relatedId}-${index}`}>
                                        <TableCell>{format(tx.date, 'PPpp', { locale: ar })}</TableCell>
                                        <TableCell className="max-w-xs truncate">{tx.description}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(tx.against)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(tx.for)}</TableCell>
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
