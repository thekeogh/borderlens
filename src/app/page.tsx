/**
 * Disables automatic revalidation for this route, ensuring static content is served without regeneration.
 *
 * @remarks
 * This setting is specifically for the showcase feature, which displays randomised results on each page refresh. By
 * preventing revalidation, the page remains static and relies on client-side rendering to generate different showcase
 * selections.
 */
export const revalidate = 0;

export default function Home() {
  return (
    <>
      Hello World
    </>
  );
}
