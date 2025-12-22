
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
import { Loader2, CheckCircle, AlertTriangle, Download, RefreshCw, Check } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { exportToExcel } from '@/lib/export';
import type { Shipment } from '@/lib/types';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';

// Custom Simple Checkbox to avoid re-rendering issues
const SimpleCheckbox = ({ checked, onCheckedChange, 'aria-label': ariaLabel }: { checked: boolean, onCheckedChange: (checked: boolean) => void, 'aria-label': string }) => {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                checked && "bg-primary text-primary-foreground"
            )}
            aria-label={ariaLabel}
        >
            {checked && <Check className="h-4 w-4" />}
        </button>
    );
};


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
  
  // Initialize state once, ensuring it's empty to start.
  const [updateSelection, setUpdateSelection] = React.useState<Record<string, boolean>>(() => {
    const initialSelection: Record<string, boolean> = {};
    if (shipmentsToUpdate) {
        shipmentsToUpdate.forEach(update => {
            initialSelection[update.existing.id] = true; // Default all to true initially
        });
    }
    return initialSelection;
  });

  const processedCount = added + updated + rejected;
  const progressPercentage = total > 0 ? (processedCount / total) * 100 : 0;
  const isFinished = !processing;
  
  const handleConfirm = () => {
    if (onConfirmUpdates) {
        const selectedUpdates = shipmentsToUpdate.filter(u => updateSelection[u.existing.id]);
        onConfirmUpdates(selectedUpdates);
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

  const toggleAllUpdates = () => {
    const areAllSelected = Object.values(updateSelection).every(Boolean) && Object.keys(updateSelection).length === shipmentsToUpdate.length;
    const newSelection: Record<string, boolean> = {};
    shipmentsToUpdate.forEach(u => {
      newSelection[u.existing.id] = !areAllSelected;
    });
    setUpdateSelection(newSelection);
  };

  const selectedCount = Object.values(updateSelection).filter(Boolean).length;
  const allUpdatesSelected = shipmentsToUpdate.length > 0 && selectedCount === shipmentsToUpdate.length;


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
              <div className="space-y-2 pt-4">
                 <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-blue-600 flex items-center gap-2"><RefreshCw className="h-4 w-4" /> معاينة الشحنات للتحديث ({shipmentsToUpdate.length})</h4>
                 </div>
                <ScrollArea className="h-48 border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                     <SimpleCheckbox
                                        checked={allUpdatesSelected}
                                        onCheckedChange={toggleAllUpdates}
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
                                        <SimpleCheckbox
                                            checked={updateSelection[update.existing.id] ?? false}
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
                     <Button onClick={handleConfirm} disabled={selectedCount === 0}>
                        تحديث الشحنات المحددة ({selectedCount})
                    </Button>
                </div>
              </div>
          )}
          
          {isFinished && errors.length > 0 && (
            <div className="space-y-2 pt-4">
                 <div className="flex justify-between items-center">
                    <h4 className="font-semibold">قائمة الأخطاء ({errors.length})</h4>
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
