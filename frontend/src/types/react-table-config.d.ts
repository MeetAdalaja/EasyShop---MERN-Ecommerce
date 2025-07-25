import {
  UsePaginationInstanceProps,
  UsePaginationState,
  UseSortByInstanceProps,
  UseSortByState,
  UseTableOptions,
  UseTableState,
  UseTableInstanceProps,
  Column,
} from "react-table";

declare module "react-table" {
  export interface TableOptions<D extends object = {}> extends
    UsePaginationInstanceProps<D>,
    UseSortByInstanceProps<D> {}

  export interface TableInstance<D extends object = {}> extends
    UsePaginationInstanceProps<D>,
    UseSortByInstanceProps<D> {}

  export interface TableState<D extends object = {}> extends
    UsePaginationState<D>,
    UseSortByState<D> {}

  export interface ColumnInstance<D extends object = {}> extends
    UseSortByInstanceProps<D> {}
}
