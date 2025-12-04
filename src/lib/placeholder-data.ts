
import type { Shipment, User, Role, ShipmentStatusKey, Governorate } from './types';

const mockGovernorates: Partial<Governorate>[] = [
    { id: 'gov_cairo', name: "القاهرة" },
    { id: 'gov_giza', name: "الجيزة" },
    { id: 'gov_alex', name: "الأسكندرية" },
    { id: 'gov_aswan', name: "أسوان" },
    { id: 'gov_luxor', name: "الأقصر" },
];
const clients = ["NextGen Store", "Electro Gadgets", "Fashion Forward"];
const couriers = ["أحمد محمود", "محمد علي", "سارة حسين"];
const statuses: ShipmentStatusKey[] = ["Pending", "In-Transit", "Delivered", "Returned", "Cancelled"];
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
  const randomGov = getRandomItem(mockGovernorates, seed);

  return {
    id: generateId(seed),
    shipmentCode: `SH-${createdAt.getFullYear()}${(createdAt.getMonth() + 1).toString().padStart(2, '0')}${createdAt.getDate().toString().padStart(2, '0')}-${String(i).padStart(4, '0')}`,
    orderNumber: `ORD-${10000 + (seed % 90000)}`,
    trackingNumber: `TRK-${100000 + (seed % 900000)}`,
    senderName: getRandomItem(clients, seed),
    recipientName: `مستلم ${i}`,
    recipientPhone: `01${(100000000 + seed * 1234567).toString().slice(0, 9)}`,
    governorateId: randomGov.id,
    address: `شارع ${i}, مبنى ${seed % 100}, شقة ${seed % 20}`,
    deliveryDate,
    status,
    reason: status === 'Returned' || status === 'Cancelled' ? getRandomItem(reasons, seed) : undefined,
    totalAmount,
    paidAmount: status === 'Delivered' ? totalAmount : 0,
    companyId: generateId(seed + 300),
    assignedCourierId: generateId(seed + 100),
    createdAt,
    updatedAt: new Date(createdAt.getTime() + (seed * 1000) % (new Date('2024-07-28T00:00:00.000Z').getTime() - createdAt.getTime())),
    isArchivedForCourier: false,
    isArchivedForCompany: false,
  };
};

const createMockUser = (i: number, role: Role): User => {
    const seed = i + 200; // different seed for users
    const company = getRandomItem(clients, seed);
    return {
        id: generateId(seed),
        name: `${role === 'admin' ? 'Admin' : role === 'company' ? company : `Courier ${i}`}`,
        email: `${role}${i}@alsaqr.com`,
        role,
        companyId: role === 'company' ? generateId(seed) : undefined,
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
