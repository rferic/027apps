import pkg from '../package.json';

/** Deployed Core version, served by GET /instance. */
export const CORE_VERSION: string = pkg.version;
