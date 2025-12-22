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
import { Loader2, CheckCircle, AlertTriangle, Download, RefreshCw, Check, ListChecks, Pencil } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { exportToExcel } from '@/lib/export';
import type { Shipment } from '@/lib/types';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';

export interface ImportResult {
  added: number;
  updated: number;
  rejected: number;
  total: number;
  processing: boolean;
  errors: any[];
  finalError?: string;
  shipmentsToUpdate: {
    existing: Shipment;
    new: Partial<Shipment>;
  }[];
}

interface ImportProgressDialogProps {
  result: ImportResult;
  onClose: () => void;
  onConfirmUpdates?: (updates: { existing: Shipment, new: Partial<Shipment>}[]) => void;
}

const getChangedFields = (existing: Shipment, newData: Partial<Shipment>): string[] => {
    const changes: string[] = [];
    const fieldLabels: { [key: string]: string } = {
        recipientName: "اسم المستلم",
        recipientPhone: "هاتف المستلم",
        address: "العنوان",
        totalAmount: "المبلغ",
        governorateId: "المحافظة",
        senderName: "الراسل",
    };

    (Object.keys(newData) as Array<keyof Shipment>).forEach(key => {
        if (newData[key] !== undefined && String(newData[key]) !== String(existing[key])) {
            changes.push(fieldLabels[key] || key);
        }
    });
    return changes;
}

export function ImportProgressDialog({ result, onClose, onConfirmUpdates }: ImportProgressDialogProps) {
  const { added, updated, total, processing, errors, finalError, rejected, shipmentsToUpdate } = result;
  
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [updateSelection, setUpdateSelection] = React.useState<Record<string, boolean>>({});

  const processedCount = added + updated + rejected;
  const progressPercentage = total > 0 ? (processedCount / total) * 100 : 0;
  const isFinished = !processing;
  
  const handleConfirm = (isSelection: boolean) => {
    if (onConfirmUpdates) {
        const updatesToApply = isSelection 
            ? shipmentsToUpdate.filter(u => updateSelection[u.existing.id])
            : shipmentsToUpdate;
        if(updatesToApply.length > 0) {
            onConfirmUpdates(updatesToApply);
        }
    }
  }

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
  
  const selectedCount = Object.values(updateSelection).filter(Boolean).length;
  const allSelected = shipmentsToUpdate.length > 0 && selectedCount === shipmentsToUpdate.length;

  const handleToggleAll = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
        shipmentsToUpdate.forEach(u => newSelection[u.existing.id] = true);
    }
    setUpdateSelection(newSelection);
  };

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-4xl" dir="rtl">
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

          {isFinished && shipmentsToUpdate.length > 0 && onConfirmUpdates && (
              <div className="space-y-4 pt-4">
                <div className="p-4 bg-blue-50 border-r-4 border-blue-500 rounded-r-lg">
                    <h4 className="font-semibold text-blue-700 flex items-center gap-2"><RefreshCw className="h-4 w-4" /> تم العثور على {shipmentsToUpdate.length} شحنة جاهزة للتحديث</h4>
                    <p className="text-sm text-blue-600 mt-2">يمكنك تحديث جميع الشحنات مرة واحدة، أو اختيار شحنات معينة لتحديثها.</p>
                     <div className="mt-4 flex gap-2">
                        <Button onClick={() => handleConfirm(false)} size="sm">
                            <CheckCircle className="me-2 h-4 w-4" />
                            موافق، قم بتحديث الكل ({shipmentsToUpdate.length})
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectionMode(!selectionMode)}>
                            <Pencil className="me-2 h-4 w-4" />
                            {selectionMode ? 'إخفاء التحديد' : 'تحديد شحنات معينة'}
                        </Button>
                    </div>
                </div>

                {selectionMode && (
                  <div className="space-y-2">
                    <h5 className="font-medium">اختر الشحنات المراد تحديثها:</h5>
                    <ScrollArea className="h-48 border rounded-lg">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead className="w-12">
                                       <Checkbox
                                          checked={allSelected}
                                          onCheckedChange={(checked) => handleToggleAll(!!checked)}
                                          aria-label="تحديد الكل"
                                      />
                                  </TableHead>
                                  <TableHead>كود الشحنة</TableHead>
                                  <TableHead>العميل</TableHead>
                                  <TableHead>الحقول التي تغيرت</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {shipmentsToUpdate.map((update) => (
                                  <TableRow key={update.existing.id}>
                                       <TableCell>
                                          <Checkbox
                                              checked={updateSelection[update.existing.id] || false}
                                              onCheckedChange={(checked) => {
                                                  setUpdateSelection(prev => ({
                                                      ...prev,
                                                      [update.existing.id]: !!checked
                                                  }));
                                              }}
                                              aria-label={`تحديد شحنة ${update.existing.shipmentCode}`}
                                          />
                                      </TableCell>
                                      <TableCell className="font-mono">{update.existing.shipmentCode}</TableCell>
                                      <TableCell>{update.existing.recipientName}</TableCell>
                                      <TableCell>
                                          <div className="flex flex-wrap gap-1">
                                              {getChangedFields(update.existing, update.new).map(field => <Badge key={field} variant="secondary">{field}</Badge>)}
                                          </div>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                    </ScrollArea>
                    <div className="flex justify-end">
                       <Button onClick={() => handleConfirm(true)} disabled={selectedCount === 0}>
                          تحديث الشحنات المحددة ({selectedCount})
                      </Button>
                    </div>
                  </div>
                )}
              </div>
          )}
          
          {isFinished && errors.length > 0 && (
            <div className="space-y-2 pt-4">
                 <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> قائمة الأخطاء ({errors.length})</h4>
                    <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                        <Download className="me-2 h-4 w-4" />
                        تحميل ملف الأخطاء
                    </Button>
                </div>
                <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>كود الشحنة</TableHead>
                                <TableHead>العميل</TableHead>
                                <TableHead>سبب الرفض</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {errors.slice(0, 10).map((err, index) => (
                                <TableRow key={index}>
                                    <TableCell>{err['كود الشحنة'] || 'N/A'}</TableCell>
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
          <Button onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
