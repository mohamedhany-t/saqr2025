import type { Shipment, User, Role, ShipmentStatus } from './types';

const governorates = ["القاهرة", "الجيزة", "الأسكندرية", "أسوان", "الأقصر", "البحيرة", "المنوفية", "الشرقية"];
const clients = ["NextGen Store", "Electro Gadgets", "Fashion Forward"];
const couriers = ["أحمد محمود", "محمد علي", "سارة حسين"];
const statuses: ShipmentStatus[] = ["Pending", "In-Transit", "Delivered", "Returned", "Cancelled"];
const reasons = ["لم يرد", "رفض الاستلام", "تأجيل", "عنوان خاطئ"];

const generateId = (seed: number) => `id_${seed}`;
const getRandomItem = <T>(arr: T[], seed: number): T => arr[Math.floor(seed % arr.length)];

const createMockShipment = (i: number): Shipment => {
  const seed = i;
  const now = new Date('2024-01-01T00:00:00.000Z'); // Use a fixed date
  const createdAt = new Date(now.getTime() - (seed * 24 * 60 * 60 * 1000) % (30 * 24 * 60 * 60 * 1000));
  const deliveryDate = new Date(createdAt);
  deliveryDate.setDate(deliveryDate.getDate() + (seed % 5));
  const status = getRandomItem(statuses, seed);
  const totalAmount = 100 + (seed * 10) % 900;

  return {
    id: generateId(seed),
    shipmentCode: `SH-${createdAt.getFullYear()}${(createdAt.getMonth() + 1).toString().padStart(2, '0')}${createdAt.getDate().toString().padStart(2, '0')}-${String(i).padStart(4, '0')}`,
    orderNumber: `ORD-${10000 + (seed % 90000)}`,
    trackingNumber: `TRK-${100000 + (seed % 900000)}`,
    recipientName: `مستلم ${i}`,
    recipientPhone: `01${(100000000 + seed * 1234567).toString().slice(0, 9)}`,
    governorate: getRandomItem(governorates, seed),
    recipientAddress: `شارع ${i}, مبنى ${seed % 100}, شقة ${seed % 20}`,
    deliveryDate,
    client: getRandomItem(clients, seed),
    status,
    reason: status === 'Returned' || status === 'Cancelled' ? getRandomItem(reasons, seed) : undefined,
    totalAmount,
    paidAmount: status === 'Delivered' ? totalAmount : 0,
    assignedCourierId: generateId(seed + 100),
    assignedCourierName: getRandomItem(couriers, seed),
    createdAt,
    updatedAt: new Date(createdAt.getTime() + (seed * 1000) % (new Date('2024-07-28T00:00:00.000Z').getTime() - createdAt.getTime())),
  };
};

const createMockUser = (i: number, role: Role): User => {
    const seed = i + 200; // different seed for users
    const company = getRandomItem(clients, seed);
    return {
        id: generateId(seed),
        name: `${role === 'admin' ? 'Admin' : role === 'company' ? 'Company' : 'Courier'} ${i}`,
        email: `${role}${i}@alsaqr.com`,
        role,
        companyId: role !== 'admin' ? company.replace(' ', '') : undefined,
        companyName: role !== 'admin' ? company : undefined,
        avatarUrl: `https://i.pravatar.cc/40?u=${generateId(seed)}`,
        createdAt: new Date(new Date('2024-01-01T00:00:00.000Z').getTime() - (seed * 24 * 60 * 60 * 1000) % (90 * 24 * 60 * 60 * 1000)),
    }
}

export const mockShipments: Shipment[] = Array.from({ length: 50 }, (_, i) => createMockShipment(i + 1));

export const mockUsers: User[] = [
    ...Array.from({ length: 2 }, (_, i) => createMockUser(i + 1, 'admin')),
    ...Array.from({ length: 3 }, (_, i) => createMockUser(i + 1, 'company')),
    ...Array.from({ length: 5 }, (_, i) => createMockUser(i + 1, 'courier')),
];