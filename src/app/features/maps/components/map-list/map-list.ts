import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService, type Map } from '../../../../core/services/map.service';

@Component({
  selector: 'app-map-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-list.html',
  styleUrl: './map-list.scss',
})
export class MapList {
  private mapService = inject(MapService);

  @Input() maps: Map[] = [];
  @Input() loading = false;
  @Output() delete = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();
  @Output() view = new EventEmitter<string>();

  onDelete(id: string): void {
    this.delete.emit(id);
  }

  onEdit(id: string): void {
    this.edit.emit(id);
  }

  onView(id: string): void {
    this.view.emit(id);
  }


  getImageUrl(image: string | undefined): string {
    return this.mapService.getFullImageUrl(image);
  }
}
