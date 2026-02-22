
"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Save, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

const whatsappTemplatesSchema = z.object({
  courierTemplate: z.string().min(1, 'قالب رسالة المندوب مطلوب.'),
  customerServiceTemplate: z.string().min(1, 'قالب رسالة خدمة العملاء مطلوب.'),
});

type WhatsAppTemplatesForm = z.infer<typeof whatsappTemplatesSchema>;

const defaultTemplates: WhatsAppTemplatesForm = {
    courierTemplate: `مرحباً {customer_name}،
معك {courier_name} مندوب شركة توصيل.
لديكم شحنة من شركة {company_name} بمبلغ {total_amount}.
عنوان التسليم: {address}
يمكنك تتبع الشحنة من خلال الرابط التالي: {tracking_link}`,
    customerServiceTemplate: `أهلاً بك {customer_name}،
معك {customer_service_name} من فريق الدعم في *الصقر للخدمات اللوجستية*.

نود إبلاغك بآخر مستجدات شحنتك رقم *{shipment_code}* القادمة من *{company_name}*.

- *المندوب المسؤول:* {courier_name}
- *للتواصل مع المندوب:* {courier_phone}

- *لتتبع شحنتك مباشرة:*
{tracking_link}

إذا كان لديك أي استفسار، لا تتردد في الرد على هذه الرسالة.`
};

export default function WhatsAppSettingsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const settingsDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'system_settings', 'whatsapp_templates') : null, [firestore]);
    const { data: settings, isLoading } = useDoc<WhatsAppTemplatesForm>(settingsDocRef);
    
    const form = useForm<WhatsAppTemplatesForm>({
        resolver: zodResolver(whatsappTemplatesSchema),
        defaultValues: defaultTemplates,
    });

    useEffect(() => {
        if (settings) {
            form.reset(settings);
        } else {
            form.reset(defaultTemplates);
        }
    }, [settings, form]);
    
    const onSubmit = async (values: WhatsAppTemplatesForm) => {
        if (!settingsDocRef) return;
        setIsSaving(true);
        try {
            await setDoc(settingsDocRef, values);
            toast({
                title: 'تم حفظ الإعدادات',
                description: 'تم تحديث قوالب رسائل الواتساب بنجاح.',
            });
        } catch (error) {
            console.error("Error saving WhatsApp templates:", error);
            toast({
                title: 'حدث خطأ',
                description: 'لم نتمكن من حفظ الإعدادات. يرجى المحاولة مرة أخرى.',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-3xl font-bold font-headline">إعدادات رسائل واتساب</h1>
                            <p className="text-muted-foreground mt-2">
                                قم بتخصيص قوالب الرسائل التي يتم إرسالها للعملاء عبر واتساب.
                            </p>
                        </div>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                            حفظ الإعدادات
                        </Button>
                    </div>

                    <Alert className="mb-6">
                        <Info className="h-4 w-4" />
                        <AlertTitle>المتغيرات المتاحة</AlertTitle>
                        <AlertDescription dir="ltr" className="font-mono text-xs">
                            {'{customer_name}'}, {'{courier_name}'}, {'{courier_phone}'}, {'{shipment_code}'}, {'{total_amount}'}, {'{address}'}, {'{tracking_link}'}, {'{company_name}'}, {'{customer_service_name}'}
                        </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>تيمبلت رسالة المندوب</CardTitle>
                                <CardDescription>هذه الرسالة يتم إرسالها بواسطة المندوب لتأكيد الاستلام.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="courierTemplate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea className="min-h-[200px] font-sans text-base" dir="rtl" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>تيمبلت رسالة خدمة العملاء</CardTitle>
                                <CardDescription>هذه الرسالة يتم إرسالها بواسطة فريق خدمة العملاء للمتابعة.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="customerServiceTemplate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea className="min-h-[200px] font-sans text-base" dir="rtl" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </form>
            </Form>
        </div>
    );
}
