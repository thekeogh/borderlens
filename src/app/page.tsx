import { Ui, Pages, Features } from "#components";
import { H2 } from "#components/ui/title";

export default function Home() {
  return (
    <>

      {/* Hero */}
      <Ui.Section width="narrow" separator padding="lg">
        <Pages.Home.Hero />
        <Features.Search />
      </Ui.Section>

      {/* Legendary weapons  */}
      <Ui.Section padding="md">
        <H2 subtitle="The guns that made Pandora famous">Legendary <span>Weapons</span></H2>
        <Ui.Grid>
          <Ui.Grid.Row>
            <Ui.Grid.Column>Left</Ui.Grid.Column>
            <Ui.Grid.Column>Right</Ui.Grid.Column>
          </Ui.Grid.Row>
        </Ui.Grid>
      </Ui.Section>

    </>
  );
}
