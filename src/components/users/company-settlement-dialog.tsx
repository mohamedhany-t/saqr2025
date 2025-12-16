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
import { settleCompanyAccount } from '@/lib/actions';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface CompanySettlementDialogProps {
  company: Company;
  allShipments: Shipment[];
  adminUser: User;
  statuses: ShipmentStatusConfig[];
  onSettlementComplete: () => void;
  children: React.ReactNode;
}

type FileAnalysis = {
  fileName: string;
  totalInSheet: number;
  matchedShipments: Shipment[];
  unmatchedCodes: string[];
  totalToSettle: number;
};

export function CompanySettlementDialog({
  company,
  allShipments,
  adminUser,
  statuses,
  onSettlementComplete,
  children
}: CompanySettlementDialogProps) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const { toast } = useToast();

  const finishedStatusIds = statuses.filter(s => s.affectsCompanyBalance).map(s => s.id);
  const companyActiveShipments = allShipments.filter(s =>
    s.companyId === company.id &&
    !s.isArchivedForCompany &&
    finishedStatusIds.includes(s.status)
  );

  const resetState = () => {
    setIsProcessing(false);
    setAnalysis(null);
  };

  const handleFileDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    resetState();

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      let jsonData: any[] = utils.sheet_to_json(worksheet, { header: 1 });

      // Find the header row by looking for a specific column name
      const headerKeywords = ['رقم الشحنة', 'كود الشحنة'];
      let headerRowIndex = -1;
      let headers: string[] = [];

      for(let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as string[];
        if(row.some(cell => typeof cell === 'string' && headerKeywords.some(kw => cell.includes(kw)))) {
            headerRowIndex = i;
            headers = row;
            break;
        }
      }

      if (headerRowIndex === -1) {
          throw new Error("لم يتم العثور على صف العناوين في الملف. تأكد من وجود عمود 'رقم الشحنة' أو 'كود الشحنة'.");
      }
      
      const dataRows = jsonData.slice(headerRowIndex + 1);
      const finalJson = utils.sheet_to_json(worksheet, { header: headers, range: headerRowIndex });

      const shipmentCodeColumn = headers.find(h => h.includes('رقم الشحنة')) || headers.find(h => h.includes('كود الشحنة'));
      
      if (!shipmentCodeColumn) {
        throw new Error("لم يتم العثور على عمود 'رقم الشحنة' أو 'كود الشحنة'.");
      }
      
      const shipmentCodesInSheet = new Set(finalJson.map((row: any) => String(row[shipmentCodeColumn]).trim()).filter(Boolean));

      if (shipmentCodesInSheet.size === 0) {
        throw new Error("لم يتم العثور على شحنات صالحة في الملف.");
      }
      
      const matchedShipments: Shipment[] = [];
      const unmatchedCodes: string[] = [];

      shipmentCodesInSheet.forEach(code => {
        const foundShipment = companyActiveShipments.find(s => s.shipmentCode === code);
        if (foundShipment) {
          matchedShipments.push(foundShipment);
        } else {
          unmatchedCodes.push(code);
        }
      });
      
      const totalToSettle = matchedShipments.reduce((acc, s) => acc + ((s.paidAmount || 0) - (s.companyCommission || 0)), 0);
      
      setAnalysis({
        fileName: file.name,
        totalInSheet: shipmentCodesInSheet.size,
        matchedShipments,
        unmatchedCodes,
        totalToSettle,
      });

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في معالجة الملف",
        description: error.message || "حدث خطأ غير متوقع."
      });
      resetState();
    } finally {
      setIsProcessing(false);
    }
  }, [companyActiveShipments, company.id, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
  });
  
  const handleConfirmSettlement = async () => {
    if (!analysis || analysis.matchedShipments.length === 0 || !adminUser) return;
    setIsProcessing(true);

    const result = await settleCompanyAccount(
        company.id,
        analysis.totalToSettle,
        analysis.matchedShipments.map(s => s.id),
        `تسوية تلقائية عبر شيت: ${analysis.fileName}`,
        adminUser.uid
    );
    
    if (result.success) {
        toast({
            title: "تمت التسوية بنجاح!",
            description: result.message,
        });
        onSettlementComplete();
        setOpen(false);
    } else {
        toast({
            variant: "destructive",
            title: "فشلت عملية التسوية",
            description: result.error,
        });
    }

    setIsProcessing(false);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetState(); }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية حساب شركة: {company.name}</DialogTitle>
          <DialogDescription>
            ارفع شيت الإكسل (مثل شيت التوريد) لتسوية وأرشفة الشحنات المضمنة فيه تلقائيًا.
          </DialogDescription>
        </DialogHeader>

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
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">ملخص تحليل الملف: {analysis.fileName}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{analysis.totalInSheet}</p>
                  <p className="text-sm text-muted-foreground">شحنة في الشيت</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{analysis.matchedShipments.length}</p>
                  <p className="text-sm text-green-600 dark:text-green-500">شحنة تمت مطابقتها</p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{analysis.unmatchedCodes.length}</p>
                  <p className="text-sm text-red-600 dark:text-red-500">شحنة لم تطابق</p>
                </div>
                 <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{analysis.totalToSettle.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-500">صافي المبلغ للتسوية</p>
                </div>
              </div>
            </div>
            {analysis.unmatchedCodes.length > 0 && (
                <div>
                    <h4 className="font-semibold text-amber-600">شحنات لم تتم مطابقتها:</h4>
                    <ScrollArea className="h-24 mt-2 border rounded p-2 text-sm text-muted-foreground font-mono">
                        {analysis.unmatchedCodes.join(', ')}
                    </ScrollArea>
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

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">إلغاء</Button>
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
