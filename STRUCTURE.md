# Borderlens Project Structure

## Overview
This document outlines the complete folder structure for Borderlens, a comprehensive weapon database for the Borderlands video game series.

---

## Root Structure

```
borderlens/
├── data/                                    # Source JSON weapon data
│   ├── borderlands/
│   │   └── weapons/                         # Individual weapon JSON files
│   └── docs/                                # Schema documentation
│
├── public/                                  # Static assets served publicly
│   ├── data/
│   │   └── borderlands/
│   │       └── weapons/
│   │           └── img/                     # Weapon images
│   ├── img/
│   │   ├── branding/                        # Logo, icons
│   │   └── meta/                            # Social share images
│   ├── robots.txt
│   └── sitemap.xml
│
├── scripts/                                 # Build-time automation scripts
│
├── src/
│   ├── app/                                 # Next.js App Router
│   │   └── weapons/
│   │       └── [slug]/                      # Dynamic weapon detail pages
│   │
│   ├── components/                          # React components
│   │   ├── features/                        # Feature-specific components
│   │   │   ├── search/
│   │   │   └── weapon-card/
│   │   ├── layout/                          # Header, footer, nav
│   │   │   ├── header/
│   │   │   └── footer/
│   │   ├── pages/                           # Page-specific components
│   │   │   └── home/
│   │   │       └── hero/
│   │   └── ui/                              # Generic UI components
│   │       ├── button/
│   │       └── separator/
│   │
│   ├── config/                              # Application configuration
│   │
│   ├── css/                                 # Global stylesheets
│   │
│   ├── database/                            # Data abstraction layer
│   │   └── borderlands/                     # Game-specific data/queries
│   │
│   └── utils/                               # Shared utility functions
│
├── .env.local                               # Environment variables (gitignored)
├── .env.example                             # Environment template
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## `/data`
**Purpose:** Source of truth for all game data. Contains individual JSON files for each weapon, shield, etc.

**Structure:**
```
data/
├── borderlands/
│   └── weapons/
│       ├── ajaxs-spear.json
│       ├── hellfire.json
│       └── volcano.json
└── docs/
    └── schema.md
```

**Example File:** `data/borderlands/weapons/hellfire.json`
```json
{
  "name": "Hellfire",
  "type": "SMG",
  "manufacturer": ["Maliwan"],
  "rarity": ["Legendary"],
  "elements": ["Incendiary"],
  "multiplier": [4.0],
  "description": "The Hellfire is a Legendary Maliwan SMG...",
  "ranges": {
    "damage": [20.0, 359.0],
    "accuracy": [78.7, 93.5]
  }
}
```

---

## `/public`
**Purpose:** Static assets served directly to the browser without processing.

**Structure:**
```
public/
├── data/
│   └── borderlands/
│       └── weapons/
│           └── img/
│               ├── ajaxs-spear.png
│               └── hellfire.png
├── img/
│   ├── branding/
│   │   ├── icon-complex.png
│   │   └── logo.png
│   └── meta/
│       └── 1200x630.jpg
├── robots.txt
└── sitemap.xml
```

**Access Pattern:**
- Files in `/public` are served at the root path
- `public/img/branding/logo.png` → accessible at `/img/branding/logo.png`

---

## `/scripts`
**Purpose:** Build-time automation scripts that process and validate data.

**Structure:**
```
scripts/
├── bundle-weapons.ts
├── validate-schema.ts
└── package.json
```

**Example File:** `scripts/bundle-weapons.ts`
```typescript
import fs from "fs";
import path from "path";

// Compile all individual weapon JSONs into a single bundled file
const weaponsDir = path.join(process.cwd(), "data/borderlands/weapons");
const outputPath = path.join(process.cwd(), "src/database/borderlands/weapons.json");

const files = fs.readdirSync(weaponsDir).filter(f => f.endsWith(".json"));
const weapons = files.map(file => {
  const content = fs.readFileSync(path.join(weaponsDir, file), "utf-8");
  return JSON.parse(content);
});

fs.writeFileSync(outputPath, JSON.stringify(weapons, null, 2));
console.log(`✓ Bundled ${weapons.length} weapons`);
```

**Usage in `package.json`:**
```json
{
  "scripts": {
    "prebuild": "tsx scripts/bundle-weapons.ts",
    "build": "next build"
  }
}
```

---

## `/src/app`
**Purpose:** Next.js App Router directory. Contains all routes, layouts, and page components.

**Structure:**
```
src/app/
├── layout.tsx              # Root layout
├── page.tsx                # Homepage (/)
└── weapons/
    ├── page.tsx            # Weapons listing (/weapons)
    └── [slug]/
        └── page.tsx        # Weapon detail (/weapons/hellfire)
```

**Example File:** `src/app/weapons/page.tsx`
```typescript
import { borderlands } from "#database";

import { WeaponCard } from "#components";

export default function WeaponsPage() {
  const weapons = borderlands.weapons.list();

  return (
    <main>
      <h1>Weapons Database</h1>
      <div className="grid">
        {weapons.map(weapon => (
          <WeaponCard key={weapon.name} weapon={weapon} />
        ))}
      </div>
    </main>
  );
}
```

---

## `/src/components`
**Purpose:** Reusable React components organized by category.

**Structure:**
```
src/components/
├── index.ts                # Barrel export
├── features/               # Feature-specific components
│   ├── index.ts
│   ├── search/
│   │   ├── index.tsx
│   │   └── style.module.css
│   └── weapon-card/
│       ├── index.tsx
│       └── style.module.css
├── layout/                 # Layout components (header, footer)
│   ├── index.ts
│   ├── header/
│   └── footer/
├── pages/                  # Page-specific components
│   ├── index.ts
│   └── home/
│       └── hero/
└── ui/                     # Generic UI components
    ├── index.ts
    ├── button/
    └── separator/
```

**Example File:** `src/components/features/weapon-card/index.tsx`
```typescript
import styles from "./style.module.css";

import type { Weapon } from "#database/schema";

interface WeaponCardProps {
  weapon: Weapon;
}

export function WeaponCard({ weapon }: WeaponCardProps) {
  return (
    <div className={styles.card}>
      <h3>{weapon.name}</h3>
      <p>{weapon.type} • {weapon.manufacturer[0]}</p>
      <span className={styles.rarity}>{weapon.rarity[0]}</span>
    </div>
  );
}
```

**Example File:** `src/components/ui/button/index.tsx`
```typescript
import styles from "./style.module.css";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button className={styles.button} onClick={onClick}>
      {children}
    </button>
  );
}
```

---

## `/src/config`
**Purpose:** Application-wide configuration and constants.

**Structure:**
```
src/config/
├── index.ts
└── meta.ts
```

**Example File:** `src/config/meta.ts`
```typescript
export const meta = {
  title: "Borderlens - Borderlands Weapon Database",
  description: "Comprehensive weapon database for the Borderlands series",
  url: "https://borderlens.tools",
  image: "/img/meta/1200x630.jpg",
};
```

---

## `/src/css`
**Purpose:** Global CSS files and design system tokens.

**Structure:**
```
src/css/
└── globals.css
```

**Example File:** `src/css/globals.css`
```css
:root {
  --color-primary: #ff6b00;
  --color-bg: #1a1a1a;
  --color-text: #ffffff;
  --font-body: 'Inter', sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text);
}
```

**Import in:** `src/app/layout.tsx`
```typescript
import "#css/globals.css";
```

---

## `/src/database`
**Purpose:** Data abstraction layer. Provides a clean API for querying bundled game data.

**Structure:**
```
src/database/
├── index.ts                # Main exports
├── queries.ts              # ItemQueries class
├── schema.ts               # Zod schemas + TypeScript types
└── borderlands/
    ├── index.ts            # Barrel exports
    ├── weapons.ts          # Weapons query instance
    └── weapons.json        # Compiled bundle (gitignored)
```

**Example File:** `src/database/queries.ts`
```typescript
import Fuse from "fuse.js";

export class ItemQueries<T extends { name: string }> {
  private data: T[];
  private fuse: Fuse<T>;

  constructor(data: T[]) {
    this.data = data;
    this.fuse = new Fuse(data, {
      keys: ["name", "description", "manufacturer", "type"],
      threshold: 0.3,
    });
  }

  list(): T[] {
    return this.data;
  }

  findBySlug(slug: string): T | undefined {
    const normalized = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return this.data.find(item =>
      item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === normalized
    );
  }

  search(query: string, limit = 20) {
    if (!query.trim()) return [];
    return this.fuse.search(query).slice(0, limit);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.data.filter(predicate);
  }
}
```

**Example File:** `src/database/borderlands/weapons.ts`
```typescript
import weaponsData from "./weapons.json";

import { ItemQueries } from "../queries";

import type { Weapon } from "../schema";

export const weapons = new ItemQueries<Weapon>(weaponsData as Weapon[]);
```

**Example File:** `src/database/borderlands/index.ts`
```typescript
export * as weapons from "./weapons";
```

**Example File:** `src/database/index.ts`
```typescript
export * as borderlands from "./borderlands";
```

**Example File:** `src/database/schema.ts`
```typescript
import { z } from "zod";

export const WeaponSchema = z.object({
  name: z.string(),
  type: z.string(),
  manufacturer: z.array(z.string()),
  rarity: z.array(z.string()),
  description: z.string().optional(),
  elements: z.array(z.string()).optional(),
  multiplier: z.array(z.number()).optional(),
  ranges: z.object({
    damage: z.tuple([z.number(), z.number()]).optional(),
    accuracy: z.tuple([z.number(), z.number()]).optional(),
  }).optional(),
});

export type Weapon = z.infer<typeof WeaponSchema>;
```

---

## `/src/utils`
**Purpose:** Shared utility functions used across the application.

**Structure:**
```
src/utils/
├── index.ts
├── slugify.ts
├── colors.ts
└── format.ts
```

**Example File:** `src/utils/slugify.ts`
```typescript
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
```

**Example File:** `src/utils/colors.ts`
```typescript
export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    "Common": "#ffffff",
    "Uncommon": "#00ff00",
    "Rare": "#0070dd",
    "Epic": "#a335ee",
    "Legendary": "#ff8000",
    "Pearlescent": "#00ffff",
  };
  return colors[rarity] || "#ffffff";
}
```

**Example File:** `src/utils/format.ts`
```typescript
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-GB").format(num);
}
```

---

## Usage Examples

### Server Component (weapons listing)
```typescript
// src/app/weapons/page.tsx
import { borderlands } from "#database";

export default function WeaponsPage() {
  const weapons = borderlands.weapons.list();
  return <div>{/* render weapons */}</div>;
}
```

### Client Component (search)
```typescript
// src/components/features/search/index.tsx
"use client";

import { useState } from "react";

import { borderlands } from "#database";

export function Search() {
  const [query, setQuery] = useState("");
  const results = borderlands.weapons.search(query);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {/* render results */}
    </div>
  );
}
```

### Detail Page (dynamic route)
```typescript
// src/app/weapons/[slug]/page.tsx
import { notFound } from "next/navigation";

import { borderlands } from "#database";

export default function WeaponDetailPage({ params }: { params: { slug: string } }) {
  const weapon = borderlands.weapons.findBySlug(params.slug);

  if (!weapon) {
    notFound();
  }

  return <div>{/* render weapon details */}</div>;
}
```

---

## Import Patterns

### Path Alias
All imports use the `#` alias (without trailing slash):
```typescript
import { borderlands } from "#database";
import { WeaponCard } from "#components";
import { meta } from "#config";
import { slugify } from "#utils";
import "#css/globals.css";
```

### Barrel Exports
Each folder contains an `index.ts` barrel file:
```typescript
// src/components/index.ts
export * from "./features";
export * from "./layout";
export * from "./pages";
export * from "./ui";
```

This allows clean imports:
```typescript
import { WeaponCard, Header, Button } from "#components";
```

---

## Build Process

1. **Pre-build:** `scripts/bundle-weapons.ts` compiles all JSON files
2. **Validation:** `scripts/validate-schema.ts` ensures data integrity
3. **Build:** Next.js bundles application with compiled data
4. **Output:** Static assets + server functions deployed to Vercel

---

## Key Design Decisions

1. **No Server Actions (for now):** All data bundled client-side. Simple, fast, scales to ~1000 items.
2. **Class-based queries:** `ItemQueries` class provides consistent API across all game data.
3. **Build-time compilation:** Individual JSONs → single bundle per game/type.
4. **CSS Modules:** Co-located styles with `style.module.css` naming.
5. **Type safety:** Zod schemas validate data, infer TypeScript types.
6. **DRY principles:** Shared query logic, barrel exports, path aliases.

---

## Future Expansion

When adding new games (Borderlands 2, 3, etc.):

1. Create `data/borderlands2/weapons/*.json`
2. Add `src/database/borderlands2/` folder
3. Update build script to compile new data
4. Import: `import { borderlands2 } from "#database";`

When adding new item types (shields, grenades):

1. Create `data/borderlands/shields/*.json`
2. Add `src/database/borderlands/shields.ts`
3. Export from `src/database/borderlands/index.ts`
4. Import: `borderlands.shields.list()`