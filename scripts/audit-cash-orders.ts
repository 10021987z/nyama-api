/**
 * Audit read-only des commandes CASH non finalisées.
 * Lance: npx ts-node scripts/audit-cash-orders.ts
 *
 * NE MODIFIE RIEN. Affiche compteurs + échantillon pour décider de la stratégie
 * (CANCELLED migration_no_cash vs DELIVERED si déjà livrées hors-app).
 */
import { PrismaClient, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

const NON_FINAL_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.DELIVERING,
];

async function main() {
  const total = await prisma.order.count({
    where: { paymentMethod: 'CASH' },
  });
  const nonFinal = await prisma.order.count({
    where: {
      paymentMethod: 'CASH',
      status: { in: NON_FINAL_STATUSES },
    },
  });
  const delivered = await prisma.order.count({
    where: { paymentMethod: 'CASH', status: OrderStatus.DELIVERED },
  });
  const cancelled = await prisma.order.count({
    where: { paymentMethod: 'CASH', status: OrderStatus.CANCELLED },
  });

  console.log('=== AUDIT CASH ORDERS (read-only) ===');
  console.log(`Total CASH       : ${total}`);
  console.log(`  ↳ DELIVERED    : ${delivered}`);
  console.log(`  ↳ CANCELLED    : ${cancelled}`);
  console.log(`  ↳ NON-FINAL    : ${nonFinal}  ← à traiter`);

  if (nonFinal > 0) {
    const sample = await prisma.order.findMany({
      where: {
        paymentMethod: 'CASH',
        status: { in: NON_FINAL_STATUSES },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        totalXaf: true,
        createdAt: true,
        clientId: true,
      },
    });
    console.log('\nÉchantillon (10 plus récents):');
    console.table(sample);

    const byStatus = await prisma.order.groupBy({
      by: ['status'],
      where: {
        paymentMethod: 'CASH',
        status: { in: NON_FINAL_STATUSES },
      },
      _count: true,
    });
    console.log('\nRépartition par statut:');
    console.table(byStatus);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
