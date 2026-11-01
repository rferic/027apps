/**
 * Standard test family-set (`docs/conventions/testing-strategy.md` §3):
 * a "familia" group with four members —partner included— and EUR as the
 * base currency (ADR 0008). It is the base for realistic scenarios; per-entity
 * factories live in this same package once the module that uses them exists.
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
