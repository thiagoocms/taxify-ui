import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Button } from '../button/button';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [Button],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class Pagination {
  @Input() pageIndex = 0;
  @Input() totalPages = 0;

  @Output() pageIndexChange = new EventEmitter<number>();

  get isFirstPage(): boolean {
    return this.pageIndex <= 0;
  }

  get isLastPage(): boolean {
    return this.pageIndex + 1 >= this.totalPages;
  }

  previous(): void {
    if (!this.isFirstPage) {
      this.pageIndexChange.emit(this.pageIndex - 1);
    }
  }

  next(): void {
    if (!this.isLastPage) {
      this.pageIndexChange.emit(this.pageIndex + 1);
    }
  }
}
