import { Grid as GridRoot } from "./grid";
import { Column } from "./grid/column";
import { Row } from "./grid/row";

export * from "./section";
export * from "./title";

export const Grid = Object.assign(GridRoot, { Row, Column });