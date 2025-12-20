
"use client";

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Loader2, UploadCloud, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { read, utils } from 'xlsx';
import type { Company, Shipment, User, ShipmentStatusConfig } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useFirebaseApp } from '@/firebase';

interface CompanySettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | undefined;
  allShipments: Shipment[];
  adminUser: User;
  statuses: ShipmentStatusConfig[];
  onSettlementComplete: () => void;
}

type FileAnalysis = {
  fileName: string;
  totalInSheet: number;
  matchedShipments: Shipment[];
  unmatchedShipments: { code: string; reason: string; }[];
  totalToSettle: number;
};

export function CompanySettlementDialog({
  open,
  onOpenChange,
  company,
  allShipments,
  adminUser,
  statuses,
  onSettlementComplete,
}: CompanySettlementDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const { toast } = useToast();
  const firebaseApp = useFirebaseApp();

  const resetState = useCallback(() => {
    setIsProcessing(false);
    setAnalysis(null);
  }, []);

  // Effect to reset state when dialog is closed or company changes
  React.useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);


  const finishedStatusIds = statuses.filter(s => s.affectsCompanyBalance).map(s => s.id);
  const companyShipments = allShipments.filter(s => s.companyId === company?.id);

  const handleFileDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setAnalysis(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      let jsonData: any[][] = utils.sheet_to_json(worksheet, { header: 1, blankrows: false });

      const headerKeywords = ['رقم الشحنة', 'كود الشحنة'];
      let headerRowIndex = -1;
      let headers: string[] = [];

      for(let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as string[];
        if(row.some(cell => typeof cell === 'string' && headerKeywords.some(kw => cell.includes(kw)))) {
            headerRowIndex = i;
            headers = row.map(h => String(h));
            break;
        }
      }

      if (headerRowIndex === -1) {
          throw new Error("لم يتم العثور على صف العناوين في الملف. تأكد من وجود عمود 'رقم الشحنة' أو 'كود الشحنة'.");
      }
      
      const dataRows = jsonData.slice(headerRowIndex + 1);
      const finalJson = dataRows.map(row => {
          const obj: {[key: string]: any} = {};
          headers.forEach((header, index) => {
              obj[header] = row[index];
          });
          return obj;
      });

      const shipmentCodeColumn = headers.find(h => h.includes('رقم الشحنة')) || headers.find(h => h.includes('كود الشحنة'));
      
      if (!shipmentCodeColumn) {
        throw new Error("لم يتم العثور على عمود 'رقم الشحنة' أو 'كود الشحنة'.");
      }
      
      const shipmentCodesInSheet = new Set(finalJson.map((row: any) => String(row[shipmentCodeColumn] || '').trim()).filter(Boolean));

      if (shipmentCodesInSheet.size === 0) {
        throw new Error("لم يتم العثور على شحنات صالحة في الملف.");
      }
      
      const matchedShipments: Shipment[] = [];
      const unmatchedShipments: { code: string; reason: string; }[] = [];

      shipmentCodesInSheet.forEach(code => {
        const foundShipment = companyShipments.find(s => s.shipmentCode === code);
        if (foundShipment) {
            if(foundShipment.isArchivedForCompany) {
                unmatchedShipments.push({ code, reason: "تمت أرشفتها مسبقًا" });
            } else if (!finishedStatusIds.includes(foundShipment.status)) {
                const statusLabel = statuses.find(s => s.id === foundShipment.status)?.label || foundShipment.status;
                unmatchedShipments.push({ code, reason: `حالة غير نهائية (${statusLabel})` });
            } else {
                matchedShipments.push(foundShipment);
            }
        } else {
          unmatchedShipments.push({ code, reason: "غير موجودة في النظام" });
        }
      });
      
      const totalToSettle = matchedShipments.reduce((acc, s) => acc + ((s.paidAmount || 0) - (s.companyCommission || 0)), 0);
      
      setAnalysis({
        fileName: file.name,
        totalInSheet: shipmentCodesInSheet.size,
        matchedShipments,
        unmatchedShipments,
        totalToSettle,
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في معالجة الملف",
        description: error.message || "حدث خطأ غير متوقع."
      });
      setAnalysis(null);
    } finally {
      setIsProcessing(false);
    }
  }, [companyShipments, toast, finishedStatusIds, statuses]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });
  
  const handleConfirmSettlement = async () => {
    if (!analysis || analysis.matchedShipments.length === 0 || !adminUser || !company) return;
    setIsProcessing(true);

    try {
      const functions = getFunctions(firebaseApp);
      const executeSettlement = httpsCallable(functions, 'executeCompanySettlement');

      const dataToSend = {
          companyId: company.id,
          paymentAmount: analysis.totalToSettle,
          shipmentIdsToArchive: analysis.matchedShipments.map(s => s.id),
          settlementNote: `تسوية تلقائية عبر شيت: ${analysis.fileName}`,
          adminId: adminUser.id
      };

      const result = await executeSettlement(dataToSend);
      const resultData = result.data as { success: boolean; message?: string; error?: string };

      if (resultData.success) {
          toast({
              title: "تمت التسوية بنجاح!",
              description: resultData.message,
          });
          onSettlementComplete();
          onOpenChange(false);
      } else {
          throw new Error(resultData.error || "An unknown error occurred on the server.");
      }
    } catch (error: any) {
        console.error("Error calling executeCompanySettlement cloud function:", error);
        toast({
            variant: "destructive",
            title: "فشلت عملية التسوية",
            description: error.message || "حدث خطأ أثناء الاتصال بالخادم.",
        });
    } finally {
        setIsProcessing(false);
    }
  }

  // Guard clause to prevent rendering if company is not yet defined.
  if (!company) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية حساب شركة: {company.name}</DialogTitle>
          <DialogDescription>
            ارفع شيت الإكسل (مثل شيت التوريد) لتسوية وأرشفة الشحنات المضمنة فيه تلقائيًا.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="py-4 space-y-4">
                {!analysis ? (
                <div
                    {...getRootProps()}
                    className={`mt-4 p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                >
                    <input {...getInputProps()} />
                    {isProcessing ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>جاري معالجة الملف...</p>
                    </div>
                    ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UploadCloud className="h-8 w-8" />
                        <p>اسحب وأفلت شيت الإكسل هنا، أو انقر للتحديد</p>
                        <p className="text-xs">(.xlsx, .xls)</p>
                    </div>
                    )}
                </div>
                ) : (
                <div className="space-y-4">
                    <div>
                    <h3 className="font-semibold mb-2">ملخص تحليل الملف: {analysis.fileName}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{analysis.totalInSheet}</p>
                        <p className="text-sm text-muted-foreground">شحنة في الشيت</p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">{analysis.matchedShipments.length}</p>
                        <p className="text-sm text-green-600 dark:text-green-500">شحنة ستتم تسويتها</p>
                        </div>
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <p className="text-2xl font-bold text-red-700 dark:text-red-400">{analysis.unmatchedShipments.length}</p>
                        <p className="text-sm text-red-600 dark:text-red-500">شحنة تم استبعادها</p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{analysis.totalToSettle.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</p>
                        <p className="text-sm text-blue-600 dark:text-blue-500">صافي المبلغ للتسوية</p>
                        </div>
                    </div>
                    </div>
                    
                    {analysis.matchedShipments.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-green-600">معاينة الشحنات التي ستتم تسويتها:</h4>
                            <div className="mt-2 border rounded max-h-48 overflow-y-auto">
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
                                        {analysis.matchedShipments.map(s => {
                                        const netDue = (s.paidAmount || 0) - (s.companyCommission || 0);
                                        return (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-mono">{s.shipmentCode}</TableCell>
                                                <TableCell>{s.recipientName}</TableCell>
                                                <TableCell>{(s.totalAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                                <TableCell>{(s.paidAmount || 0).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                                <TableCell className="text-red-600">{((s.companyCommission || 0)).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                                <TableCell className="font-semibold">{netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {analysis.unmatchedShipments.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-amber-600">الشحنات المستبعدة وسبب الاستبعاد:</h4>
                            <div className="mt-2 border rounded max-h-48 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>كود الشحنة</TableHead>
                                            <TableHead>السبب</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analysis.unmatchedShipments.map((item, index) => (
                                            <TableRow key={`${item.code}-${index}`}>
                                                <TableCell className="font-mono">{item.code}</TableCell>
                                                <TableCell>{item.reason}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                    <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-800 p-4 rounded-r-lg" role="alert">
                        <div className="flex">
                            <div className="py-1"><AlertTriangle className="h-5 w-5 text-amber-500 mr-3" /></div>
                            <div>
                                <p className="font-bold">إجراء نهائي</p>
                                <p className="text-sm">سيقوم هذا الإجراء بتسجيل دفعة بالمبلغ الصافي وأرشفة جميع الشحنات التي تمت مطابقتها لهذه الشركة. لا يمكن التراجع عن هذا الإجراء.</p>
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </ScrollArea>
        <DialogFooter className="mt-auto pt-4 border-t">
          <DialogClose asChild>
            <Button variant="outline" onClick={resetState}>إلغاء</Button>
          </DialogClose>
          <Button onClick={handleConfirmSettlement} disabled={isProcessing || !analysis || analysis.matchedShipments.length === 0}>
             {isProcessing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
             تأكيد التسوية والأرشفة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
