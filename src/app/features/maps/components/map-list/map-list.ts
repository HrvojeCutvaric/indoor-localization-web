import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { type Map } from '../../../../core/services/map.service';

@Component({
  selector: 'app-map-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-list.html',
  styleUrl: './map-list.scss',
})
export class MapList {
  @Input() maps: Map[] = [];
  @Input() loading = false;
  @Output() delete = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();

  onDelete(id: string): void {
    this.delete.emit(id);
  }

  onEdit(id: string): void {
    this.edit.emit(id);
  }
}
