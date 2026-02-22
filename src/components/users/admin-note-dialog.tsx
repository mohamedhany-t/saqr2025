
"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { User } from '@/lib/types';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

const noteSchema = z.object({
  message: z.string().min(1, 'الرسالة لا يمكن أن تكون فارغة.'),
});

interface AdminNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courier: User | undefined;
  onSend: (message: string) => Promise<void>; // Changed this line
}

export function AdminNoteDialog({ open, onOpenChange, courier, onSend }: AdminNoteDialogProps) {
  const firestore = useFirestore();

  const courierDetailsRef = useMemoFirebase(() => {
    if (!firestore || !courier?.id) return null;
    return doc(firestore, 'couriers', courier.id);
  }, [firestore, courier?.id]);
  const { data: courierDetails } = useDoc(courierDetailsRef);

  const form = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: { message: '' },
  });

  useEffect(() => {
    if (open && courierDetails) {
      form.reset({
        message: (courierDetails as any)?.adminNote?.message || '',
      });
    }
  }, [open, courierDetails, form]);

  const onSubmit = (values: z.infer<typeof noteSchema>) => {
    onSend(values.message);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>إرسال ملاحظة إلى: {courier?.name}</DialogTitle>
          <DialogDescription>
            اكتب رسالة أو تعليمات ستظهر للمندوب عند تسجيل الدخول.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نص الرسالة</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="مثال: أداء ممتاز اليوم، استمر!"
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit">إرسال</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
