export interface Pageable {
  page: number;
  size: number;
  sort?: string[];
}

export interface SortObject {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

export interface PageableObject {
  offset: number;
  pageSize: number;
  pageNumber: number;
  paged: boolean;
  unpaged: boolean;
  sort: SortObject;
}

export interface Page<T> {
  totalPages: number;
  totalElements: number;
  size: number;
  content: T[];
  number: number;
  sort: SortObject;
  pageable: PageableObject;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
