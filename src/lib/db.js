import { PrismaClient } from '@prisma/client';

const getDatabaseUrl = () => {
  const rawUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    if (process.env.POSTGRES_PRISMA_URL) {
      url.searchParams.set('pgbouncer', 'true');
    }
    url.searchParams.set('connection_limit', '1');
    return url.toString();
  } catch {
    return rawUrl;
  }
};

const prismaClientSingleton = () => {
  const databaseUrl = getDatabaseUrl();
  return new PrismaClient(databaseUrl
    ? { datasources: { db: { url: databaseUrl } } }
    : undefined);
};

const globalForPrisma = global;

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
