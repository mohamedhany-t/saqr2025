"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { read, utils } from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Company, Shipment, ShipmentStatusConfig } from '@/lib/types';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useFirebaseApp, useUser } from '@/firebase';


interface CompanySettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
  allShipments: Shipment[];
  statuses: ShipmentStatusConfig[];
}

interface SheetAnalysis {
    shipmentsToSettle: Shipment[];
    excludedShipments: { code: string, reason: string }[];
    totalInSheet: number;
    netDue: number;
}

export function CompanySettlementDialog({ open, onOpenChange, company, allShipments, statuses }: CompanySettlementDialogProps) {
  const [analysis, setAnalysis] = useState<SheetAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();
  const app = useFirebaseApp();
  const { user: authUser } = useUser();

  const companyShipments = useMemo(() => {
    if (!company) return [];
    // We fetch ALL shipments for the company, including archived ones.
    return allShipments.filter(s => s.companyId === company.id);
  }, [allShipments, company]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length || !statuses) return;
    setIsProcessing(true);
    setAnalysis(null);
    setFileName(acceptedFiles[0].name);

    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = utils.sheet_to_json<any>(worksheet, { header: 1 });

            let headerRowIndex = -1;
            let codeColIndex = -1;
            for (let i = 0; i < json.length; i++) {
                const row = json[i];
                if (!Array.isArray(row)) continue;
                const codeIndex = row.findIndex((cell: any) => String(cell).toLowerCase().includes('كود الشحنة') || String(cell).toLowerCase().includes('رقم الشحنة'));
                if (codeIndex !== -1) {
                    headerRowIndex = i;
                    codeColIndex = codeIndex;
                    break;
                }
            }

            if (codeColIndex === -1) throw new Error("لم يتم العثور على عمود يحتوي على 'كود الشحنة' أو 'رقم الشحنة'");
            
            const sheetCodes = json
                .slice(headerRowIndex + 1)
                .map(row => String(row[codeColIndex]).trim())
                .filter(Boolean);

            const financialStatuses = statuses.filter(s => s.affectsCompanyBalance).map(s => s.id);

            const shipmentsToSettle: Shipment[] = [];
            const excludedShipments: { code: string, reason: string }[] = [];

            sheetCodes.forEach(code => {
                const shipment = companyShipments.find(s => s.shipmentCode === code);
                if (!shipment) {
                    excludedShipments.push({ code, reason: "غير موجودة بالنظام" });
                } else if (shipment.isArchivedForCompany) {
                    excludedShipments.push({ code, reason: "تمت أرشفة هذه الشحنة من قبل" });
                } else if (financialStatuses.includes(shipment.status)) {
                    shipmentsToSettle.push(shipment);
                } else {
                    const statusLabel = statuses.find(s => s.id === shipment.status)?.label || shipment.status;
                    excludedShipments.push({ code, reason: `حالة غير نهائية (${statusLabel})` });
                }
            });

            const netDue = shipmentsToSettle.reduce((acc, s) => {
                return acc + ((s.paidAmount || 0) - (s.companyCommission || 0));
            }, 0);

            setAnalysis({ 
                shipmentsToSettle, 
                excludedShipments,
                totalInSheet: sheetCodes.length,
                netDue 
            });
            
        } catch (error: any) {
            toast({ title: 'خطأ في معالجة الملف', description: error.message, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };
    reader.readAsBinaryString(file);
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
  });

  const handleSubmit = async () => {
    if (!company || !analysis || !app || !authUser) {
         toast({ title: 'خطأ', description: 'بيانات غير مكتملة، لا يمكن إتمام العملية.', variant: 'destructive' });
         return;
    }
    
    setIsSubmitting(true);
    toast({ title: "جاري تنفيذ التسوية...", description: "قد تستغرق العملية بعض الوقت. يرجى عدم إغلاق النافذة." });
    
    try {
        const functions = getFunctions(app);
        const executeCompanySettlement = httpsCallable(functions, 'executeCompanySettlement');
        
        const result: any = await executeCompanySettlement({
            companyId: company.id,
            paymentAmount: analysis.netDue,
            shipmentIdsToArchive: analysis.shipmentsToSettle.map(s => s.id),
            settlementNote: `تسوية عبر شيت: ${fileName}`,
            adminId: authUser.uid,
        });

        if (result.data.success) {
            toast({ title: "نجاح", description: result.data.message });
            onOpenChange(false);
        } else {
            throw new Error(result.data.error || 'فشل غير معروف من الخادم');
        }
    } catch (error: any) {
        console.error("Error calling settlement function:", error);
        toast({ title: 'فشلت عملية التسوية', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setAnalysis(null);
        setIsProcessing(false);
        setIsSubmitting(false);
        setFileName('');
      }, 300);
    }
  }, [open]);

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية حساب شركة: {company.name}</DialogTitle>
          <DialogDescription>
            ارفع شيت الإكسل (مثل شيت التوريد) لتسوية وأرشفة الشحنات المضمنة فيه تلقائيا.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6">
        <div className="py-4 px-6 space-y-4">
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
                <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                    <h4 className="font-semibold text-center mb-2">ملخص تحليل الملف: <span className="font-mono text-sm">{fileName}</span></h4>
                    <div className="grid grid-cols-4 gap-4 text-center">
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
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{analysis.netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</p>
                            <p className="text-sm text-blue-600 dark:text-blue-500">صافي المبلغ للتسوية</p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <h5 className="font-semibold mb-2">معاينة الشحنات التي ستتم تسويتها:</h5>
                         <ScrollArea className="h-40 border rounded-md bg-background">
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
                                            <TableCell>{s.shipmentCode}</TableCell>
                                            <TableCell>{s.recipientName}</TableCell>
                                            <TableCell>{(s.totalAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                            <TableCell>{(s.paidAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                            <TableCell>{(s.companyCommission || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                            <TableCell className="font-bold">{((s.paidAmount || 0) - (s.companyCommission || 0)).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </ScrollArea>
                    </div>

                    {analysis.excludedShipments.length > 0 && <div className="pt-4">
                        <h5 className="font-semibold mb-2">الشحنات المستبعدة وسبب الاستبعاد:</h5>
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
                                            <TableCell>{item.code}</TableCell>
                                            <TableCell>{item.reason}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </ScrollArea>
                    </div>}

                    <div className="mt-4 p-4 border-t border-dashed">
                        <div className="p-3 bg-yellow-100 border-r-4 border-yellow-500 text-yellow-800 rounded-r-lg">
                            <h4 className="font-bold flex items-center gap-2"><AlertTriangle/> إجراء نهائي</h4>
                            <p className="text-sm">سيقوم هذا الإجراء بتسجيل دفعة بالمبلغ الصافي وأرشفة جميع الشحنات التي تمت مطابقتها لهذه الشركة. لا يمكن التراجع عن هذا الإجراء.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={!analysis || analysis.shipmentsToSettle.length === 0 || isSubmitting}>
            {isSubmitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            تأكيد التسوية والأرشفة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
