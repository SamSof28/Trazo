import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the admin user');
  }

  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await argon2.hash(env.ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: env.ADMIN_NAME,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      id: randomUUID(),
      name: env.ADMIN_NAME,
      email,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`Admin user ready: ${user.email}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
