import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, TemplateRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FaIconComponent} from '@fortawesome/angular-fontawesome';
import {Observable} from 'rxjs';
import {Button} from '../button/button';

export interface TableColumn {
  name: string;
  property?: string; // Propriedade do objeto a ser exibida
  icon?: string;
  iconPosition?: 'start' | 'end';
  click?: (row: any) => void;
  checkbox?: boolean;
  width?: string;
  sortable?: boolean;
  booleanChip?: boolean;
  trueText?: string;
  falseText?: string;
  cellClass?: string;
  headerClass?: string;
  cellTemplate?: TemplateRef<any>;
  cellTextLength?: number;

  iconConfig?: {
    cell?: IconConfig;
    header?: IconConfig;
  };
}

interface IconConfig {
  name: string;
  position?: 'start' | 'end';
  class?: string;
}

export interface TableConfig {
  selectable?: boolean;
  rowSelectable?: boolean;
  headerVisible?: boolean;
  actions?: TableAction[];
  actionsHeaderClass?: string;
  actionsCellClass?: string;
}

interface TableAction {
  name: string;
  label?: string;
  icon?: string;
  tooltip?: string;
  class?: string;
  iconPosition?: 'start' | 'end';
  rounded?: boolean;
  severity?: any;
  disabled?: boolean;
  variant?: 'text' | 'outlined' | undefined;
  showLabel?: boolean;
  handler: (row: any) => void;
}

@Component({
  selector: 'app-table',
  standalone: true,
  imports: [CommonModule, FaIconComponent, Button],
  templateUrl: './table.html',
  styleUrl: './table.scss',
})
export class Table {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() config: TableConfig = {
    selectable: false,
    rowSelectable: false,
    headerVisible: true
  };

  @Output() rowClick = new EventEmitter<any>();
  @Output() selectionChange = new EventEmitter<any[]>();

  selectedRows = new Set<any>();

  toggleRowSelection(row: any): void {
    if (this.config.rowSelectable) {
      if (this.selectedRows.has(row)) {
        this.selectedRows.delete(row);
      } else {
        this.selectedRows.add(row);
      }
      this.selectionChange.emit(Array.from(this.selectedRows));
    }
  }

  handleCheckboxChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.toggleAllSelection(target.checked);
  }

  handleRowCheckboxChange(event: Event, row: any): void {
    event.stopPropagation();
    const target = event.target as HTMLInputElement;
    this.toggleRowSelection(row);
  }

  toggleAllSelection(checked: boolean): void {
    this.selectedRows.clear();
    if (checked) {
      this.data.forEach(item => this.selectedRows.add(item))
    }
    this.selectionChange.emit(Array.from(this.selectedRows));
  }

  handleColumnClick(column: TableColumn, row: any): void {
    if (column.click) {
      column.click(row);
    }
  }

  public handleRowClick(row: any): void {
    if (this.config.rowSelectable) {
      this.selectedRows.clear();
      this.selectedRows.add(row);
    }
    this.rowClick.emit(row);
  }

  public formatText(value: string, length: number = 20): string {
    return value?.length > length ? value.slice(0, length) + '...' : value;
  }

}
