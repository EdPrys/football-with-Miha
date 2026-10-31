import type { PrismaClient } from '@prisma/client';

export interface CatalogField {
  id: string;
  name: string;
  capacity: number | null;
  formatEvidence: string;
  [key: string]: unknown;
}
export interface CatalogVenue {
  id: string;
  cityId: string;
  name: string;
  fields: CatalogField[];
  [key: string]: unknown;
}
export interface CatalogPlan {
  checkedAt: string | null;
  ready: CatalogVenue[];
  deferred: unknown[];
}
export interface CatalogImportSummary {
  createdVenues: { id: string; cityId: string; name: string }[];
  matchedVenues: { id: string; cityId: string; name: string }[];
  updatedVenues: { id: string; properties: string[] }[];
  createdFields: {
    id: string;
    venueId: string;
    name: string;
    capacity: number | null;
    isActive: boolean;
  }[];
  preservedFields: {
    id: string;
    venueId: string;
    name: string;
    capacity: number | null;
    isActive: boolean;
  }[];
  updatedFields: { id: string; venueId: string; properties: string[] }[];
}
export const catalogDirectory: string;
export function normalizeCatalogName(value: string): string;
export function buildCatalogPlan(directory?: string): CatalogPlan;
export function importCatalog(
  prisma: PrismaClient,
  plan: Pick<CatalogPlan, 'ready'>,
): Promise<CatalogImportSummary>;
export function createCatalogRuntime(): {
  normalize: typeof normalizeCatalogName;
  validatePlan(plan: Pick<CatalogPlan, 'ready'>): void;
  importCatalog: typeof importCatalog;
};
