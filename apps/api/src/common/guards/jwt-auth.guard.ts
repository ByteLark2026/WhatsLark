import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Verifies Supabase's ES256-signed JWTs locally against their cached public JWKS,
// instead of making a live network call to Supabase Auth on every single request
// (that round-trip was costing ~300-400ms per request — see perf investigation).
// jose's createRemoteJWKSet caches the key set internally and only refetches on
// a kid it hasn't seen before, so this stays a local/cryptographic check in steady state.
//
// Lazily initialized (not a module-level const) because env vars aren't loaded yet
// when this file is first required — Nest's ConfigModule runs later in the bootstrap
// than Node's module resolution of guards/controllers.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('No access token');

    let payload: any;
    try {
      ({ payload } = await jwtVerify(token, getJwks(), {
        issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      }));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    // Attach user + token to request for downstream use — shape matches what
    // supabase.auth.getUser() used to return (id, email, ...claims) so nothing
    // downstream (CurrentUser('id') etc.) needs to change.
    request.user = { id: payload.sub, ...payload };
    request.accessToken = token;

    return true;
  }

  private extractToken(request: any): string | null {
    const auth = request.headers?.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
