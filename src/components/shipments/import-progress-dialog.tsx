
'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { exportToExcel } from '@/lib/export';

export interface ImportResult {
  added: number;
  updated: number;
  rejected: number;
  total: number;
  processing: boolean;
  errors: any[];
  finalError?: string;
}

interface ImportProgressDialogProps {
  result: ImportResult;
  onClose: () => void;
}

export function ImportProgressDialog({ result, onClose }: ImportProgressDialogProps) {
  const { added, updated, total, processing, errors, finalError, rejected } = result;
  const processedCount = added + updated + rejected;
  const progressPercentage = total > 0 ? (processedCount / total) * 100 : 0;
  const isFinished = !processing;

  const handleDownloadErrors = () => {
    if (errors.length === 0) return;
    const errorColumns = [
        { accessorKey: "رقم الطلب", header: "رقم الطلب" },
        { accessorKey: "المرسل اليه", header: "المرسل اليه" },
        { accessorKey: "التليفون", header: "التليفون" },
        { accessorKey: "سبب الرفض", header: "سبب الرفض" }
    ];
    exportToExcel(errors, errorColumns, "shipments_import_errors", [], [], []);
  }

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isFinished ? 'تقرير استيراد الشحنات' : 'جاري استيراد الشحنات...'}
          </DialogTitle>
          <DialogDescription>
            {isFinished
              ? 'تمت معالجة الملف. هذا هو ملخص العملية.'
              : 'يرجى الانتظار، تتم معالجة الشحنات من ملف الإكسل.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {finalError && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5"/>
                <p className="text-sm font-medium">{finalError}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <Progress value={progressPercentage} className="w-full" />
            <div className="grid grid-cols-4 text-center text-sm">
                <div>
                    <p className="font-bold text-lg">{total}</p>
                    <p className="text-muted-foreground">الإجمالي</p>
                </div>
                 <div>
                    <p className="font-bold text-lg text-green-600">{added}</p>
                    <p className="text-muted-foreground">تمت الإضافة</p>
                </div>
                 <div>
                    <p className="font-bold text-lg text-blue-600">{updated}</p>
                    <p className="text-muted-foreground">تم التحديث</p>
                </div>
                <div>
                    <p className="font-bold text-lg text-destructive">{rejected}</p>
                    <p className="text-muted-foreground">تم الرفض</p>
                </div>
            </div>
          </div>
          
          {isFinished && errors.length > 0 && (
            <div className="space-y-2 pt-4">
                 <div className="flex justify-between items-center">
                    <h4 className="font-semibold">قائمة الأخطاء</h4>
                    <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                        <Download className="me-2 h-4 w-4" />
                        تحميل ملف الأخطاء
                    </Button>
                </div>
                <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم الطلب</TableHead>
                                <TableHead>العميل</TableHead>
                                <TableHead>سبب الرفض</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {errors.slice(0, 10).map((err, index) => (
                                <TableRow key={index}>
                                    <TableCell>{err['رقم الطلب'] || 'N/A'}</TableCell>
                                    <TableCell>{err['المرسل اليه'] || 'N/A'}</TableCell>
                                    <TableCell className="text-destructive">{err['سبب الرفض']}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
                 {errors.length > 10 && <p className="text-xs text-center text-muted-foreground">عرض 10 أخطاء من أصل {errors.length}. قم بتحميل الملف لعرضها كلها.</p>}
            </div>
          )}

        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={!isFinished}>
            {isFinished ? 'إغلاق' : 'جاري المعالجة...'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    