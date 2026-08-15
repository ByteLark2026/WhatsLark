import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Gates service-to-service endpoints (e.g. the webhook process triggering an
 *  automated action) with a shared secret instead of a user JWT — there's no
 *  logged-in user for these calls. Always rejects if INTERNAL_API_SECRET isn't
 *  configured, rather than silently allowing unauthenticated access. */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_API_SECRET;
    if (!expected) throw new UnauthorizedException('Internal API secret not configured');

    const request = context.switchToHttp().getRequest();
    const provided = request.headers?.['x-internal-secret'];
    if (provided !== expected) throw new UnauthorizedException('Invalid internal secret');

    return true;
  }
}
