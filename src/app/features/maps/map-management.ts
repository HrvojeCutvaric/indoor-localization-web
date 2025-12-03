import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService, type Map } from '../../core/services/map.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MapUploadForm } from './components/map-upload-form/map-upload-form';
import { MapList } from './components/map-list/map-list';

@Component({
  selector: 'app-map-management',
  standalone: true,
  imports: [CommonModule, MapUploadForm, MapList],
  templateUrl: './map-management.html',
  styleUrl: './map-management.scss',
})
export class MapManagement implements OnInit, OnDestroy {
  private mapService = inject(MapService);
  private destroy$ = new Subject<void>();

  maps: Map[] = [];
  loading = false;
  selectedMapId: string | null = null;
  showUploadForm = false;

  ngOnInit(): void {
    this.mapService.maps$
      .pipe(takeUntil(this.destroy$))
      .subscribe((maps: Map[]) => {
        this.maps = maps;
      });

    this.mapService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading: boolean) => {
        this.loading = loading;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMapUploaded(): void {
    this.showUploadForm = false;
    this.selectedMapId = null;
  }

  onMapDeleted(id: string): void {
    if (confirm('Are you sure you want to delete this map?')) {
      this.mapService.deleteMap(id).subscribe({
        next: () => {
          this.mapService.loadMaps();
        },
        error: (err: any) => {
          alert(`Failed to delete map: ${err.message}`);
        },
      });
    }
  }

  onMapEdited(id: string): void {
    this.selectedMapId = id;
    this.showUploadForm = true;
  }

  closeUploadForm(): void {
    this.showUploadForm = false;
    this.selectedMapId = null;
  }
}
