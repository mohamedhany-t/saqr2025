
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
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export interface ImportProgress {
  added: number;
  updated: number;
  total: number;
  processing: boolean;
  error?: string;
}

interface ImportProgressDialogProps {
  progress: ImportProgress;
  onClose: () => void;
}

export function ImportProgressDialog({ progress, onClose }: ImportProgressDialogProps) {
  const { added, updated, total, processing, error } = progress;
  const processedCount = added + updated;
  const progressPercentage = total > 0 ? (processedCount / total) * 100 : 0;

  const isFinished = !processing;

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isFinished ? 'اكتمل الاستيراد' : 'جاري استيراد الشحنات...'}
          </DialogTitle>
          <DialogDescription>
            {isFinished
              ? 'تمت معالجة الملف بنجاح. هذا هو الملخص.'
              : 'يرجى الانتظار، تتم معالجة الشحنات من ملف الإكسل.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5"/>
                <p className="text-sm font-medium">{error}</p>
            </div>
          )}
          
          {!isFinished && (
            <div className="flex items-center space-x-4 space-x-reverse text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>
                جاري معالجة الشحنة {processedCount} من {total}...
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Progress value={progressPercentage} className="w-full" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                تمت الإضافة: <span className="font-bold text-green-600">{added}</span>
              </span>
              <span>
                تم التحديث: <span className="font-bold text-blue-600">{updated}</span>
              </span>
              <span>
                الإجمالي: <span className="font-bold">{total}</span>
              </span>
            </div>
          </div>
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
