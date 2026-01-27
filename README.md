# Borderlens

A weapon database for the Borderlands series with clear data on stats, parts, and legendary behaviour. Currently focused on Borderlands 1, with a Claptrap-powered AI assistant to help explore weapons, compare stats, and understand part effects.

## Architecture

- **Stack**: Next.js 16, TypeScript, deployed to Vercel using Server Actions and Client Components.
- **Data structure**: Individual JSON files in `data/` are compiled at build time into single `*.json` files per category stored in `src/database/*`.
- **Validation**: A single Zod schema validates all data during the build process and `infer`'s types across the application.
- **Querying**: Server Components use pure TypeScript to query the database for listing/detail pages. Interactive features (search) use Server Actions with `Fuse.js` for fuzzy matching.
- **Build process**: `npm run build` → Validate with Zod → Compile JSONs → `next build`. Invalid data fails the build in both local and CI/CD environments.

### Project Structure

For a detailed breakdown of the application architecture, folder organisation, and code examples, see [STRUCTURE.md](./STRUCTURE.md).

## Setup

### Development SSL

> [!IMPORTANT]
> You must complete this setup before running the development server. The server only works over HTTPS and will only serve on `dev.borderlens.tools`.

**Install mkcert:**
```bash
brew install mkcert
```

**Generate development certificates:**
```bash
mkdir -p .certs
mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem "dev.borderlens.tools" localhost 127.0.0.1
```
