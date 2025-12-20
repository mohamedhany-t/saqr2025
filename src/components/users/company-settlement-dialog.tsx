
"use client";

import React, { useState, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Company, Shipment } from '@/lib/types';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';

interface CompanySettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company;
  allShipments: Shipment[];
  onSubmit: (company: Company, shipmentCodes: string[], paymentAmount: number, notes: string) => void;
}

interface SheetAnalysis {
    foundShipments: Shipment[];
    notFoundCodes: string[];
    netDue: number;
}

export function CompanySettlementDialog({ open, onOpenChange, company, allShipments, onSubmit }: CompanySettlementDialogProps) {
  const [analysis, setAnalysis] = useState<SheetAnalysis | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const companyShipments = useMemo(() => {
    if (!company) return [];
    return allShipments.filter(s => s.companyId === company.id && !s.isArchivedForCompany);
  }, [allShipments, company]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    setIsProcessing(true);
    setAnalysis(null);

    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = utils.sheet_to_json<any>(worksheet, { header: 1 });

            // Find the header row and column indices
            let headerRowIndex = -1;
            let codeColIndex = -1;
            for (let i = 0; i < json.length; i++) {
                const row = json[i];
                const codeIndex = row.findIndex((cell: any) => String(cell).toLowerCase().includes('كود الشحنة') || String(cell).toLowerCase().includes('رقم الشحنة'));
                if (codeIndex !== -1) {
                    headerRowIndex = i;
                    codeColIndex = codeIndex;
                    break;
                }
            }

            if (codeColIndex === -1) {
                throw new Error("لم يتم العثور على عمود يحتوي على 'كود الشحنة' أو 'رقم الشحنة'");
            }
            
            const sheetCodes = json
                .slice(headerRowIndex + 1)
                .map(row => String(row[codeColIndex]).trim())
                .filter(Boolean);

            const foundShipments = companyShipments.filter(s => sheetCodes.includes(s.shipmentCode));
            const foundShipmentCodes = new Set(foundShipments.map(s => s.shipmentCode));
            const notFoundCodes = sheetCodes.filter(code => !foundShipmentCodes.has(code));

            const netDue = foundShipments.reduce((acc, s) => {
                return acc + ((s.paidAmount || 0) - (s.companyCommission || 0));
            }, 0);

            setAnalysis({ foundShipments, notFoundCodes, netDue });
            setPaymentAmount(netDue > 0 ? netDue : 0);
            
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

  const handleSubmit = () => {
    if (!company || !analysis || analysis.foundShipments.length === 0) return;
    const shipmentCodes = analysis.foundShipments.map(s => s.shipmentCode);
    onSubmit(company, shipmentCodes, paymentAmount, notes);
    onOpenChange(false);
  };
  
  // Reset state when dialog is closed
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setAnalysis(null);
        setPaymentAmount(0);
        setNotes('');
        setIsProcessing(false);
      }, 300);
    }
  }, [open]);

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسوية حساب شركة: {company.name}</DialogTitle>
          <DialogDescription>
            ارفع شيت التسوية (مثل شيت التوريد) لحساب المبالغ المستحقة وأرشفة الشحنات المضمنة فيه تلقائيًا.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
           <div
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
                        <p className="text-xs">يجب أن يحتوي الشيت على عمود لكود الشحنة.</p>
                    </div>
                )}
            </div>

            {analysis && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <h4 className="font-semibold text-center mb-4 text-lg">ملخص تحليل الملف</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{analysis.foundShipments.length + analysis.notFoundCodes.length}</p>
                            <p className="text-sm text-blue-600 dark:text-blue-500">شحنة في الشيت</p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{analysis.foundShipments.length}</p>
                            <p className="text-sm text-green-600 dark:text-green-500">شحنة سيتم تسويتها</p>
                        </div>
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{analysis.notFoundCodes.length}</p>
                            <p className="text-sm text-red-600 dark:text-red-500">شحنة تم استبعادها</p>
                        </div>
                    </div>
                    <div className="text-center p-4 bg-primary/10 rounded-lg mt-4">
                        <p className="text-muted-foreground">صافي المبلغ للتسوية</p>
                        <p className="text-3xl font-bold text-primary">{analysis.netDue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div>
                             <h5 className="font-semibold mb-2">معاينة الشحنات التي ستتم تسويتها:</h5>
                             <ScrollArea className="h-48 border rounded-md bg-background">
                                <Table>
                                    <TableHeader><TableRow><TableHead>كود الشحنة</TableHead><TableHead>العميل</TableHead><TableHead>الصافي</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {analysis.foundShipments.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell>{s.shipmentCode}</TableCell>
                                                <TableCell>{s.recipientName}</TableCell>
                                                <TableCell>{((s.paidAmount || 0) - (s.companyCommission || 0)).toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </ScrollArea>
                        </div>
                         <div>
                            <h5 className="font-semibold mb-2">الشحنات المستبعدة وسبب الاستبعاد:</h5>
                             <ScrollArea className="h-48 border rounded-md bg-background">
                                <Table>
                                    <TableHeader><TableRow><TableHead>كود الشحنة</TableHead><TableHead>السبب</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {analysis.notFoundCodes.map(code => (
                                            <TableRow key={code}>
                                                <TableCell>{code}</TableCell>
                                                <TableCell>غير موجودة بالنظام أو مؤرشفة</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </ScrollArea>
                        </div>
                    </div>

                    <div className="mt-4 p-4 border-t border-dashed">
                        <Label htmlFor="payment-amount">مبلغ الدفعة للتسجيل (قابل للتعديل)</Label>
                        <Input
                            id="payment-amount"
                            type="number"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="text-lg font-bold text-center mt-1"
                        />
                        <Label htmlFor="notes" className="mt-2 block">ملاحظات التسوية</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="مثال: تسوية شهر يوليو، دفعة تحت الحساب..."
                            className="mt-1"
                        />
                    </div>
                </div>
            )}
            {analysis && (
                <div className="mt-4 p-3 bg-yellow-100 border-r-4 border-yellow-500 text-yellow-800 rounded-r-lg">
                    <h4 className="font-bold flex items-center gap-2"><AlertTriangle/> إجراء نهائي</h4>
                    <p className="text-sm">سيقوم هذا الإجراء بتسجيل دفعة بالمبلغ الصافي وأرشفة جميع الشحنات التي تمت مطابقتها لهذه الشركة. لا يمكن التراجع عن هذا الإجراء.</p>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={!analysis || analysis.foundShipments.length === 0}>
            تأكيد التسوية والأرشفة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
