# **App Name**: AlSaqr Logistics

## Core Features:

- Shipment Creation & Management: Create, read, update, and delete shipment records with full details including: order number, tracking number, recipient information, address, phone, governorate, delivery date, client, sub-client, status, reason, total amount, paid amount, and assigned company or courier.
- Unique Shipment Code Generation: Automatically generate a unique shipment code in the format SH-YYYYMMDD-0001 upon creation. The sequence must increment daily and be guaranteed unique using Firestore transactions on a daily counter document.
- Excel/CSV Import: Import shipment data in bulk from Excel/CSV files directly from the browser. The import tool should: Read files client-side using exceljs or PapaParse. Match records by order number OR tracking number. Update existing records when duplicates are detected. Create new shipments when unique rows are found. Generate shipment codes for newly created records. Display a full import summary (Added / Updated / Errors). Required header (exact order): رقم الطلب,رقم الشحنة,التاريخ,المرسل اليه,التليفون,المحافظة,العنوان,تاريخ التسليم للمندوب,العميل,العميل الفرعى,حالة الأوردر,السبب,الاجمالى,المدفوع
- Role-Based Dashboards: Custom dashboards for each role: Admin Dashboard: Full visibility over all shipments. Statistics cards: total shipments, today’s shipments, in-transit, delivered, total revenue, per-company revenue. Full filters: date range, status, governorate, company, courier, text search. Bulk Actions: Assign courier, Assign company, Change shipment status, Delete selected shipments. Full user management: create Admin / Company / Courier accounts. Import/Export controls. PDF label generation. Company Dashboard: Company only sees its own shipments (added by them or assigned to them). Can add/update shipments belonging to the company. Can import/export Excel for its own shipments only. Company-specific revenue display. Courier Dashboard: Courier only sees assigned shipments. Can update shipment status only. Shows courier’s personal revenue based on delivered shipments.
- Shipment Label Generation (PDF): Generate a printable A4 PDF label containing: All shipment fields, Company logo placeholder, QR code or Barcode containing the shipment code, RTL-friendly template Generated fully client-side using jsPDF or pdfmake.
- Excel Export with Filters: Export shipment data to Excel with advanced filters: By company, By courier, By date range (from/to), By status Generated using exceljs directly in the browser. The exported file name format: shipments_by_<name>_<YYYYMMDD>.xlsx
- User and Role Management: Admin dashboard tool for creating/managing Firebase Authentication accounts: Admin, Company, Courier Each user contains Firestore metadata including role, companyId (if applicable), and timestamps.

## Style Guidelines:

- Desaturated blue #5F9EA0, conveying reliability and professionalism suitable for logistics operations.
- Very light desaturated blue #F0F8FF for a clean, modern interface.
- A brighter blue-green shade analogous to the primary color, used for secondary actions and highlights.
- Headline font: Poppins (sans-serif) — modern and sharp, suitable for headings.
- Body font: PT Sans (sans-serif) — great readability, warm for long text.
- Use clean, recognizable status/action icons: Truck icon → in transit, Checkmark icon → delivered, Pencil icon → edit, Exclamation / close icon → canceled
- Implement an intuitive, responsive layout using Bootstrap 5, optimized for both desktop and mobile. Full RTL (right-to-left) support is required for Arabic UI.