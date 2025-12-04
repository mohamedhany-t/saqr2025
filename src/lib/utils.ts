import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatTZ, toDate } from 'date-fns-tz';
import { ar } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatToCairoTime = (date: Date | string | number | undefined | null): string => {
  if (!date) return 'غير محدد';
  try {
    const timeZone = 'Africa/Cairo';
    const dateObj = toDate(date, { timeZone });
    return formatTZ(dateObj, 'dd/MM/yyyy, hh:mm a', { timeZone, locale: ar });
  } catch (error) {
    console.error("Error formatting date:", error);
    return 'تاريخ غير صالح';
  }
};
