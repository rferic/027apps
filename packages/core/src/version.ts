import pkg from '../package.json';

/** Deployed Core version, served by GET /instance. */
export const CORE_VERSION: string = pkg.version;

/**
 * Generation of the module contract. Bumped only on incompatible changes
 * (required fields, changed semantics); additive changes keep it. A module
 * declares the same integer and the installer refuses a mismatch, so a package
 * built for another generation never runs with the wrong expectations.
 */
export const CORE_CONTRACT = 1;
