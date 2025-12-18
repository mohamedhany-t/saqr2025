import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatTZ, toDate } from 'date-fns-tz';
import { ar } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatToCairoTime = (date: any): string => {
  if (!date) return 'غير محدد';
  
  try {
    let dateObj;
    // Handle Firebase Timestamp object
    if (typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else {
      // Handle JS Date object or string
      dateObj = toDate(date);
    }
    
    const timeZone = 'Africa/Cairo';
    return formatTZ(dateObj, 'dd/MM/yyyy, hh:mm a', { timeZone, locale: ar });
  } catch (error) {
    console.error("Error formatting date:", error, "Input was:", date);
    return 'تاريخ غير صالح';
  }
};
