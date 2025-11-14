import type { ColumnDef } from '@tanstack/react-table';
import { Workbook } from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Shipment, Governorate } from './types';

// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const getHeader = (columnDef: ColumnDef<Shipment, any>): string => {
    if (typeof columnDef.header === 'string') {
        return columnDef.header;
    }
    // Simple fallback for accessorKey
    const key = (columnDef as any).accessorKey;
    if (typeof key === 'string') {
        // Convert camelCase to Title Case
        const result = key.replace(/([A-Z])/g, " $1");
        return result.charAt(0).toUpperCase() + result.slice(1);
    }
    return '';
}

const getCellValue = (row: Shipment, accessorKey: string | undefined, governorates: Governorate[]): any => {
    if (!accessorKey) return '';

    if (accessorKey === 'governorateId') {
        const governorate = governorates.find(g => g.id === row.governorateId);
        return governorate ? governorate.name : row.governorateId;
    }
    
    if (accessorKey === 'address') {
        const governorate = governorates.find(g => g.id === row.governorateId);
        return `${row.address}, ${governorate?.name || ''}`;
    }

    const keys = accessorKey.split('.');
    let value: any = row;
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            // If the direct key does not exist, return that key's value from the row
            return (row as any)[accessorKey];
        }
    }

    if (value instanceof Date) {
        return value.toLocaleDateString('ar-EG');
    }
     if (value && value.toDate instanceof Function) { // Firebase Timestamp
        return value.toDate().toLocaleDateString('ar-EG');
    }
    
    return value;
}


export const exportToExcel = (
  data: Shipment[],
  columns: ColumnDef<Shipment, any>[],
  filename: string,
  governorates: Governorate[]
) => {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Shipments');

  // Define columns, using a special case for address
  const excelColumns = columns.map(col => {
      let header = getHeader(col);
      let key = (col as any).accessorKey as string;
      if (key === 'address') {
          header = 'العنوان الكامل';
      }
      return { header, key, width: 25 }
    });

  worksheet.columns = excelColumns;
  
  // Add data rows
  data.forEach(row => {
    const rowData: any = {};
    excelColumns.forEach(col => {
        const key = col.key as string;
        if (key) {
             rowData[key] = getCellValue(row, key, governorates);
        }
    })
    worksheet.addRow(rowData);
  });
  
  // Style header
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { horizontal: 'center' };


  // Write to buffer and trigger download
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
  governorates: Governorate[]
) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    // Add font that supports Arabic
    doc.addFont('/fonts/Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');

    const tableColumns = columns.map(col => getHeader(col));
    const tableRows = data.map(row => {
        return columns.map(col => {
            return getCellValue(row, (col as any).accessorKey as string, governorates);
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
            doc.text("تقرير الشحنات", data.settings.margin.left, 15);
        },
    });

    doc.save('shipments_report.pdf');
};
