import { Ui, Pages, Features } from "#components";

export default function Home() {
  return (
    <>
      <Ui.Section width="narrow" separator padding="lg">
        <Pages.Home.Hero />
        <Features.Search />
      </Ui.Section>
    </>
  );
}
