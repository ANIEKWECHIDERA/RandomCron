import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
