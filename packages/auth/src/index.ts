// Types
export type { ZooidJWT, TrustedKeyRow } from './types';
export type {
  OIDCClaims,
  ResolvedAuth,
  ScopeResolutionEnv,
} from './scope-mapper';

// Scope utilities
export {
  normalizeScopes,
  scopeMatchesPattern,
  hasScope,
  canPublish,
  canSubscribe,
  isAdmin,
  enforceScopeCeiling,
} from './scopes';

// OIDC scope resolution
export { resolveScopes } from './scope-mapper';

// Ed25519 signing
export {
  generateKeyPair,
  signPayload,
  verifySignature,
  exportPublicKey,
  importPrivateKey,
  importPublicKey,
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from './signing';

// Base64url encoding
export {
  base64urlEncodeString,
  base64urlEncodeBuffer,
  base64urlDecodeString,
  base64urlDecodeBuffer,
} from './base64url';
