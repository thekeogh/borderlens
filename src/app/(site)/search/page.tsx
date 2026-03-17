interface Props {
  searchParams: Promise<{ q?: string; g?: string }>
};

export default async function Search({ searchParams }: Props) {
  const query = (await searchParams).q ?? "";
  const games = new Set((await searchParams).g?.split(",") ?? []);

  return (
    <>
      <p>Search query: {query}</p>
      <p>Search games: {games.has("borderlands") ? "YES" : "NO"}</p>
    </>
  );
}
