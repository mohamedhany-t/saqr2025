import type { Shipment, User, Role, ShipmentStatus } from './types';

const governorates = ["القاهرة", "الجيزة", "الأسكندرية", "أسوان", "الأقصر", "البحيرة", "المنوفية", "الشرقية"];
const clients = ["NextGen Store", "Electro Gadgets", "Fashion Forward"];
const couriers = ["أحمد محمود", "محمد علي", "سارة حسين"];
const statuses: ShipmentStatus[] = ["Pending", "In-Transit", "Delivered", "Returned", "Cancelled"];
const reasons = ["لم يرد", "رفض الاستلام", "تأجيل", "عنوان خاطئ"];

const generateId = () => Math.random().toString(36).substring(2, 10);

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const createMockShipment = (i: number): Shipment => {
  const now = new Date();
  const createdAt = new Date(now.setDate(now.getDate() - Math.floor(Math.random() * 30)));
  const deliveryDate = new Date(createdAt);
  deliveryDate.setDate(deliveryDate.getDate() + Math.floor(Math.random() * 5));
  const status = getRandomItem(statuses);
  const totalAmount = Math.floor(Math.random() * 1000) + 100;

  return {
    id: generateId(),
    shipmentCode: `SH-${createdAt.getFullYear()}${(createdAt.getMonth() + 1).toString().padStart(2, '0')}${createdAt.getDate().toString().padStart(2, '0')}-${String(i).padStart(4, '0')}`,
    orderNumber: `ORD-${Math.floor(Math.random() * 90000) + 10000}`,
    trackingNumber: `TRK-${Math.floor(Math.random() * 900000) + 100000}`,
    recipientName: `مستلم ${i}`,
    recipientPhone: `01${Math.floor(Math.random() * 100000000).toString().padStart(9, '0')}`,
    governorate: getRandomItem(governorates),
    recipientAddress: `شارع ${i}, مبنى ${Math.floor(Math.random() * 100)}, شقة ${Math.floor(Math.random() * 20)}`,
    deliveryDate,
    client: getRandomItem(clients),
    status,
    reason: status === 'Returned' || status === 'Cancelled' ? getRandomItem(reasons) : undefined,
    totalAmount,
    paidAmount: status === 'Delivered' ? totalAmount : 0,
    assignedCourierId: generateId(),
    assignedCourierName: getRandomItem(couriers),
    createdAt,
    updatedAt: new Date(createdAt.getTime() + Math.random() * (new Date().getTime() - createdAt.getTime())),
  };
};

const createMockUser = (i: number, role: Role): User => {
    const company = getRandomItem(clients);
    return {
        id: generateId(),
        name: `${role === 'admin' ? 'Admin' : role === 'company' ? 'Company' : 'Courier'} ${i}`,
        email: `${role}${i}@alsaqr.com`,
        role,
        companyId: role !== 'admin' ? company.replace(' ', '') : undefined,
        companyName: role !== 'admin' ? company : undefined,
        avatarUrl: `https://i.pravatar.cc/40?u=${generateId()}`,
        createdAt: new Date(new Date().setDate(new Date().getDate() - Math.floor(Math.random() * 90))),
    }
}

export const mockShipments: Shipment[] = Array.from({ length: 50 }, (_, i) => createMockShipment(i + 1));

export const mockUsers: User[] = [
    ...Array.from({ length: 2 }, (_, i) => createMockUser(i + 1, 'admin')),
    ...Array.from({ length: 3 }, (_, i) => createMockUser(i + 1, 'company')),
    ...Array.from({ length: 5 }, (_, i) => createMockUser(i + 1, 'courier')),
];
