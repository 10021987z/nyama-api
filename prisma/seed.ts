import 'dotenv/config';
import * as path from 'path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, UserRole, VehicleType, OrderStatus, PaymentMethod, PaymentStatus, DeliveryStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const dbPath = path.resolve(__dirname, '../dev.db');
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

// Code OTP universel pour les comptes de dev
const DEV_OTP = '123456';

async function main() {
  console.log('🌱 Seeding NYAMA database...\n');

  // ============================================================
  // QUARTIERS
  // ============================================================

  console.log('📍 Création des quartiers...');

  const quarters = await Promise.all([
    // --- DOUALA ---
    prisma.quarter.upsert({
      where: { id: 'q-akwa' },
      update: {},
      create: {
        id: 'q-akwa',
        name: 'Akwa',
        city: 'Douala',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[9.700, 4.044], [9.718, 4.044], [9.718, 4.058], [9.700, 4.058], [9.700, 4.044]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-bonapriso' },
      update: {},
      create: {
        id: 'q-bonapriso',
        name: 'Bonapriso',
        city: 'Douala',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[9.695, 4.036], [9.712, 4.036], [9.712, 4.050], [9.695, 4.050], [9.695, 4.036]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-bonaberi' },
      update: {},
      create: {
        id: 'q-bonaberi',
        name: 'Bonabéri',
        city: 'Douala',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[9.655, 4.058], [9.675, 4.058], [9.675, 4.080], [9.655, 4.080], [9.655, 4.058]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-newbell' },
      update: {},
      create: {
        id: 'q-newbell',
        name: 'New Bell',
        city: 'Douala',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[9.704, 4.060], [9.722, 4.060], [9.722, 4.078], [9.704, 4.078], [9.704, 4.060]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-deido' },
      update: {},
      create: {
        id: 'q-deido',
        name: 'Deido',
        city: 'Douala',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[9.718, 4.052], [9.736, 4.052], [9.736, 4.068], [9.718, 4.068], [9.718, 4.052]]],
        }),
        isActive: true,
      },
    }),
    // --- YAOUNDÉ ---
    prisma.quarter.upsert({
      where: { id: 'q-bastos' },
      update: {},
      create: {
        id: 'q-bastos',
        name: 'Bastos',
        city: 'Yaoundé',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[11.512, 3.868], [11.528, 3.868], [11.528, 3.884], [11.512, 3.884], [11.512, 3.868]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-mvogada' },
      update: {},
      create: {
        id: 'q-mvogada',
        name: 'Mvog Ada',
        city: 'Yaoundé',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[11.510, 3.836], [11.526, 3.836], [11.526, 3.852], [11.510, 3.852], [11.510, 3.836]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-nlongkak' },
      update: {},
      create: {
        id: 'q-nlongkak',
        name: 'Nlongkak',
        city: 'Yaoundé',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[11.502, 3.866], [11.518, 3.866], [11.518, 3.882], [11.502, 3.882], [11.502, 3.866]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-mvan' },
      update: {},
      create: {
        id: 'q-mvan',
        name: 'Mvan',
        city: 'Yaoundé',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[11.526, 3.824], [11.542, 3.824], [11.542, 3.840], [11.526, 3.840], [11.526, 3.824]]],
        }),
        isActive: true,
      },
    }),
    prisma.quarter.upsert({
      where: { id: 'q-tsinga' },
      update: {},
      create: {
        id: 'q-tsinga',
        name: 'Tsinga',
        city: 'Yaoundé',
        polygon: JSON.stringify({
          type: 'Polygon',
          coordinates: [[[11.516, 3.872], [11.532, 3.872], [11.532, 3.888], [11.516, 3.888], [11.516, 3.872]]],
        }),
        isActive: true,
      },
    }),
  ]);

  console.log(`   ✅ ${quarters.length} quartiers créés (5 Douala + 5 Yaoundé)\n`);

  // ============================================================
  // CUISINIÈRES
  // ============================================================

  console.log('👩‍🍳 Création des cuisinières...');

  // Cuisinière 1 — Maman Catherine (Akwa, Douala)
  const userCatherine = await prisma.user.upsert({
    where: { id: 'u-catherine' },
    update: {},
    create: {
      id: 'u-catherine',
      phone: '+237690000001',
      name: 'Catherine Mballa',
      role: UserRole.COOK,
      quarterId: 'q-akwa',
      locationLat: 4.0511,
      locationLng: 9.7085,
    },
  });

  const cookCatherine = await prisma.cookProfile.upsert({
    where: { id: 'cp-catherine' },
    update: {},
    create: {
      id: 'cp-catherine',
      userId: userCatherine.id,
      displayName: 'Maman Catherine',
      specialty: JSON.stringify(['Ndolé', 'Eru', 'Koki', 'Okok']),
      description: 'Cuisinière traditionnelle bassa depuis 20 ans. Mes plats sont préparés avec des légumes frais du marché de Sandaga chaque matin.',
      avgRating: 4.8,
      totalOrders: 312,
      isVerified: true,
      isActive: true,
      prepTimeAvgMin: 25,
      openingHours: JSON.stringify({
        mon: { open: '07:00', close: '20:00' },
        tue: { open: '07:00', close: '20:00' },
        wed: { open: '07:00', close: '20:00' },
        thu: { open: '07:00', close: '20:00' },
        fri: { open: '07:00', close: '21:00' },
        sat: { open: '08:00', close: '21:00' },
        sun: { open: '09:00', close: '18:00' },
      }),
      momoPhone: '+237690000001',
      momoProvider: 'mtn',
      quarterId: 'q-akwa',
      locationLat: 4.0511,
      locationLng: 9.7085,
      landmark: 'En face de la pharmacie Centrale, Akwa',
      languagePref: 'fr',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: new Date('2026-12-31'),
    },
  });

  // Cuisinière 2 — Tantine Rose (Bonapriso, Douala)
  const userRose = await prisma.user.upsert({
    where: { id: 'u-rose' },
    update: {},
    create: {
      id: 'u-rose',
      phone: '+237690000002',
      name: 'Rose Ngo Biyong',
      role: UserRole.COOK,
      quarterId: 'q-bonapriso',
      locationLat: 4.0441,
      locationLng: 9.7085,
    },
  });

  const cookRose = await prisma.cookProfile.upsert({
    where: { id: 'cp-rose' },
    update: {},
    create: {
      id: 'cp-rose',
      userId: userRose.id,
      displayName: 'Chez Tantine Rose',
      specialty: JSON.stringify(['Poulet DG', 'Poisson braisé', 'Miondo', 'Plantain braisé']),
      description: 'Spécialiste du Poulet DG et du poisson braisé. Tout est fait à la commande, le goût du pays garanti !',
      avgRating: 4.6,
      totalOrders: 187,
      isVerified: true,
      isActive: true,
      prepTimeAvgMin: 30,
      openingHours: JSON.stringify({
        mon: { open: '09:00', close: '21:00' },
        tue: { open: '09:00', close: '21:00' },
        wed: { open: '09:00', close: '21:00' },
        thu: { open: '09:00', close: '21:00' },
        fri: { open: '09:00', close: '22:00' },
        sat: { open: '10:00', close: '22:00' },
        sun: null,
      }),
      momoPhone: '+237650000002',
      momoProvider: 'orange',
      quarterId: 'q-bonapriso',
      locationLat: 4.0441,
      locationLng: 9.7085,
      landmark: 'Derrière le supermarché Casino, Bonapriso',
      languagePref: 'fr',
      subscriptionPlan: 'FREE',
      subscriptionStatus: 'TRIAL',
    },
  });

  // Cuisinière 3 — Le Circuit d'Akwa (Deido, Douala)
  const userCircuit = await prisma.user.upsert({
    where: { id: 'u-circuit' },
    update: {},
    create: {
      id: 'u-circuit',
      phone: '+237690000003',
      name: 'Aristide Nkeng',
      role: UserRole.COOK,
      quarterId: 'q-deido',
      locationLat: 4.0605,
      locationLng: 9.7254,
    },
  });

  const cookCircuit = await prisma.cookProfile.upsert({
    where: { id: 'cp-circuit' },
    update: {},
    create: {
      id: 'cp-circuit',
      userId: userCircuit.id,
      displayName: 'Le Circuit d\'Akwa',
      specialty: JSON.stringify(['Soya', 'Brochettes', 'Beignets', 'Haricots']),
      description: 'Le meilleur soya de Deido ! Grillades au feu de bois, beignets croustillants. Ouvert du lundi au samedi soir.',
      avgRating: 4.4,
      totalOrders: 523,
      isVerified: true,
      isActive: true,
      prepTimeAvgMin: 15,
      openingHours: JSON.stringify({
        mon: { open: '17:00', close: '23:00' },
        tue: { open: '17:00', close: '23:00' },
        wed: { open: '17:00', close: '23:00' },
        thu: { open: '17:00', close: '23:00' },
        fri: { open: '16:00', close: '00:00' },
        sat: { open: '15:00', close: '00:00' },
        sun: null,
      }),
      momoPhone: '+237677000003',
      momoProvider: 'mtn',
      quarterId: 'q-deido',
      locationLat: 4.0605,
      locationLng: 9.7254,
      landmark: 'Rond-point Deido, côté Total',
      languagePref: 'fr',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: new Date('2026-09-30'),
    },
  });

  console.log('   ✅ 3 cuisinières créées\n');

  // ============================================================
  // MENUS
  // ============================================================

  console.log('🍽️  Création des menus...');

  // Menu — Maman Catherine
  const menuCatherine = await Promise.all([
    prisma.menuItem.upsert({
      where: { id: 'mi-ndole-complet' },
      update: {},
      create: {
        id: 'mi-ndole-complet',
        cookId: cookCatherine.id,
        name: 'Ndolé complet',
        description: 'Ndolé aux crevettes séchées et viande de bœuf, servi avec miondo ou plantain. Recette familiale bassa.',
        priceXaf: 2500,
        category: 'Plats traditionnels',
        isAvailable: true,
        isDailySpecial: true,
        prepTimeMin: 25,
        stockRemaining: 15,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-ndole-simple' },
      update: {},
      create: {
        id: 'mi-ndole-simple',
        cookId: cookCatherine.id,
        name: 'Ndolé simple',
        description: 'Ndolé aux arachides sans viande, idéal pour les végétariens.',
        priceXaf: 1500,
        category: 'Plats traditionnels',
        isAvailable: true,
        prepTimeMin: 20,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-eru' },
      update: {},
      create: {
        id: 'mi-eru',
        cookId: cookCatherine.id,
        name: 'Eru avec fufu',
        description: 'Feuilles d\'eru cuites avec palm oil, crevettes et water-fufu maison.',
        priceXaf: 2000,
        category: 'Plats traditionnels',
        isAvailable: true,
        prepTimeMin: 30,
        stockRemaining: 10,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-koki' },
      update: {},
      create: {
        id: 'mi-koki',
        cookId: cookCatherine.id,
        name: 'Koki haricots',
        description: 'Gâteau de haricots à la camerounaise cuit dans des feuilles de bananiers.',
        priceXaf: 1500,
        category: 'Plats traditionnels',
        isAvailable: false,
        prepTimeMin: 40,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-okok' },
      update: {},
      create: {
        id: 'mi-okok',
        cookId: cookCatherine.id,
        name: 'Okok (Gnetum)',
        description: 'Feuilles d\'okok avec crevettes fumées et pistaches. Spécialité du Sud.',
        priceXaf: 2200,
        category: 'Plats traditionnels',
        isAvailable: true,
        prepTimeMin: 35,
        stockRemaining: 8,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-miondo' },
      update: {},
      create: {
        id: 'mi-miondo',
        cookId: cookCatherine.id,
        name: 'Miondo (portion)',
        description: '3 bâtons de miondo frais, accompagnement idéal pour les sauces.',
        priceXaf: 300,
        category: 'Accompagnements',
        isAvailable: true,
        prepTimeMin: 5,
      },
    }),
  ]);

  // Menu — Tantine Rose
  const menuRose = await Promise.all([
    prisma.menuItem.upsert({
      where: { id: 'mi-poulet-dg' },
      update: {},
      create: {
        id: 'mi-poulet-dg',
        cookId: cookRose.id,
        name: 'Poulet DG',
        description: 'Poulet entier sauté avec plantains mûrs, légumes frais et épices camerounaises. Le classique !',
        priceXaf: 4500,
        category: 'Plats de résistance',
        isAvailable: true,
        isDailySpecial: true,
        prepTimeMin: 35,
        stockRemaining: 6,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-poulet-dg-demi' },
      update: {},
      create: {
        id: 'mi-poulet-dg-demi',
        cookId: cookRose.id,
        name: 'Poulet DG (demi)',
        description: 'Demi-portion de Poulet DG avec riz ou plantain.',
        priceXaf: 2500,
        category: 'Plats de résistance',
        isAvailable: true,
        prepTimeMin: 30,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-poisson-braise' },
      update: {},
      create: {
        id: 'mi-poisson-braise',
        cookId: cookRose.id,
        name: 'Poisson braisé',
        description: 'Capitaine ou machoiron braisé au feu de bois avec sauce tomate pimentée et plantain braisé.',
        priceXaf: 3500,
        category: 'Poissons & Fruits de mer',
        isAvailable: true,
        prepTimeMin: 25,
        stockRemaining: null,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-crevettes-sauce' },
      update: {},
      create: {
        id: 'mi-crevettes-sauce',
        cookId: cookRose.id,
        name: 'Crevettes en sauce',
        description: 'Grosses crevettes en sauce tomate avec riz parfumé.',
        priceXaf: 4000,
        category: 'Poissons & Fruits de mer',
        isAvailable: true,
        prepTimeMin: 20,
        stockRemaining: 5,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-plantain-braise' },
      update: {},
      create: {
        id: 'mi-plantain-braise',
        cookId: cookRose.id,
        name: 'Plantain braisé',
        description: '4 demi-bananes plantains braisées, dorées et caramélisées.',
        priceXaf: 500,
        category: 'Accompagnements',
        isAvailable: true,
        prepTimeMin: 15,
      },
    }),
  ]);

  // Menu — Le Circuit d'Akwa
  const menuCircuit = await Promise.all([
    prisma.menuItem.upsert({
      where: { id: 'mi-soya-boeuf' },
      update: {},
      create: {
        id: 'mi-soya-boeuf',
        cookId: cookCircuit.id,
        name: 'Soya bœuf (5 brochettes)',
        description: 'Brochettes de bœuf marinées aux épices, grillées au feu de bois. Avec sauce piment maison.',
        priceXaf: 1500,
        category: 'Grillades',
        isAvailable: true,
        isDailySpecial: false,
        prepTimeMin: 15,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-soya-porc' },
      update: {},
      create: {
        id: 'mi-soya-porc',
        cookId: cookCircuit.id,
        name: 'Soya porc (5 brochettes)',
        description: 'Brochettes de porc marinées, grillées. Spécialité maison.',
        priceXaf: 1500,
        category: 'Grillades',
        isAvailable: true,
        prepTimeMin: 15,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-brochettes-poulet' },
      update: {},
      create: {
        id: 'mi-brochettes-poulet',
        cookId: cookCircuit.id,
        name: 'Brochettes de poulet (4 pièces)',
        description: 'Pilons et blancs de poulet marinés, grillés à la perfection.',
        priceXaf: 2000,
        category: 'Grillades',
        isAvailable: true,
        prepTimeMin: 20,
        stockRemaining: null,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-beignets-haricots' },
      update: {},
      create: {
        id: 'mi-beignets-haricots',
        cookId: cookCircuit.id,
        name: 'Beignets de haricots (10 pièces)',
        description: 'Beignets croustillants aux haricots blancs avec sauce gombo ou tomate.',
        priceXaf: 800,
        category: 'Beignets & Snacks',
        isAvailable: true,
        prepTimeMin: 10,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-beignets-pomme' },
      update: {},
      create: {
        id: 'mi-beignets-pomme',
        cookId: cookCircuit.id,
        name: 'Beignets de pomme de terre (10 pièces)',
        description: 'Beignets légers de pomme de terre, parfaits en accompagnement.',
        priceXaf: 600,
        category: 'Beignets & Snacks',
        isAvailable: true,
        prepTimeMin: 10,
      },
    }),
    prisma.menuItem.upsert({
      where: { id: 'mi-haricots-riz' },
      update: {},
      create: {
        id: 'mi-haricots-riz',
        cookId: cookCircuit.id,
        name: 'Haricots rouges au riz',
        description: 'Haricots rouges mijotés avec tomates et épices, servis avec riz blanc.',
        priceXaf: 1200,
        category: 'Plats',
        isAvailable: true,
        prepTimeMin: 10,
      },
    }),
  ]);

  console.log(`   ✅ ${menuCatherine.length + menuRose.length + menuCircuit.length} plats créés\n`);

  // ============================================================
  // CLIENTS TEST
  // ============================================================

  console.log('👤 Création des clients test...');

  const fabrice = await prisma.user.upsert({
    where: { id: 'u-fabrice' },
    update: {},
    create: {
      id: 'u-fabrice',
      phone: '+237691000001',
      name: 'Fabrice Essomba',
      role: UserRole.CLIENT,
      quarterId: 'q-bonaberi',
      locationLat: 4.0679,
      locationLng: 9.6668,
    },
  });

  const aminata = await prisma.user.upsert({
    where: { id: 'u-aminata' },
    update: {},
    create: {
      id: 'u-aminata',
      phone: '+237677000010',
      name: 'Aminata Diallo',
      role: UserRole.CLIENT,
      quarterId: 'q-bastos',
      locationLat: 3.8754,
      locationLng: 11.5197,
    },
  });

  console.log('   ✅ 2 clients créés (Fabrice Bonabéri, Aminata Bastos)\n');

  // ============================================================
  // LIVREURS TEST
  // ============================================================

  console.log('🏍️  Création des livreurs test...');

  const userKevin = await prisma.user.upsert({
    where: { id: 'u-kevin' },
    update: {},
    create: {
      id: 'u-kevin',
      phone: '+237692000001',
      name: 'Kevin Tchiaze',
      role: UserRole.RIDER,
      quarterId: 'q-newbell',
      locationLat: 4.0678,
      locationLng: 9.7126,
    },
  });

  const riderKevin = await prisma.riderProfile.upsert({
    where: { id: 'rp-kevin' },
    update: {},
    create: {
      id: 'rp-kevin',
      userId: userKevin.id,
      vehicleType: VehicleType.MOTO,
      plateNumber: 'LT-2341-A',
      isVerified: true,
      isOnline: true,
      avgRating: 4.7,
      totalTrips: 156,
      momoPhone: '+237692000001',
      momoProvider: 'mtn',
    },
  });

  const userPaul = await prisma.user.upsert({
    where: { id: 'u-paul' },
    update: {},
    create: {
      id: 'u-paul',
      phone: '+237651000002',
      name: 'Paul Mbemba',
      role: UserRole.RIDER,
      quarterId: 'q-akwa',
      locationLat: 4.0511,
      locationLng: 9.7085,
    },
  });

  await prisma.riderProfile.upsert({
    where: { id: 'rp-paul' },
    update: {},
    create: {
      id: 'rp-paul',
      userId: userPaul.id,
      vehicleType: VehicleType.VELO,
      plateNumber: null,
      isVerified: true,
      isOnline: false,
      avgRating: 4.3,
      totalTrips: 89,
      momoPhone: '+237651000002',
      momoProvider: 'orange',
    },
  });

  console.log('   ✅ 2 livreurs créés (Kevin moto New Bell, Paul vélo Akwa)\n');

  // ============================================================
  // OTP DE DEV (code universel 123456)
  // ============================================================

  console.log('🔐 Création des OTP de dev...');

  const otpHash = await bcrypt.hash(DEV_OTP, 10);
  const allTestPhones = [
    userCatherine.phone,
    userRose.phone,
    userCircuit.phone,
    fabrice.phone,
    aminata.phone,
    userKevin.phone,
    userPaul.phone,
  ];

  for (const phone of allTestPhones) {
    await prisma.otpCode.create({
      data: {
        phone,
        code: otpHash,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an pour le dev
      },
    });
  }

  console.log(`   ✅ OTP "123456" créé pour ${allTestPhones.length} comptes\n`);

  // ============================================================
  // COMMANDES SIMULÉES
  // ============================================================

  console.log('📦 Création des commandes simulées...');

  // Commande 1 — DELIVERED (Fabrice → Maman Catherine, livrée par Kevin)
  const order1 = await prisma.order.upsert({
    where: { id: 'ord-001' },
    update: {},
    create: {
      id: 'ord-001',
      clientId: fabrice.id,
      cookId: userCatherine.id,
      riderId: userKevin.id,
      status: OrderStatus.DELIVERED,
      totalXaf: 5800,
      deliveryFeeXaf: 800,
      paymentMethod: PaymentMethod.MTN_MOMO,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryAddress: 'Carrefour Bépanda, Bonabéri, Douala',
      deliveryLat: 4.0679,
      deliveryLng: 9.6668,
      landmark: 'En face du bar Le Palmier',
      clientNote: 'Sonner à l\'interphone',
      createdAt: new Date('2026-03-28T12:15:00Z'),
    },
  });

  await Promise.all([
    prisma.orderItem.upsert({
      where: { id: 'oi-001-a' },
      update: {},
      create: {
        id: 'oi-001-a',
        orderId: order1.id,
        menuItemId: 'mi-ndole-complet',
        quantity: 2,
        unitPriceXaf: 2500,
        subtotalXaf: 5000,
      },
    }),
    prisma.orderItem.upsert({
      where: { id: 'oi-001-b' },
      update: {},
      create: {
        id: 'oi-001-b',
        orderId: order1.id,
        menuItemId: 'mi-miondo',
        quantity: 1,
        unitPriceXaf: 300,
        subtotalXaf: 300,
      },
    }),
  ]);

  await prisma.payment.upsert({
    where: { id: 'pay-001' },
    update: {},
    create: {
      id: 'pay-001',
      orderId: order1.id,
      method: PaymentMethod.MTN_MOMO,
      status: PaymentStatus.SUCCESS,
      amountXaf: 5800,
      providerRef: 'NP-TEST-20260328-001',
      paidAt: new Date('2026-03-28T12:18:00Z'),
    },
  });

  await prisma.delivery.upsert({
    where: { id: 'del-001' },
    update: {},
    create: {
      id: 'del-001',
      orderId: order1.id,
      riderId: riderKevin.id,
      status: DeliveryStatus.DELIVERED,
      pickupLat: 4.0511,
      pickupLng: 9.7085,
      dropoffLat: 4.0679,
      dropoffLng: 9.6668,
      distanceKm: 4.2,
      estimatedMinutes: 20,
      assignedAt: new Date('2026-03-28T12:20:00Z'),
      pickedUpAt: new Date('2026-03-28T12:45:00Z'),
      deliveredAt: new Date('2026-03-28T13:05:00Z'),
      riderEarningXaf: 640,
    },
  });

  await prisma.review.upsert({
    where: { id: 'rev-001', orderId_authorId: { orderId: order1.id, authorId: fabrice.id } },
    update: {},
    create: {
      id: 'rev-001',
      orderId: order1.id,
      authorId: fabrice.id,
      cookRating: 5,
      riderRating: 5,
      cookComment: 'Le Ndolé de Maman Catherine est divin ! Exactement le goût de chez maman.',
      riderComment: 'Kevin est rapide et sympa. Commande arrivée chaude !',
    },
  });

  // Commande 2 — PREPARING (Fabrice → Tantine Rose)
  const order2 = await prisma.order.upsert({
    where: { id: 'ord-002' },
    update: {},
    create: {
      id: 'ord-002',
      clientId: fabrice.id,
      cookId: userRose.id,
      status: OrderStatus.PREPARING,
      totalXaf: 5000,
      deliveryFeeXaf: 1000,
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryAddress: 'Rue des brasseries, Bonabéri',
      deliveryLat: 4.0670,
      deliveryLng: 9.6680,
      clientNote: 'Pas trop pimenté s\'il vous plaît',
      createdAt: new Date('2026-04-02T11:30:00Z'),
    },
  });

  await Promise.all([
    prisma.orderItem.upsert({
      where: { id: 'oi-002-a' },
      update: {},
      create: {
        id: 'oi-002-a',
        orderId: order2.id,
        menuItemId: 'mi-poulet-dg-demi',
        quantity: 2,
        unitPriceXaf: 2500,
        subtotalXaf: 5000,
      },
    }),
  ]);

  await prisma.payment.upsert({
    where: { id: 'pay-002' },
    update: {},
    create: {
      id: 'pay-002',
      orderId: order2.id,
      method: PaymentMethod.ORANGE_MONEY,
      status: PaymentStatus.SUCCESS,
      amountXaf: 5000,
      providerRef: 'NP-TEST-20260402-002',
      paidAt: new Date('2026-04-02T11:32:00Z'),
    },
  });

  // Commande 3 — PENDING (Aminata → Le Circuit d'Akwa)
  const order3 = await prisma.order.upsert({
    where: { id: 'ord-003' },
    update: {},
    create: {
      id: 'ord-003',
      clientId: aminata.id,
      cookId: userCircuit.id,
      status: OrderStatus.PENDING,
      totalXaf: 3800,
      deliveryFeeXaf: 1500,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
      deliveryAddress: 'Avenue des Ambassades, Bastos, Yaoundé',
      deliveryLat: 3.8754,
      deliveryLng: 11.5197,
      landmark: 'Résidence Les Frangipaniers, porte 12B',
      createdAt: new Date('2026-04-02T18:45:00Z'),
    },
  });

  await Promise.all([
    prisma.orderItem.upsert({
      where: { id: 'oi-003-a' },
      update: {},
      create: {
        id: 'oi-003-a',
        orderId: order3.id,
        menuItemId: 'mi-soya-boeuf',
        quantity: 1,
        unitPriceXaf: 1500,
        subtotalXaf: 1500,
      },
    }),
    prisma.orderItem.upsert({
      where: { id: 'oi-003-b' },
      update: {},
      create: {
        id: 'oi-003-b',
        orderId: order3.id,
        menuItemId: 'mi-brochettes-poulet',
        quantity: 1,
        unitPriceXaf: 2000,
        subtotalXaf: 2000,
      },
    }),
  ]);

  // Commande 4 — CANCELLED (Aminata → Maman Catherine)
  const order4 = await prisma.order.upsert({
    where: { id: 'ord-004' },
    update: {},
    create: {
      id: 'ord-004',
      clientId: aminata.id,
      cookId: userCatherine.id,
      status: OrderStatus.CANCELLED,
      totalXaf: 2500,
      deliveryFeeXaf: 800,
      paymentMethod: PaymentMethod.MTN_MOMO,
      paymentStatus: PaymentStatus.FAILED,
      deliveryAddress: 'Bastos, Yaoundé',
      deliveryLat: 3.8754,
      deliveryLng: 11.5197,
      cancelReason: 'Paiement refusé par la banque',
      createdAt: new Date('2026-04-01T09:00:00Z'),
    },
  });

  await prisma.orderItem.upsert({
    where: { id: 'oi-004-a' },
    update: {},
    create: {
      id: 'oi-004-a',
      orderId: order4.id,
      menuItemId: 'mi-ndole-complet',
      quantity: 1,
      unitPriceXaf: 2500,
      subtotalXaf: 2500,
    },
  });

  await prisma.payment.upsert({
    where: { id: 'pay-004' },
    update: {},
    create: {
      id: 'pay-004',
      orderId: order4.id,
      method: PaymentMethod.MTN_MOMO,
      status: PaymentStatus.FAILED,
      amountXaf: 2500,
      failureReason: 'Solde insuffisant',
    },
  });

  // Commande 5 — PICKED_UP (Fabrice → Circuit d'Akwa, Kevin en route)
  const order5 = await prisma.order.upsert({
    where: { id: 'ord-005' },
    update: {},
    create: {
      id: 'ord-005',
      clientId: fabrice.id,
      cookId: userCircuit.id,
      riderId: userKevin.id,
      status: OrderStatus.PICKED_UP,
      totalXaf: 2900,
      deliveryFeeXaf: 700,
      paymentMethod: PaymentMethod.ORANGE_MONEY,
      paymentStatus: PaymentStatus.SUCCESS,
      deliveryAddress: 'Marché de Bonabéri, Douala',
      deliveryLat: 4.0670,
      deliveryLng: 9.6655,
      createdAt: new Date('2026-04-02T19:00:00Z'),
    },
  });

  await Promise.all([
    prisma.orderItem.upsert({
      where: { id: 'oi-005-a' },
      update: {},
      create: {
        id: 'oi-005-a',
        orderId: order5.id,
        menuItemId: 'mi-soya-porc',
        quantity: 1,
        unitPriceXaf: 1500,
        subtotalXaf: 1500,
      },
    }),
    prisma.orderItem.upsert({
      where: { id: 'oi-005-b' },
      update: {},
      create: {
        id: 'oi-005-b',
        orderId: order5.id,
        menuItemId: 'mi-beignets-haricots',
        quantity: 1,
        unitPriceXaf: 800,
        subtotalXaf: 800,
      },
    }),
  ]);

  await prisma.payment.upsert({
    where: { id: 'pay-005' },
    update: {},
    create: {
      id: 'pay-005',
      orderId: order5.id,
      method: PaymentMethod.ORANGE_MONEY,
      status: PaymentStatus.SUCCESS,
      amountXaf: 2900,
      providerRef: 'NP-TEST-20260402-005',
      paidAt: new Date('2026-04-02T19:03:00Z'),
    },
  });

  await prisma.delivery.upsert({
    where: { id: 'del-005' },
    update: {},
    create: {
      id: 'del-005',
      orderId: order5.id,
      riderId: riderKevin.id,
      status: DeliveryStatus.PICKED_UP,
      pickupLat: 4.0605,
      pickupLng: 9.7254,
      dropoffLat: 4.0670,
      dropoffLng: 9.6655,
      distanceKm: 5.1,
      estimatedMinutes: 25,
      assignedAt: new Date('2026-04-02T19:10:00Z'),
      pickedUpAt: new Date('2026-04-02T19:28:00Z'),
      riderEarningXaf: 560,
    },
  });

  console.log('   ✅ 5 commandes créées (DELIVERED, PREPARING, PENDING, CANCELLED, PICKED_UP)\n');

  // ============================================================
  // NOTIFICATIONS
  // ============================================================

  console.log('🔔 Création des notifications...');

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: fabrice.id,
        type: 'ORDER_DELIVERED',
        title: 'Commande livrée !',
        body: 'Votre Ndolé de Maman Catherine est arrivé. Bon appétit !',
        data: JSON.stringify({ orderId: order1.id }),
        isRead: true,
        readAt: new Date('2026-03-28T13:10:00Z'),
        createdAt: new Date('2026-03-28T13:05:00Z'),
      },
    }),
    prisma.notification.create({
      data: {
        userId: fabrice.id,
        type: 'ORDER_PREPARING',
        title: 'Tantine Rose prépare votre commande',
        body: 'Votre Poulet DG est en cours de préparation. Temps estimé : 30 min.',
        data: JSON.stringify({ orderId: order2.id }),
        isRead: false,
        createdAt: new Date('2026-04-02T11:35:00Z'),
      },
    }),
    prisma.notification.create({
      data: {
        userId: userCatherine.id,
        type: 'NEW_ORDER',
        title: 'Nouvelle commande reçue !',
        body: 'Fabrice commande 2 Ndolé complet depuis Bonabéri.',
        data: JSON.stringify({ orderId: order1.id }),
        isRead: true,
        readAt: new Date('2026-03-28T12:17:00Z'),
        createdAt: new Date('2026-03-28T12:15:00Z'),
      },
    }),
    prisma.notification.create({
      data: {
        userId: userKevin.id,
        type: 'DELIVERY_ASSIGNED',
        title: 'Nouvelle livraison assignée',
        body: 'Récupérez la commande chez Maman Catherine (Akwa) → Bonabéri. 4.2 km.',
        data: JSON.stringify({ orderId: order5.id, deliveryId: 'del-005' }),
        isRead: false,
        createdAt: new Date('2026-04-02T19:10:00Z'),
      },
    }),
  ]);

  console.log('   ✅ 4 notifications créées\n');

  // ============================================================
  // RÉSUMÉ
  // ============================================================

  console.log('═══════════════════════════════════════');
  console.log('✅ SEED NYAMA terminé avec succès !');
  console.log('═══════════════════════════════════════');
  console.log('📊 Récapitulatif :');
  console.log('   • 10 quartiers  (5 Douala + 5 Yaoundé)');
  console.log('   • 3  cuisinières (Catherine, Rose, Aristide)');
  console.log('   • 17 plats au menu');
  console.log('   • 2  clients    (Fabrice, Aminata)');
  console.log('   • 2  livreurs   (Kevin moto, Paul vélo)');
  console.log('   • 5  commandes  (statuts variés)');
  console.log('   • OTP dev universelle : 123456');
  console.log('');
  console.log('📱 Numéros de test :');
  console.log('   +237690000001  Maman Catherine (COOK)');
  console.log('   +237690000002  Tantine Rose    (COOK)');
  console.log('   +237690000003  Circuit d\'Akwa  (COOK)');
  console.log('   +237691000001  Fabrice         (CLIENT)');
  console.log('   +237677000010  Aminata         (CLIENT)');
  console.log('   +237692000001  Kevin           (RIDER)');
  console.log('   +237651000002  Paul            (RIDER)');
  console.log('═══════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
