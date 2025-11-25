
"use client";
import React, { useState, useMemo } from "react";
import type { Shipment, User, Company, CourierPayment, CompanyPayment } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface AccountStatementsPageProps {
    couriers: User[];
    companies: Company[];
    shipments: Shipment[];
    courierPayments: CourierPayment[];
    companyPayments: CompanyPayment[];
}

type Transaction = {
    date: Date;
    description: string;
    debit: number; // For the entity (courier/company)
    credit: number; // For the entity (courier/company)
    balance: number;
    relatedId: string; // Shipment or Payment ID
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-EG", {
        style: "currency",
        currency: "EGP",
    }).format(amount);
};

export default function AccountStatementsPage({ couriers, companies, shipments, courierPayments, companyPayments }: AccountStatementsPageProps) {
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

        rawTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());

        let runningBalance = 0;
        const processedTransactions: Transaction[] = [];

        // We process in reverse (oldest to newest) to calculate running balance correctly
        // but will display newest to oldest. So we build the list and then reverse it.
        const reversedRaw = [...rawTransactions].reverse();
        
        for (const rawTx of reversedRaw) {
            let debit = 0;
            let credit = 0;
            let description = '';
            let relatedId = '';

            if (entityType === 'courier') {
                if (rawTx.type === 'shipment') {
                    const s = rawTx.data as Shipment;
                    debit = s.paidAmount || 0; // Courier collected money, so it's a debit for them
                    credit = s.courierCommission || 0; // Commission is a credit for the courier
                    runningBalance = runningBalance + debit - credit;
                    description = `تسليم شحنة ${s.recipientName} (رقم: ${s.trackingNumber})`;
                    relatedId = s.id;
                } else { // payment
                    const p = rawTx.data as CourierPayment;
                    debit = 0;
                    credit = p.amount; // Courier paid money, so it's a credit for them
                    runningBalance = runningBalance - credit;
                    description = `دفعة مسجلة${p.notes ? ` (${p.notes})` : ''}`;
                    relatedId = p.id;
                }
            } else { // company
                 if (rawTx.type === 'shipment') {
                    const s = rawTx.data as Shipment;
                    debit = s.companyCommission || 0; // The company's commission is a debit from the system's perspective
                    credit = s.paidAmount || 0; // The revenue from the shipment is a credit to the company
                    runningBalance = runningBalance + credit - debit;
                    description = `إيراد شحنة ${s.recipientName} (رقم: ${s.trackingNumber})`;
                    relatedId = s.id;
                 } else { // payment
                    const p = rawTx.data as CompanyPayment;
                    debit = p.amount; // Admin paid the company, so it's a debit from their balance
                    credit = 0;
                    runningBalance = runningBalance - debit;
                    description = `دفعة مسجلة من الإدارة${p.notes ? ` (${p.notes})` : ''}`;
                    relatedId = p.id;
                 }
            }
             processedTransactions.push({ date: rawTx.date, description, debit, credit, balance: runningBalance, relatedId });
        }


        return processedTransactions.reverse();

    }, [selectedId, entityType, shipments, courierPayments, companyPayments]);

    const selectedEntity = entityType === 'courier' 
        ? couriers.find(c => c.id === selectedId)
        : companies.find(c => c.id === selectedId);

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
                     <CardHeader>
                         <CardTitle>كشف حساب: {selectedEntity?.name}</CardTitle>
                         <CardDescription>
                             الرصيد النهائي المستحق {entityType === 'courier' ? 'على المندوب' : 'للشركة'} هو <Badge variant={transactions[0]?.balance > 0 ? 'destructive' : 'default'} className="mx-1">{formatCurrency(transactions[0]?.balance || 0)}</Badge>
                         </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>البيان</TableHead>
                                    <TableHead className="text-center text-destructive">مدين</TableHead>
                                    <TableHead className="text-center text-green-600">دائن</TableHead>
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
                                        <TableCell className="text-center font-mono">{formatCurrency(tx.debit)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(tx.credit)}</TableCell>
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

    