import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatTZ, toDate } from 'date-fns-tz';
import { ar } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatToCairoTime = (date: any): string => {
  if (!date) return 'غير محدد';
  
  // Handle Firebase Timestamp object
  if (typeof date.toDate === 'function') {
    date = date.toDate();
  }

  try {
    const timeZone = 'Africa/Cairo';
    const dateObj = toDate(date, { timeZone });
    return formatTZ(dateObj, 'dd/MM/yyyy, hh:mm a', { timeZone, locale: ar });
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'تاريخ غير صالح';
  }
};
