import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env.client";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

const STATIC_ASSET_PATTERN = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|ttf)$/;

function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    STATIC_ASSET_PATTERN.test(pathname)
  );
}

const isDev = process.env.NODE_ENV === "development";

/**
 * Builds a per-request Content-Security-Policy with a fresh nonce for
 * `script-src`. Next.js automatically applies this nonce to its own inline
 * hydration/RSC scripts once it sees it in this header — see
 * https://nextjs.org/docs/app/guides/content-security-policy. Reading the
 * nonce anywhere in the render tree (RootLayout does, via headers()) opts
 * the whole app into dynamic rendering, which this app already needs for
 * every route except /login (auth state is inherently per-request anyway).
 *
 * `style-src` keeps `'unsafe-inline'` regardless of nonce: Base UI (shadcn/ui's
 * primitives) sets inline `style` *attributes* for popover/overlay
 * positioning, and CSP nonces only cover `<style>` elements/`<script>`
 * elements, not style attributes — there is no nonce-based alternative for
 * that today. Documented as an accepted, narrow trade-off in SECURITY.md.
 *
 * `upgrade-insecure-requests` is production-only: sending it over local
 * plain-HTTP dev makes Chrome force-upgrade every subsequent request on the
 * page to https:// and fail with ERR_SSL_PROTOCOL_ERROR — confirmed by
 * actually loading the app, not by inspecting the policy string.
 *
 * When Plaid Link ships (Phase 3), this policy needs `script-src
 * https://cdn.plaid.com`, `connect-src https://production.plaid.com
 * https://sandbox.plaid.com`, and `frame-src https://cdn.plaid.com` added.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${clientEnv.NEXT_PUBLIC_SUPABASE_URL}${isDev ? " ws:" : ""}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Runs on every request (Next.js 16 proxy, formerly middleware): sets a
 * per-request nonced CSP, refreshes the Supabase session cookie, and
 * redirects unauthenticated requests away from protected routes before they
 * ever reach a Server Component. This is a UX/defense-in-depth layer, not
 * the authorization boundary — every server action/route handler still
 * independently calls requireUser().
 *
 * Static assets are excluded by a plain string/extension check here, in the
 * function body, rather than a `matcher` regex — a negative-lookahead
 * matcher was tried first and did not reliably exclude `/_next/static/...`
 * in practice (confirmed by actually loading the app: CSS requests were
 * getting redirected to /login, which broke all styling). This is
 * unambiguous and easy to verify by reading it.
 */
export async function proxy(request: NextRequest) {
  if (isStaticAssetPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request });
  response.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          response.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const proxyConfig = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
