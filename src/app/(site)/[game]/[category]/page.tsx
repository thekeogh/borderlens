import type { Game, Category } from "#database/schema/types";

interface Props {
  params: Promise<{ game: Game; category: Category }>
};

export default async function Category({ params }: Props) {
  const { game, category } = await params;

  return (
    <>
      <p>Game: {game}</p>
      <p>Category: {category}</p>
    </>
  );
}
