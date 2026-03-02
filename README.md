# Borderlens

Borderlens is an item database and reference site for the Borderlands series, focused on clear stats and legendary behaviour without the noise. Covering Borderlands 1 and 2, it provides full item breakdowns, stat ranges, and reliable drop sources, whether you're planning a build, farming a specific legendary, or figuring out why a weapon rolled the way it did.

It also includes a Claptrap-powered AI assistant that can look up items, compare stats, explain part effects, and help reason about perfect rolls.

## Component Playground

Borderlens includes an internal component playground at `/dev/playground` for building and testing UI components in-place, allowing you to browse components from `src/components` in the explorer tree, edit props live and preview changes instantly.

### Usage

**Run the app as normal:**

```bash
pnpm dev
```

**Next, access the following link in your browser:**

```text
https://dev.borderlens.tools:3000/dev/playground
```

> [!NOTE]
> The playground registry is generated automatically by `playground:sync` during both `dev` and `build`. When running `pnpm dev`, `playground:watch` monitors `src/components` and regenerates the registry on changes, keeping the explorer tree and prop controls in sync without needing to restart.

> [!IMPORTANT]
> The playground is available exclusively in development and cannot be accessed in any other environment.
