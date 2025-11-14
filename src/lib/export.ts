import type { ColumnDef } from '@tanstack/react-table';
import { Workbook } from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Shipment, Governorate, Company, SubClient, Courier } from './types';

// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const getHeader = (columnDef: ColumnDef<Shipment, any>): string => {
    if (typeof columnDef.header === 'string') {
        return columnDef.header;
    }
    const key = (columnDef as any).accessorKey;
    if (typeof key === 'string') {
        const result = key.replace(/([A-Z])/g, " $1");
        return result.charAt(0).toUpperCase() + result.slice(1);
    }
    return '';
}

const getCellValue = (
    row: Shipment, 
    accessorKey: string | undefined, 
    governorates: Governorate[],
    companies: Company[],
    subClients: SubClient[],
    couriers: Courier[],
    statusText: Record<string, string>
    ): any => {
    if (!accessorKey) return '';
    
    const value = (row as any)[accessorKey];

    switch (accessorKey) {
        case 'governorateId':
            const governorate = governorates.find(g => g.id === value);
            return governorate ? governorate.name : value;
        case 'companyId':
            const company = companies.find(c => c.id === value);
            return company ? company.name : value;
        case 'subClientId':
            const subClient = subClients.find(sc => sc.id === value);
            return subClient ? subClient.name : '';
        case 'assignedCourierId':
            const courier = couriers.find(c => c.id === value);
            return courier ? courier.name : '';
        case 'status':
             return statusText[value as keyof typeof statusText] || value;
        case 'createdAt':
        case 'deliveryDate':
             if (!value) return '';
             const date = value.toDate ? value.toDate() : new Date(value);
             return date.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        case 'address':
            const gov = governorates.find(g => g.id === row.governorateId);
            return `${value}${gov ? `, ${gov.name}`: ''}`;
        default:
             if (value instanceof Date) {
                return value.toLocaleDateString('ar-EG');
            }
             if (value && value.toDate instanceof Function) { // Firebase Timestamp
                return value.toDate().toLocaleDateString('ar-EG');
            }
            return value;
    }
}


export const exportToExcel = (
  data: Shipment[],
  columns: ColumnDef<Shipment, any>[],
  filename: string,
  governorates: Governorate[],
  companies: Company[],
  subClients: SubClient[],
  couriers: Courier[],
) => {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Shipments');

  const statusTextMap: Record<string, string> = {
    Pending: 'قيد الانتظار',
    'In-Transit': 'قيد التوصيل',
    Delivered: 'تم التوصيل',
    Cancelled: 'تم الإلغاء',
    Returned: 'مرتجع',
  };

  const excelColumns = [
      { header: 'رقم الطلب', key: 'orderNumber', width: 15 },
      { header: 'رقم الشحنة', key: 'trackingNumber', width: 20 },
      { header: 'التاريخ', key: 'createdAt', width: 20 },
      { header: 'المرسل اليه', key: 'recipientName', width: 25 },
      { header: 'التليفون', key: 'recipientPhone', width: 20 },
      { header: 'المحافظة', key: 'governorateId', width: 20 },
      { header: 'العنوان', key: 'address', width: 30 },
      { header: 'تاريخ التسليم للمندوب', key: 'deliveryDate', width: 20 },
      { header: 'الشركة', key: 'companyId', width: 20 },
      { header: 'العميل الفرعي', key: 'subClientId', width: 20 },
      { header: 'حالة الأوردر', key: 'status', width: 20 },
      { header: 'السبب', key: 'reason', width: 20 },
      { header: 'الاجمالي', key: 'totalAmount', width: 15 },
      { header: 'المدفوع', key: 'paidAmount', width: 15 },
    ];
    
  worksheet.columns = excelColumns;
  
  data.forEach(row => {
    const rowData: any = {};
    excelColumns.forEach(col => {
        const key = col.key;
        if (key) {
             rowData[key] = getCellValue(row, key, governorates, companies, subClients, couriers, statusTextMap);
        }
    })
    worksheet.addRow(rowData);
  });
  
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0000FF' }
  };
  worksheet.getRow(1).alignment = { horizontal: 'right' };
  worksheet.views = [{ rightToLeft: true }];


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
  subClients: SubClient[],
  couriers: Courier[],
) => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    
    // Add font that supports Arabic
    doc.addFont('/fonts/Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');
    
    const statusTextMap: Record<string, string> = {
      Pending: 'قيد الانتظار',
      'In-Transit': 'قيد التوصيل',
      Delivered: 'تم التوصيل',
      Cancelled: 'تم الإلغاء',
      Returned: 'مرتجع',
    };

    const tableColumns = columns.map(col => getHeader(col));
    const tableRows = data.map(row => {
        return columns.map(col => {
            return getCellValue(row, (col as any).accessorKey as string, governorates, companies, subClients, couriers, statusTextMap);
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
