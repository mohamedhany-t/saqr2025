
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Html5Qrcode, Html5QrcodeScannerState, type Html5QrcodeResult } from "html5-qrcode";
import { useToast } from "@/hooks/use-toast";

interface QRScannerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScanSuccess: (decodedText: string, decodedResult: Html5QrcodeResult) => void;
    continuous?: boolean; // New prop to control scanning mode
}

const QR_READER_ELEMENT_ID = "qr-reader-dialog";

// Separate component for the scanner logic to manage its lifecycle
export const QRScannerDialog = ({ open, onOpenChange, onScanSuccess, continuous = false }: QRScannerDialogProps) => {
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    if (open) {
      const timer = setTimeout(async () => {
        const qrReaderElement = document.getElementById(QR_READER_ELEMENT_ID);
        if (qrReaderElement && !scannerRef.current) {
          const scanner = new Html5Qrcode(QR_READER_ELEMENT_ID, false);
          scannerRef.current = scanner;

          try {
            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length > 0) {
              const backCamera = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('بيئة')) || cameras[0];
              
              await scanner.start(
                backCamera.id,
                {
                  fps: 10,
                  qrbox: (viewfinderWidth, viewfinderHeight) => {
                    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                    const qrboxSize = Math.floor(minEdge * 0.8);
                    return { width: qrboxSize, height: qrboxSize };
                  },
                  aspectRatio: 1.0,
                },
                (decodedText, decodedResult) => {
                    onScanSuccess(decodedText, decodedResult);
                    if (!continuous) {
                        onOpenChange(false); // Close dialog on success if not continuous
                    }
                },
                (errorMessage: string, error: any) => {
                    // This is called frequently, so we don't toast here.
                    // console.log(`QR Code no longer in sight. ${errorMessage}`);
                }
              );
            } else {
              toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على كاميرات.' });
            }
          } catch (err) {
            toast({ variant: 'destructive', title: 'خطأ في تشغيل الكاميرا', description: 'يرجى التأكد من منح صلاحيات الوصول للكاميرا.' });
            console.error("Error starting QR scanner:", err);
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    } else {
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        }).catch(error => console.error("Failed to stop scanner.", error));
      }
    }
  }, [open, onOpenChange, onScanSuccess, continuous, toast]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.stop().catch(error => console.error("Failed to stop scanner on unmount.", error));
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>مسح باركود الشحنة</DialogTitle>
          <DialogDescription>
            وجّه الكاميرا إلى رمز QR الموجود على ملصق الشحنة.
          </DialogDescription>
        </DialogHeader>
        <div id={QR_READER_ELEMENT_ID} className="w-full [&>video]:w-full [&>video]:h-auto [&>video]:rounded-md [&>img]:hidden"></div>
      </DialogContent>
    </Dialog>
  );
};
