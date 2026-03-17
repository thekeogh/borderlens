import { notFound } from "next/navigation";

/**
 * Placeholder page used to trigger the not-found UI when the proxy rewrites invalid category routes.
 *
 * @remarks
 * This route is never navigated to directly. The proxy rewrites requests here so that notFound() can run within
 * the Next.js rendering pipeline and produce the proper 404 page.
 */
export default function NotFoundProxy() {
  notFound();
}
