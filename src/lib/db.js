import { PrismaClient } from '@prisma/client';

const getDatabaseUrl = () => {
  const databaseUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (!databaseUrl || !process.env.POSTGRES_PRISMA_URL) return databaseUrl;

  const url = new URL(databaseUrl);
  url.searchParams.set('pgbouncer', 'true');
  url.searchParams.set('connection_limit', '1');
  return url.toString();
};

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl()
      }
    }
  });
};

const globalForPrisma = global;

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
