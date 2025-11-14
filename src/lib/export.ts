import type { ColumnDef } from '@tanstack/react-table';
import { Workbook } from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Shipment } from './types';

// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const getHeader = (columnDef: ColumnDef<Shipment>): string => {
    if (typeof columnDef.header === 'string') {
        return columnDef.header;
    }
    return columnDef.accessorKey?.toString() || '';
}

const getCellValue = (row: Shipment, accessorKey: string | undefined): any => {
    if (!accessorKey) return '';
    
    const keys = accessorKey.split('.');
    let value: any = row;
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return '';
        }
    }

    if (value instanceof Date) {
        return value.toLocaleDateString('ar-EG');
    }
    
    return value;
}


export const exportToExcel = (
  data: Shipment[],
  columns: ColumnDef<Shipment>[],
  filename: string
) => {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Shipments');

  // Add headers
  worksheet.columns = columns.map(col => ({ header: getHeader(col), key: col.accessorKey as string, width: 20 }));
  
  // Add data rows
  data.forEach(row => {
    const rowData: any = {};
    columns.forEach(col => {
        const key = col.accessorKey as string;
        if (key) {
            rowData[key] = getCellValue(row, key);
        }
    })
    worksheet.addRow(rowData);
  });

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
  columns: ColumnDef<Shipment>[],
) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    // Add font that supports Arabic
    doc.addFont('/fonts/Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');

    const tableColumns = columns.map(col => getHeader(col));
    const tableRows = data.map(row => {
        return columns.map(col => {
            return getCellValue(row, col.accessorKey as string);
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
        }
    });

    doc.save('shipment.pdf');
};
