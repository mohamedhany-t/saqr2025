'use client';

import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * A client-side component that listens for globally emitted Firestore permission errors.
 *
 * In a development environment, it throws the error to leverage Next.js's
 * development error overlay, which provides a rich, interactive debugging experience.
 *
 * In a production environment, it displays a user-friendly toast notification
 * to inform the user of the failure without crashing the application.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error('Firestore Permission Error caught by listener:', error);

      // In development, we want the rich Next.js error overlay.
      // Throwing the error here accomplishes that.
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }

      // In production, show a generic, user-friendly toast notification.
      toast({
        variant: 'destructive',
        title: 'حدث خطأ في الصلاحيات',
        description: 'ليس لديك الإذن الكافي لتنفيذ هذا الإجراء. يرجى التواصل مع المسؤول.',
      });
    };

    // Subscribe to the 'permission-error' event.
    errorEmitter.on('permission-error', handleError);

    // Clean up the subscription when the component unmounts.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]); // The effect depends on the toast function.

  // This component does not render any UI itself.
  return null;
}
