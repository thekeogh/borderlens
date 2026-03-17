import { NextResponse, type NextRequest } from "next/server";

import { Category } from "#database/schema/category.schema";
import { Game } from "#database/schema/game.schema";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * Redirects requests with uppercase characters in the pathname to their lowercase equivalents.
   *
   * @remarks
   * This check ensures that all pathnames are consistently treated in lowercase, enforcing a normalised URL structure.
   * Requests with uppercase path segments are redirected using a permanent redirect status code (308).
   */
  if (pathname !== pathname.toLowerCase()) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 308);
  }

  /**
   * Splits the pathname into an array of non-empty segments.
   */
  const segments = pathname.split("/").filter(Boolean);

  /**
   * Proceeds with the request when the pathname contains no segments.
   */
  if (segments.length === 0) {
    return NextResponse.next();
  }

  /**
   * Handles requests to the "search" segment with query parameter validation.
   *
   * @remarks
   * When the first segment of the path is "search", this block validates the presence of the "q" query parameter. If
   * the parameter is missing or empty, the request is redirected to the home page using a temporary redirect (307).
   * Otherwise, the request proceeds as normal.
   */
  if (segments[0] === "search") {
    const q = request.nextUrl.searchParams.get("q");
    if (!q || !q.trim().length) {
      return NextResponse.redirect(new URL("/", request.url), 307);
    }
    return NextResponse.next();
  }

  /**
   * Validates and rewrites routes for recognised games and categories.
   *
   * @remarks
   * If the first path segment is a valid game, this block checks the second segment for a valid category. When the
   * category is missing, invalid, or the total number of segments exceeds three, the request is rewritten to the 404
   * page. Otherwise, the request proceeds as normal.
   */
  if (Game.safeParse(segments[0]).success) {
    const hasValidCategory = segments.length >= 2 && Category.safeParse(segments[1]).success;
    if (!hasValidCategory || segments.length > 3) {
      return NextResponse.rewrite(new URL("/404", request.url));
    }
    return NextResponse.next();
  }

  /**
   * Allows the request to proceed as normal when all validation checks are passed.
   */
  return NextResponse.rewrite(new URL("/404", request.url));
}

/**
 * Middleware matcher configuration for selective route handling.
 *
 * @remarks
 * This configuration applies middleware to all routes except for those under "/api", Next.js static assets, image
 * optimisation routes, and PNG image files.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};