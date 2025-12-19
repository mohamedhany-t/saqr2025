
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useFirebaseApp } from '@/firebase';
import { collection, query, where, doc, getDoc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { Shipment, Company, ShipmentStatusConfig, User, Governorate } from '@/lib/types';
import { Loader2, UploadCloud, AlertTriangle, CheckCircle, GitCompareArrows, FileWarning, BadgePercent, FileCheck2, Scale, Pencil, Trash2, History, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDropzone } from 'react-dropzone';
import { read, utils } from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShipmentDetailsDialog } from '@/components/shipments/shipment-details-dialog';
import { ShipmentFormSheet } from '@/components/shipments/shipment-form-sheet';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ar } from 'date-fns/locale';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { cn, formatToCairoTime } from '@/lib/utils';


type AnalyzedShipment = {
    systemShipment: Shipment;
    sheetAmount: number;
    difference: number;
};

type AnalysisResult = {
    companyName: string;
    matched: Shipment[];
    discrepancies: AnalyzedShipment[];
    dateMismatches: { systemShipment: Shipment; sheetAmount: number }[];
    systemOnly: Shipment[];
    sheetOnly: { code: string; amount: number }[];
};

export default function ComparisonPage() {
    const firestore = useFirestore();
    const app = useFirebaseApp();
    const { user: authUser } = useUser();
    const { toast } = useToast();

    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [comparisonDate, setComparisonDate] = useState<Date | undefined>(new Date());
    const [isProcessing, setIsProcessing] = useState(false);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [processingUpdate, setProcessingUpdate] = useState<Set<string>>(new Set());

    // State for modals/dialogs
    const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const [editingShipment, setEditingShipment] = useState<Shipment | undefined>(undefined);
    const [detailsShipment, setDetailsShipment] = useState<Shipment | null>(null);

    // --- Data Fetching ---
    const companiesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

    const allShipmentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]);
    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(allShipmentsQuery);
    
    const statusesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]);
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);
    
    const couriersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('role', '==', 'courier')) : null, [firestore]);
    const { data: couriers, isLoading: couriersLoading } = useCollection<User>(couriersQuery);

    const governoratesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'governorates')) : null, [firestore]);
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

    
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (!selectedCompanyId || !allShipments || !comparisonDate) {
            toast({ title: "الرجاء اختيار شركة وتاريخ أولاً", variant: "destructive" });
            return;
        }
        const file = acceptedFiles[0];
        setIsProcessing(true);
        setAnalysis(null);

        try {
            const data = await file.arrayBuffer();
            const workbook = read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            const sheetJsonForHeaders: any[] = utils.sheet_to_json(sheet, { header: 1, blankrows: false });
            
            const headerKeywords = {
                code: ['رقم الشحنة', 'كود الشحنة', 'Shipment Code'],
                amount: ['المبلغ', 'الاجمالي', 'المحصل', 'Amount', 'Total']
            };
            
            let codeHeader = '';
            let amountHeader = '';
            let headerRowIndex = -1;

             for (let i = 0; i < sheetJsonForHeaders.length; i++) {
                const row = sheetJsonForHeaders[i] as (string | number)[];
                if (!Array.isArray(row)) continue;
                const rowAsStrings = row.map(String);

                if (rowAsStrings.some(cell => headerKeywords.code.some(kw => cell.toLowerCase().includes(kw.toLowerCase())))) {
                    headerRowIndex = i;
                    for (const cell of rowAsStrings) {
                        if (!codeHeader && headerKeywords.code.some(kw => cell.toLowerCase().includes(kw.toLowerCase()))) codeHeader = cell;
                        if (!amountHeader && headerKeywords.amount.some(kw => cell.toLowerCase().includes(kw.toLowerCase()))) amountHeader = cell;
                    }
                    if (codeHeader && amountHeader) break;
                }
            }
            
            if (!codeHeader || !amountHeader) {
                throw new Error("لم يتم العثور على أعمدة 'كود الشحنة' و 'المبلغ' في الشيت.");
            }

            const jsonData = utils.sheet_to_json(sheet, { header: headerRowIndex });
            const sheetData = new Map<string, number>();

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

            // Filter system shipments by company and date
            const systemShipmentsForDate = allShipments.filter(s => {
                const createdAt = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                return s.companyId === selectedCompanyId && isSameDay(createdAt, comparisonDate);
            });
            const otherDateSystemShipments = allShipments.filter(s => {
                const createdAt = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                return s.companyId === selectedCompanyId && !isSameDay(createdAt, comparisonDate);
            });

            const matched: Shipment[] = [];
            const discrepancies: AnalyzedShipment[] = [];
            const dateMismatches: { systemShipment: Shipment, sheetAmount: number }[] = [];
            let systemOnly: Shipment[] = [...systemShipmentsForDate];
            const sheetOnly: { code: string; amount: number }[] = [];
            
            sheetData.forEach((sheetAmount, code) => {
                let found = false;
                // Check in today's shipments
                const systemShipmentIndex = systemOnly.findIndex(s => s.shipmentCode === code);
                if (systemShipmentIndex > -1) {
                    found = true;
                    const systemShipment = systemOnly.splice(systemShipmentIndex, 1)[0];
                    const systemAmount = systemShipment.paidAmount || 0;
                    if (Math.abs(systemAmount - sheetAmount) < 0.01) {
                        matched.push(systemShipment);
                    } else {
                        discrepancies.push({ systemShipment, sheetAmount, difference: sheetAmount - systemAmount });
                    }
                }

                // If not found, check in other dates
                if (!found) {
                    const otherDateShipment = otherDateSystemShipments.find(s => s.shipmentCode === code);
                    if (otherDateShipment) {
                        found = true;
                        dateMismatches.push({ systemShipment: otherDateShipment, sheetAmount });
                    }
                }

                // If still not found, it's sheet-only
                if (!found) {
                    sheetOnly.push({ code, amount: sheetAmount });
                }
            });

            setAnalysis({
                companyName: companies?.find(c => c.id === selectedCompanyId)?.name || 'شركة غير محددة',
                matched,
                discrepancies,
                dateMismatches,
                systemOnly,
                sheetOnly
            });

        } catch (error: any) {
            toast({ title: "خطأ في معالجة الملف", description: error.message, variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    }, [selectedCompanyId, allShipments, companies, toast, statuses, comparisonDate]);

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

    const handleDeleteShipment = async () => {
        if (!firestore || !shipmentToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'shipments', shipmentToDelete.id));
            toast({ title: `تم حذف الشحنة ${shipmentToDelete.shipmentCode}` });
            setAnalysis(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    systemOnly: prev.systemOnly.filter(s => s.id !== shipmentToDelete.id),
                };
            });
        } catch (error) {
            toast({ title: "فشل حذف الشحنة", variant: "destructive" });
        } finally {
            setShipmentToDelete(null);
        }
    };

    const handleDeleteAllSystemOnly = async () => {
        if (!analysis || analysis.systemOnly.length === 0 || !firestore) return;
        setIsProcessing(true);
        const batch = writeBatch(firestore);
        analysis.systemOnly.forEach(shipment => {
            const docRef = doc(firestore, 'shipments', shipment.id);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            toast({ title: `تم حذف ${analysis.systemOnly.length} شحنة بنجاح` });
            setAnalysis(prev => prev ? { ...prev, systemOnly: [] } : null);
        } catch (error) {
            toast({ title: "فشل الحذف المجمع", variant: "destructive" });
        } finally {
            setIsProcessing(false);
            setIsDeletingAll(false);
        }
    };
    
    const handleSaveShipment = async (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
        if (!firestore || !authUser || !app || !id) return;
        try {
            const functions = getFunctions(app);
            const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');
            await handleShipmentUpdateFn({ shipmentId: id, ...data });
            toast({ title: 'تم تحديث الشحنة بنجاح' });
            setEditingShipment(undefined);
            // Refresh analysis could be triggered here if needed
        } catch (error: any) {
            console.error("Error saving shipment:", error);
            toast({ title: "فشل تحديث الشحنة", description: error.message, variant: "destructive" });
        }
    };

    const renderResultTable = (title: string, data: any[], columns: { key: string, header: string, render?: (item: any) => React.ReactNode }[], actions?: React.ReactNode) => (
        data.length > 0 && (
            <div>
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{title} ({data.length})</h3>
                    {actions}
                </div>
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
                        ارفع شيت التسوية النهائي من شركة الشحن لمقارنته مع بيانات النظام واكتشاف الفروقات ليوم محدد.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="font-medium">1. اختر الشركة</label>
                            <Select dir="rtl" onValueChange={setSelectedCompanyId} value={selectedCompanyId || ''} disabled={isProcessing}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الشركة..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {companies?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="font-medium">2. حدد تاريخ التقفيل</label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-right font-normal", !comparisonDate && "text-muted-foreground")}>
                                        <CalendarIcon className="ms-2 h-4 w-4" />
                                        {comparisonDate ? format(comparisonDate, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={comparisonDate} onSelect={setComparisonDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                     <div
                        {...getRootProps()}
                        className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${
                            !selectedCompanyId || !comparisonDate ? 'bg-muted/50 cursor-not-allowed border-muted' : isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                        }`}
                    >
                        <input {...getInputProps()} disabled={!selectedCompanyId || !comparisonDate || isProcessing} />
                        {isProcessing ? (
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p>جاري التحليل...</p>
                            </div>
                        ) : (
                            <div className={`flex flex-col items-center gap-2 ${!selectedCompanyId || !comparisonDate ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                <UploadCloud className="h-8 w-8" />
                                <p>3. اسحب وأفلت الشيت هنا، أو انقر للاختيار</p>
                                <p className="text-xs">سيتم تحليل الشحنات ومقارنتها بتاريخ {comparisonDate ? format(comparisonDate, "PPP", { locale: ar }) : ''}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {analysis && (
                <Card>
                    <CardHeader>
                        <CardTitle>نتائج مقارنة شيت شركة: {analysis.companyName}</CardTitle>
                        <CardDescription>التاريخ المحدد للمقارنة: {comparisonDate ? format(comparisonDate, "PPP", { locale: ar }) : ''}</CardDescription>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center pt-4">
                           <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg flex flex-col items-center justify-center">
                                <FileCheck2 className="h-6 w-6 text-green-700 mb-1"/>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{analysis.matched.length}</p>
                                <p className="text-sm text-green-600 dark:text-green-500">متطابقة</p>
                            </div>
                             <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex flex-col items-center justify-center">
                                <Scale className="h-6 w-6 text-yellow-700 mb-1"/>
                                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{analysis.discrepancies.length}</p>
                                <p className="text-sm text-yellow-600 dark:text-yellow-500">اختلاف المبلغ</p>
                            </div>
                            <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex flex-col items-center justify-center">
                                <History className="h-6 w-6 text-cyan-700 mb-1"/>
                                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{analysis.dateMismatches.length}</p>
                                <p className="text-sm text-cyan-600 dark:text-cyan-500">اختلاف التاريخ</p>
                            </div>
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg flex flex-col items-center justify-center">
                                <FileWarning className="h-6 w-6 text-red-700 mb-1"/>
                                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{analysis.systemOnly.length}</p>
                                <p className="text-sm text-red-600 dark:text-red-500">بالنظام فقط</p>
                            </div>
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex flex-col items-center justify-center">
                                <FileWarning className="h-6 w-6 text-blue-700 mb-1"/>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{analysis.sheetOnly.length}</p>
                                <p className="text-sm text-blue-600 dark:text-blue-500">بالشيت فقط</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {renderResultTable('اختلافات في المبلغ (نفس اليوم)', analysis.discrepancies, [
                            { key: 'systemShipment.shipmentCode', header: 'كود الشحنة' },
                            { key: 'systemShipment.recipientName', header: 'العميل' },
                            { key: 'systemAmount', header: 'مبلغ النظام', render: item => <Badge variant="secondary">{currencyFormat(item.systemShipment.paidAmount)}</Badge> },
                            { key: 'sheetAmount', header: 'مبلغ الشيت', render: item => <Badge variant="destructive">{currencyFormat(item.sheetAmount)}</Badge> },
                            { key: 'difference', header: 'الفرق', render: item => <span className={`font-bold ${item.difference > 0 ? 'text-green-600' : 'text-red-600'}`}>{currencyFormat(item.difference)}</span> },
                            { key: 'actions', header: 'إجراء', render: item => <Button size="sm" onClick={() => handleSettleDiscrepancy(item.systemShipment, item.sheetAmount)} disabled={processingUpdate.has(item.systemShipment.id)}>{processingUpdate.has(item.systemShipment.id) ? <Loader2 className="h-4 w-4 animate-spin"/> : "تسوية"}</Button> },
                        ], analysis.discrepancies.length > 1 && <Button onClick={handleSettleAllDiscrepancies} disabled={isProcessing}>{isProcessing && <Loader2 className="h-4 w-4 animate-spin me-2"/>}تسوية كل الاختلافات</Button>)}

                         {renderResultTable('اختلاف في تاريخ الإنشاء', analysis.dateMismatches, [
                            { key: 'systemShipment.shipmentCode', header: 'كود الشحنة' },
                            { key: 'systemShipment.recipientName', header: 'العميل' },
                            { key: 'sheetAmount', header: 'مبلغ الشيت', render: item => currencyFormat(item.sheetAmount) },
                            { key: 'creationDate', header: 'تاريخ الإنشاء بالنظام', render: item => <Badge variant="outline">{formatToCairoTime(item.systemShipment.createdAt)}</Badge> },
                            { key: 'status', header: 'الحالة', render: item => <Badge variant={statuses?.find(s=>s.id === item.systemShipment.status)?.isDeliveredStatus ? 'default' : 'secondary'}>{statuses?.find(s=>s.id === item.systemShipment.status)?.label || item.systemShipment.status}</Badge> },
                        ])}

                        {renderResultTable(`شحنات موجودة بالنظام فقط (بتاريخ ${comparisonDate ? format(comparisonDate, "PPP", { locale: ar }) : ''})`, analysis.systemOnly, [
                            { key: 'shipmentCode', header: 'كود الشحنة' },
                            { key: 'recipientName', header: 'العميل' },
                            { key: 'paidAmount', header: 'المبلغ', render: item => currencyFormat(item.paidAmount) },
                            { key: 'status', header: 'الحالة', render: item => <Badge variant={statuses?.find(s=>s.id === item.status)?.isDeliveredStatus ? 'default' : 'secondary'}>{statuses?.find(s=>s.id === item.status)?.label || item.status}</Badge> },
                            { key: 'actions', header: 'إجراءات', render: item => (
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailsShipment(item)}><History className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingShipment(item)}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setShipmentToDelete(item)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            )},
                        ], analysis.systemOnly.length > 1 && <Button variant="destructive" onClick={() => setIsDeletingAll(true)} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin me-2"/> : <Trash2 className="h-4 w-4 me-2"/>}حذف الكل ({analysis.systemOnly.length})</Button>)}

                        {renderResultTable('شحنات موجودة بالشيت فقط (ليست في النظام)', analysis.sheetOnly, [
                            { key: 'code', header: 'كود الشحنة' },
                            { key: 'amount', header: 'المبلغ', render: item => currencyFormat(item.amount) },
                        ])}
                    </CardContent>
                </Card>
            )}

            {/* Dialogs and Modals */}
            {detailsShipment && (
                <ShipmentDetailsDialog
                    open={!!detailsShipment}
                    onOpenChange={(open) => !open && setDetailsShipment(null)}
                    shipment={detailsShipment}
                    company={companies?.find(c => c.id === detailsShipment.companyId)}
                    courier={couriers?.find(u => u.id === detailsShipment.assignedCourierId)}
                    governorate={governorates?.find(g => g.id === detailsShipment.governorateId)}
                />
            )}
            {editingShipment && (
                 <ShipmentFormSheet
                    open={!!editingShipment}
                    onOpenChange={(open) => !open && setEditingShipment(undefined)}
                    shipment={editingShipment}
                    onSave={handleSaveShipment}
                    governorates={governorates || []}
                    couriers={couriers || []}
                    companies={companies || []}
                    statuses={statuses || []}
                    role="admin"
                />
            )}
            <AlertDialog open={!!shipmentToDelete} onOpenChange={(open) => !open && setShipmentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                        <AlertDialogDescription>سيتم حذف الشحنة ({shipmentToDelete?.shipmentCode}) بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteShipment} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             <AlertDialog open={isDeletingAll} onOpenChange={setIsDeletingAll}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الحذف المجمع؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف جميع الشحنات ({analysis?.systemOnly?.length || 0}) المدرجة في قائمة "موجودة بالنظام فقط" بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAllSystemOnly} className="bg-destructive hover:bg-destructive/90">نعم، قم بالحذف</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
