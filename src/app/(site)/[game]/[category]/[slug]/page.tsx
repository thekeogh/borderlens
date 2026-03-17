import type { Game, Category } from "#database/schema/types";

interface Props {
  params: Promise<{ game: Game; category: Category; slug: string }>
};

export default async function Item({ params }: Props) {
  const { game, category, slug } = await params;

  return (
    <>
      <p>Game: {game}</p>
      <p>Category: {category}</p>
      <p>Slug: {slug}</p>
    </>
  );
}
