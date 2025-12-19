
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Shipment, Company, ShipmentStatusConfig } from '@/lib/types';
import { Loader2, UploadCloud, AlertTriangle, CheckCircle, GitCompareArrows, FileWarning, BadgePercent, FileCheck2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDropzone } from 'react-dropzone';
import { read, utils } from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

type AnalyzedShipment = {
    systemShipment: Shipment;
    sheetAmount: number;
    difference: number;
};

type AnalysisResult = {
    companyName: string;
    matched: Shipment[];
    discrepancies: AnalyzedShipment[];
    systemOnly: Shipment[];
    sheetOnly: { code: string; amount: number }[];
};

export default function ComparisonPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [processingUpdate, setProcessingUpdate] = useState<Set<string>>(new Set());

    // --- Data Fetching ---
    const companiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const allShipmentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]);
    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(allShipmentsQuery);
    
    const statusesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]);
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);
    
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!selectedCompanyId || !allShipments) {
            toast({ title: "الرجاء اختيار شركة أولاً", variant: "destructive" });
            return;
        }
        const file = acceptedFiles[0];
        setIsProcessing(true);
        setAnalysis(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Convert sheet to JSON to find headers first
            const sheetJsonForHeaders: any[] = utils.sheet_to_json(sheet, { header: 1 });
            
            // Dynamically find headers
            const headerKeywords = {
                code: ['رقم الشحنة', 'كود الشحنة', 'Shipment Code'],
                amount: ['المبلغ', 'الاجمالي', 'المحصل', 'Amount', 'Total']
            };
            
            let codeHeader = '';
            let amountHeader = '';

            for (let i = 0; i < sheetJsonForHeaders.length; i++) {
                const row = sheetJsonForHeaders[i] as (string | number)[];
                const rowAsStrings = row.map(String);

                if (!codeHeader) {
                    const foundCode = rowAsStrings.find(cell => headerKeywords.code.some(kw => cell.toLowerCase().includes(kw.toLowerCase())));
                    if (foundCode) codeHeader = foundCode;
                }

                if (!amountHeader) {
                    const foundAmount = rowAsStrings.find(cell => headerKeywords.amount.some(kw => cell.toLowerCase().includes(kw.toLowerCase())));
                    if (foundAmount) amountHeader = foundAmount;
                }

                if (codeHeader && amountHeader) break;
            }
            
            if (!codeHeader || !amountHeader) {
                throw new Error("لم يتم العثور على أعمدة 'كود الشحنة' و 'المبلغ' في الشيت.");
            }

            const sheetData = new Map<string, number>();
            const jsonData = utils.sheet_to_json(sheet);
            
            jsonData.forEach((row: any) => {
                const code = String(row[codeHeader] || '').trim();
                const amountValue = row[amountHeader];
                const amount = typeof amountValue === 'string'
                    ? parseFloat(amountValue.replace(/[^0-9.]/g, ''))
                    : typeof amountValue === 'number'
                    ? amountValue
                    : NaN;

                if (code && !isNaN(amount)) {
                    sheetData.set(code, amount);
                }
            });

            // IMPORTANT FIX: Compare against ALL shipments for the company, not just "finished" ones.
            const companyShipments = allShipments.filter(s => s.companyId === selectedCompanyId);
            
            const matched: Shipment[] = [];
            const discrepancies: AnalyzedShipment[] = [];
            const systemOnly: Shipment[] = [...companyShipments];
            const sheetOnly: { code: string; amount: number }[] = [];
            
            sheetData.forEach((sheetAmount, code) => {
                const systemShipmentIndex = systemOnly.findIndex(s => s.shipmentCode === code);
                
                if (systemShipmentIndex > -1) {
                    const systemShipment = systemOnly.splice(systemShipmentIndex, 1)[0];
                    const systemAmount = systemShipment.paidAmount || 0;
                    if (Math.abs(systemAmount - sheetAmount) < 0.01) {
                        matched.push(systemShipment);
                    } else {
                        discrepancies.push({ systemShipment, sheetAmount, difference: sheetAmount - systemAmount });
                    }
                } else {
                    sheetOnly.push({ code, amount: sheetAmount });
                }
            });

            setAnalysis({
                companyName: companies?.find(c => c.id === selectedCompanyId)?.name || 'شركة غير محددة',
                matched,
                discrepancies,
                systemOnly: systemOnly.filter(s => !s.isArchivedForCompany), // Exclude already archived from this list
                sheetOnly
            });

        } catch (error: any) {
            toast({ title: "خطأ في معالجة الملف", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    }, [selectedCompanyId, allShipments, companies, toast, statuses]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls']}, multiple: false });

    const handleSettleDiscrepancy = async (shipment: Shipment, newAmount: number) => {
        if (!firestore) return;
        setProcessingUpdate(prev => new Set(prev).add(shipment.id));
        try {
            const shipmentRef = doc(firestore, 'shipments', shipment.id);
            await updateDoc(shipmentRef, { paidAmount: newAmount, collectedAmount: newAmount });
            toast({ title: `تم تحديث مبلغ شحنة ${shipment.shipmentCode}` });
            setAnalysis(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    discrepancies: prev.discrepancies.filter(d => d.systemShipment.id !== shipment.id),
                    matched: [...prev.matched, { ...shipment, paidAmount: newAmount, collectedAmount: newAmount }],
                }
            });
        } catch (error) {
            toast({ title: "فشل تحديث الشحنة", variant: "destructive" });
        } finally {
            setProcessingUpdate(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }
    };
    
    const handleSettleAllDiscrepancies = async () => {
        if (!analysis || analysis.discrepancies.length === 0 || !firestore) return;
        setIsProcessing(true);
        const batch = writeBatch(firestore);
        analysis.discrepancies.forEach(d => {
            const shipmentRef = doc(firestore, 'shipments', d.systemShipment.id);
            batch.update(shipmentRef, { paidAmount: d.sheetAmount, collectedAmount: d.sheetAmount });
        });

        try {
            await batch.commit();
            toast({ title: `تم تسوية ${analysis.discrepancies.length} اختلافات بنجاح` });
            setAnalysis(prev => prev ? { ...prev, matched: [...prev.matched, ...prev.discrepancies.map(d => ({...d.systemShipment, paidAmount: d.sheetAmount}))], discrepancies: [] } : null);
        } catch (error) {
            toast({ title: "فشلت تسوية جميع الاختلافات", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };


    const renderResultTable = (title: string, data: any[], columns: { key: string, header: string, render?: (item: any) => React.ReactNode }[]) => (
        data.length > 0 && (
            <div>
                <h3 className="font-semibold mb-2">{title} ({data.length})</h3>
                <ScrollArea className="h-64 border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map(col => <TableHead key={col.key}>{col.header}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((item, index) => (
                                <TableRow key={index}>
                                    {columns.map(col => (
                                        <TableCell key={col.key}>
                                            {col.render ? col.render(item) : String(item[col.key] || '')}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        )
    );

    const currencyFormat = (amount: number) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <GitCompareArrows className="h-6 w-6 text-primary" />
                        مقارنة شيتات التسوية النهائية
                    </CardTitle>
                    <CardDescription>
                        ارفع شيت التسوية النهائي من شركة الشحن لمقارنته مع بيانات النظام واكتشاف الفروقات.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                        <label className="font-medium">1. اختر الشركة</label>
                        <Select dir="rtl" onValueChange={setSelectedCompanyId} value={selectedCompanyId || ''} disabled={isProcessing}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الشركة التي تود مقارنة شيتها..." />
                            </SelectTrigger>
                            <SelectContent>
                                {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div
                        {...getRootProps()}
                        className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
                            !selectedCompanyId ? 'bg-muted/50 cursor-not-allowed border-muted' : isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <input {...getInputProps()} disabled={!selectedCompanyId || isProcessing} />
                        {isProcessing ? (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p>جاري التحليل...</p>
                            </div>
                        ) : (
                            <div className={`flex flex-col items-center gap-2 ${!selectedCompanyId ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                <UploadCloud className="h-8 w-8" />
                                <p>2. اسحب وأفلت الشيت هنا، أو انقر للاختيار</p>
                                <p className="text-xs">سيتم تحليل جميع شحنات الشركة ومقارنتها</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {analysis && (
                <Card>
                    <CardHeader>
                        <CardTitle>نتائج مقارنة شيت شركة: {analysis.companyName}</CardTitle>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center pt-4">
                           <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg flex flex-col items-center justify-center">
                                <FileCheck2 className="h-6 w-6 text-green-700 mb-1"/>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{analysis.matched.length}</p>
                                <p className="text-sm text-green-600 dark:text-green-500">شحنة متطابقة</p>
                            </div>
                             <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex flex-col items-center justify-center">
                                <Scale className="h-6 w-6 text-yellow-700 mb-1"/>
                                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{analysis.discrepancies.length}</p>
                                <p className="text-sm text-yellow-600 dark:text-yellow-500">اختلاف في المبلغ</p>
                            </div>
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center">
                                <FileWarning className="h-6 w-6 text-red-700 mb-1"/>
                                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{analysis.systemOnly.length}</p>
                                <p className="text-sm text-red-600 dark:text-red-500">موجودة بالنظام فقط</p>
                            </div>
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex flex-col items-center justify-center">
                                <FileWarning className="h-6 w-6 text-blue-700 mb-1"/>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{analysis.sheetOnly.length}</p>
                                <p className="text-sm text-blue-600 dark:text-blue-500">موجودة بالشيت فقط</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {renderResultTable('اختلافات في المبلغ', analysis.discrepancies, [
                            { key: 'systemShipment.shipmentCode', header: 'كود الشحنة' },
                            { key: 'systemShipment.recipientName', header: 'العميل' },
                            { key: 'systemAmount', header: 'مبلغ النظام', render: item => <Badge variant="secondary">{currencyFormat(item.systemShipment.paidAmount)}</Badge> },
                            { key: 'sheetAmount', header: 'مبلغ الشيت', render: item => <Badge variant="destructive">{currencyFormat(item.sheetAmount)}</Badge> },
                            { key: 'difference', header: 'الفرق', render: item => <span className={`font-bold ${item.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>{currencyFormat(item.difference)}</span> },
                            { key: 'actions', header: 'إجراء', render: item => <Button size="sm" onClick={() => handleSettleDiscrepancy(item.systemShipment, item.sheetAmount)} disabled={processingUpdate.has(item.systemShipment.id)}>{processingUpdate.has(item.systemShipment.id) ? <Loader2 className="h-4 w-4 animate-spin"/> : "تسوية"}</Button> },
                        ])}

                        {analysis.discrepancies.length > 1 && <Button onClick={handleSettleAllDiscrepancies} disabled={isProcessing}>{isProcessing && <Loader2 className="h-4 w-4 animate-spin me-2"/>}تسوية كل الاختلافات</Button>}

                        {renderResultTable('شحنات موجودة بالنظام فقط (لم ترد في الشيت)', analysis.systemOnly, [
                            { key: 'shipmentCode', header: 'كود الشحنة' },
                            { key: 'recipientName', header: 'العميل' },
                            { key: 'paidAmount', header: 'المبلغ', render: item => currencyFormat(item.paidAmount) },
                             { key: 'status', header: 'الحالة', render: item => <Badge variant={statuses?.find(s=>s.id === item.status)?.isDeliveredStatus ? 'default' : 'secondary'}>{statuses?.find(s=>s.id === item.status)?.label || item.status}</Badge> },
                            { key: 'updatedAt', header: 'آخر تحديث', render: item => new Date(item.updatedAt?.toDate?.() || item.updatedAt || 0).toLocaleDateString('ar-EG') },
                        ])}

                        {renderResultTable('شحنات موجودة بالشيت فقط (ليست في النظام)', analysis.sheetOnly, [
                            { key: 'code', header: 'كود الشحنة' },
                            { key: 'amount', header: 'المبلغ', render: item => currencyFormat(item.amount) },
                        ])}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
