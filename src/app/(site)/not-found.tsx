import Link from "next/link";

// TODO: Make this pretty
export default function NotFound() {
  return (
    <main>
      <h1>
        Page not found!!!!!!!
      </h1>
      <p style={{ color: "var(--color-zinc-500)" }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/">
        Back to home
      </Link>
    </main>
  );
}
