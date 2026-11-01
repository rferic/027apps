/**
 * Family-set estándar de los tests (`docs/conventions/testing-strategy.md` §3):
 * un grupo "familia" con cuatro miembros —la pareja incluida— y EUR como
 * moneda base (ADR 0008). Es la base de los escenarios realistas; las factories
 * por entidad viven en este mismo paquete cuando exista el módulo que las usa.
 */

export type FamilyMemberKey = 'owner' | 'partner' | 'child' | 'fictitious';

export interface FamilyMember {
  readonly key: FamilyMemberKey;
  readonly displayName: string;
  readonly locale: string;
}

export interface FamilySet {
  readonly groupName: string;
  readonly currency: 'EUR';
  readonly timezone: string;
  readonly members: readonly FamilyMember[];
}

export const FAMILY_SET: FamilySet = {
  groupName: 'familia',
  currency: 'EUR',
  timezone: 'Europe/Madrid',
  members: [
    { key: 'owner', displayName: 'Parent A', locale: 'es' },
    { key: 'partner', displayName: 'Parent B', locale: 'es' },
    { key: 'child', displayName: 'Child', locale: 'es' },
    { key: 'fictitious', displayName: 'Fixture User', locale: 'en' },
  ],
};
