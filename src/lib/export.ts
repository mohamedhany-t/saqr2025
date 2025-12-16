

import type { ColumnDef } from '@tanstack/react-table';
import { Workbook, type Row } from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Shipment, Governorate, Company, User } from './types';
import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatToCairoTime } from './utils';


// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const getHeader = (columnDef: ColumnDef<any, any>): string => {
    if (typeof columnDef.header === 'string') {
        return columnDef.header;
    }
    const key = (columnDef as any).accessorKey;
    if (typeof key === 'string') {
        switch(key) {
            case 'totalAmount': return 'الاجمالي';
            case 'paidAmount': return 'المدفوع';
            case 'courierCommission': return 'عمولة المندوب';
            case 'companyCommission': return 'عمولة الشركة';
            case 'netDue': return 'صافي المستحق';
            case 'balance': return 'الرصيد';
            case 'date': return 'التاريخ';
            case 'description': return 'البيان';
            case 'status': return 'الحالة';
            case 'reason': return 'السبب';
            default:
                const result = key.replace(/([A-Z])/g, " $1");
                return result.charAt(0).toUpperCase() + result.slice(1);
        }
    }
    return '';
}

const getCellValue = (
    row: any, 
    accessorKey: string | undefined, 
    governorates: Governorate[],
    companies: Company[],
    users: User[],
    ): any => {
    if (!accessorKey) return '';
    
    // Handle special calculation for financial reports
    if (row[accessorKey] !== undefined && ['netDue', 'totalCollected', 'totalRevenue', 'totalCommission', 'totalCompanyCommission', 'totalPaidToCompany', 'totalPaidByAdmin', 'balance', 'date', 'description', 'reason'].includes(accessorKey)) {
        return row[accessorKey];
    }

    const value = (row as any)[accessorKey];

    switch (accessorKey) {
        case 'governorateId':
            const governorate = governorates.find(g => g.id === value);
            return governorate ? governorate.name : value;
        case 'assignedCourierId':
            const courier = users.find(u => u.id === value);
            return courier ? courier.name : '';
        case 'companyId':
            const company = companies.find(c => c.id === value);
            return company ? company.name : '';
        case 'status':
             const statusTextMap: Record<string, string> = {
                Pending: 'قيد الانتظار',
                'In-Transit': 'قيد التوصيل',
                Delivered: 'تم التسليم',
                'Partially Delivered': 'تم التسليم جزئياً',
                'Evasion (Phone)': 'تهرب من الاستلام هاتفيا',
                'Evasion (Delivery Attempt)': 'تهرب بعدالتنسيق والوصول',
                Cancelled: 'فشل التسليم',
                Returned: 'مرتجع',
                Postponed: 'مؤجل',
                'Returned to Sender': 'تم الرجوع للراسل',
                'Refused (Paid)': 'رفض ودفع مصاريف شحن',
                'Refused (Unpaid)': 'رفض ولم يدفع مصاريف شحن',
            };
             const statusKey = value as keyof typeof statusTextMap;
             return statusTextMap[statusKey] || value;
        case 'createdAt':
        case 'deliveryDate':
             // Handle both Firestore Timestamp and JS Date objects
             const date = value?.toDate ? value.toDate() : value;
             return formatToCairoTime(date);
        default:
             if (value instanceof Date) {
                return formatToCairoTime(value);
            }
             if (value && value.toDate instanceof Function) { // Firebase Timestamp
                return formatToCairoTime(value.toDate());
            }
            return value;
    }
}


export const exportToExcel = (
  data: any[],
  columns: ColumnDef<any, any>[],
  filename: string,
  governorates: Governorate[],
  companies: Company[],
  users: User[],
  reportHeader?: { title: string, date: string }
) => {
  if (!data || data.length === 0) {
    // This part now primarily serves as a safeguard.
    // The calling component should handle the user-facing notification.
    console.error("No data to export. This should have been caught by the calling component.");
    return;
  }
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(filename);
  
  worksheet.views = [{ rightToLeft: true }];
  
  let headerRowIndex = 1;

  // Add Report Header if provided
  if (reportHeader) {
    const titleRow = worksheet.addRow([reportHeader.title]);
    titleRow.font = { name: 'Arial', size: 16, bold: true };
    titleRow.alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.mergeCells(`A1:${String.fromCharCode(64 + columns.length)}1`);
    
    const dateRow = worksheet.addRow([reportHeader.date]);
    dateRow.font = { name: 'Arial', size: 12 };
    dateRow.alignment = { horizontal: 'right', vertical: 'middle' };
    worksheet.mergeCells(`A2:${String.fromCharCode(64 + columns.length)}2`);
    
    worksheet.addRow([]); // Add a blank row for spacing
    headerRowIndex = 4;
  }

  const excelColumns = columns.map(col => ({
      header: getHeader(col),
      key: (col as any).accessorKey as string,
      width: 20, // default width
      style: {}
  }));

  // Adjust width for specific columns
  excelColumns.forEach(col => {
      if (col.key === 'address' || col.key === 'description') col.width = 40;
      if (col.key === 'reason') col.width = 30;
      if (col.key && ['totalAmount', 'paidAmount', 'courierCommission', 'companyCommission', 'netDue', 'totalCollected', 'totalRevenue', 'totalCommission', 'totalCompanyCommission', 'totalPaidToCompany', 'totalPaidByAdmin', 'balance', 'credit', 'debit'].includes(col.key)) {
          col.style = { numFmt: '#,##0.00 " EGP"' };
          col.width = 18;
      }
      if (col.key === 'createdAt' || col.key === 'date') {
        col.width = 25;
      }
  });

  worksheet.columns = excelColumns;
  
  // Style header row
  const headerRow: Row = worksheet.getRow(headerRowIndex);
  headerRow.values = excelColumns.map(c => c.header);
  headerRow.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF004C99' } // Dark blue
  };
  headerRow.alignment = { horizontal: 'right', vertical: 'middle' };

  // Add data rows
  data.forEach(row => {
    const rowData: any = {};
    excelColumns.forEach(col => {
        const key = col.key;
        if (key) {
             rowData[key] = getCellValue(row, key, governorates, companies, users);
        }
    })
    const addedRow = worksheet.addRow(rowData);
    addedRow.alignment = { horizontal: 'right' };
  });
  
  workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  });
};

export const exportToPDF = (
  data: Shipment[],
  columns: ColumnDef<Shipment, any>[],
  governorates: Governorate[],
  companies: Company[],
  users: User[],
) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    doc.addFont('/fonts/Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');
    
    const tableColumns = columns.map(col => getHeader(col));
    const tableRows = data.map(row => {
        return columns.map(col => {
            return getCellValue(row, (col as any).accessorKey as string, governorates, companies, users);
        })
    });

    doc.autoTable({
        head: [tableColumns],
        body: tableRows,
        styles: {
            font: 'Amiri',
            halign: 'right',
        },
        headStyles: {
            halign: 'right'
        },
        didDrawPage: (data: any) => {
            // Header
            doc.setFontSize(20);
            doc.setTextColor(40);
            doc.text("تقرير الشحنات", data.settings.margin.left, 15, { align: 'right' });
        },
    });

    doc.save('shipments_report.pdf');
};
