

"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { read, utils } from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Company, Shipment, User, ShipmentStatusConfig } from '@/lib/types';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useFirebaseApp } from '@/firebase';


interface CompanySettlementDialogProps {
  company: Company;
  allShipments: Shipment[];
  adminUser: User;
  statuses: ShipmentStatusConfig[];
  onSettlementComplete: () => void;
  children: React.ReactNode;
}

interface SheetAnalysis {
    shipmentsToSettle: Shipment[];
    excludedShipments: { code: string, reason: string }[];
    totalInSheet: number;
    netDue: number;
    fileName: string;
}

const currencyFormatter = (amount: number) => new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);

export function CompanySettlementDialog({
    company,
    allShipments,
    adminUser,
    statuses,
    onSettlementComplete,
    children
}: CompanySettlementDialogProps) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState<SheetAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const app = useFirebaseApp();

  const companyShipments = useMemo(() => {
    if (!company) return [];
    return allShipments.filter(s => s.companyId === company.id);
  }, [allShipments, company]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !statuses) return;

    setIsProcessing(true);
    setAnalysis(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      let jsonData: any[][] = utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

      const headerKeywords = ['رقم الشحنة', 'كود الشحنة'];
      let headerRowIndex = -1;
      let codeColIndex = -1;
      
      for(let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as string[];
        if(!Array.isArray(row)) continue;
        const index = row.findIndex(cell => typeof cell === 'string' && headerKeywords.some(kw => cell.includes(kw)));
        if (index !== -1) {
          headerRowIndex = i;
          codeColIndex = index;
          break;
        }
      }
      
      if (headerRowIndex === -1 || codeColIndex === -1) {
          throw new Error("لم يتم العثور على صف العناوين في الملف. تأكد من وجود عمود 'رقم الشحنة' أو 'كود الشحنة'.");
      }
      
      const dataRows = jsonData.slice(headerRowIndex + 1);
      const sheetCodes = new Set(dataRows.map(row => String(row[codeColIndex] || '').trim()).filter(Boolean));

      if (sheetCodes.size === 0) {
        throw new Error("لم يتم العثور على شحنات صالحة في الملف.");
      }

      const financialStatuses = statuses.filter(s => s.affectsCompanyBalance).map(s => s.id);
      
      const shipmentsToSettle: Shipment[] = [];
      const excludedShipments: { code: string; reason: string; }[] = [];
      const processedSystemCodes = new Set<string>();

      sheetCodes.forEach(code => {
        const shipment = companyShipments.find(s => s.shipmentCode === code || s.orderNumber === code);
        
        if (!shipment) {
            excludedShipments.push({ code, reason: "غير موجودة بالنظام" });
            return;
        }
        
        const uniqueKey = shipment.shipmentCode || shipment.orderNumber;
        if (processedSystemCodes.has(uniqueKey)) return;

        // **THE FIX**: Only check isArchivedForCompany
        if (shipment.isArchivedForCompany) {
            excludedShipments.push({ code, reason: "تمت أرشفة هذه الشحنة للشركة من قبل" });
        } else if (financialStatuses.includes(shipment.status)) {
            shipmentsToSettle.push(shipment);
        } else {
            const statusLabel = statuses.find(s => s.id === shipment.status)?.label || shipment.status;
            excludedShipments.push({ code, reason: `حالة غير نهائية (${statusLabel})` });
        }
        processedSystemCodes.add(uniqueKey);
      });


      const netDue = shipmentsToSettle.reduce((acc, s) => {
          return acc + ((s.paidAmount || 0) - (s.companyCommission || 0));
      }, 0);

      setAnalysis({ 
          shipmentsToSettle, 
          excludedShipments,
          totalInSheet: sheetCodes.size,
          netDue,
          fileName: file.name
      });
        
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في معالجة الملف",
        description: error.message || "حدث خطأ غير متوقع."
      });
    } finally {
      setIsProcessing(false);
    }
  }, [companyShipments, toast, statuses]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
  });

  const handleSubmit = async () => {
    if (!company || !analysis || !app || !adminUser) {
         toast({ title: 'خطأ', description: 'بيانات غير مكتملة، لا يمكن إتمام العملية.', variant: 'destructive' });
         return;
    }
    
    setIsSubmitting(true);
    toast({ title: "جاري تنفيذ التسوية...", description: "قد تستغرق العملية بعض الوقت. يرجى عدم إغلاق النافذة." });
    
    try {
        const functions = getFunctions(app);
        const executeSettlement = httpsCallable(functions, 'executeCompanySettlement');
        
        const dataToSend = {
          companyId: company.id,
          paymentAmount: analysis.netDue,
          shipmentIdsToArchive: analysis.shipmentsToSettle.map(s => s.id),
          settlementNote: `تسوية عبر شيت: ${analysis.fileName}`,
        };

        const result = await executeSettlement(dataToSend);
        const resultData = result.data as { success: boolean, message?: string, error?: string };

        if (resultData.success) {
            toast({ title: "نجاح", description: resultData.message });
            setOpen(false);
            onSettlementComplete();
        } else {
            throw new Error(resultData.error || 'فشل غير معروف من الخادم');
        }
    } catch (error: any) {
        console.error("Error calling settlement function:", error);
        toast({ title: 'فشلت عملية التسوية', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        setAnalysis(null);
        setIsProcessing(false);
        setIsSubmitting(false);
      }, 300);
    }
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية حساب شركة: {company.name}</DialogTitle>
          <DialogDescription>
            ارفع شيت الإكسل (مثل شيت التوريد) لتسوية وأرشفة الشحنات المضمنة فيه تلقائيا.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4">
            {!analysis && <div
                    {...getRootProps()}
                    className={`p-8 border-2 border-dashed rounded-lg text-center transition-colors cursor-pointer ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                >
                    <input {...getInputProps()} />
                    {isProcessing ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p>جاري التحليل...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <UploadCloud className="h-8 w-8" />
                            <p>اسحب وأفلت شيت التسوية هنا، أو انقر للاختيار</p>
                        </div>
                    )}
                </div>}

                {analysis && (
                    <div className="space-y-6">
                         <div>
                             <h4 className="font-semibold text-center mb-2">ملخص تحليل الملف: <span className="font-mono text-sm">{analysis.fileName}</span></h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{analysis.totalInSheet}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">شحنة في الشيت</p>
                                </div>
                                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{analysis.shipmentsToSettle.length}</p>
                                    <p className="text-sm text-green-600 dark:text-green-500">شحنة ستتم تسويتها</p>
                                </div>
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{analysis.excludedShipments.length}</p>
                                    <p className="text-sm text-red-600 dark:text-red-500">شحنة تم استبعادها</p>
                                </div>
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{currencyFormatter(analysis.netDue)}</p>
                                    <p className="text-sm text-blue-600 dark:text-blue-500">صافي المبلغ للتسوية</p>
                                </div>
                            </div>
                         </div>

                        <div className="pt-4">
                            <h5 className="font-semibold mb-2 text-green-700">معاينة الشحنات التي ستتم تسويتها:</h5>
                             <ScrollArea className="h-48 border rounded-md bg-background">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>كود الشحنة</TableHead>
                                            <TableHead>العميل</TableHead>
                                            <TableHead>الإجمالي</TableHead>
                                            <TableHead>المدفوع</TableHead>
                                            <TableHead>عمولة الشركة</TableHead>
                                            <TableHead>صافي المستحق</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analysis.shipmentsToSettle.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-mono">{s.shipmentCode}</TableCell>
                                                <TableCell>{s.recipientName}</TableCell>
                                                <TableCell>{currencyFormatter(s.totalAmount || 0)}</TableCell>
                                                <TableCell>{currencyFormatter(s.paidAmount || 0)}</TableCell>
                                                <TableCell className="text-destructive">{currencyFormatter(s.companyCommission || 0)}</TableCell>
                                                <TableCell className="font-bold">{currencyFormatter((s.paidAmount || 0) - (s.companyCommission || 0))}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>

                        {analysis.excludedShipments.length > 0 && <div className="pt-4">
                            <h5 className="font-semibold mb-2 text-orange-600">الشحنات المستبعدة وسبب الاستبعاد:</h5>
                            <ScrollArea className="h-48 border rounded-md bg-background">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>كود الشحنة</TableHead>
                                            <TableHead>السبب</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analysis.excludedShipments.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">{item.code}</TableCell>
                                                <TableCell>{item.reason}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>}

                        <div className="mt-4 p-3 bg-yellow-100 border-r-4 border-yellow-500 text-yellow-800 rounded-r-lg">
                            <h4 className="font-bold flex items-center gap-2"><AlertTriangle/> إجراء نهائي</h4>
                            <p className="text-sm">سيقوم هذا الإجراء بتسجيل دفعة بالمبلغ الصافي وتحديث علامة الأرشفة (`isArchivedForCompany`) لجميع الشحنات التي تمت مطابقتها لهذه الشركة. لا يمكن التراجع عن هذا الإجراء.</p>
                        </div>
                    </div>
                )}
            </div>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={!analysis || analysis.shipmentsToSettle.length === 0 || isSubmitting || isProcessing}>
            {isSubmitting || isProcessing ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            تأكيد التسوية والأرشفة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    
