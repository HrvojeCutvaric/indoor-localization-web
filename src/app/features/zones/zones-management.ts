import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MapService } from '../../core/services/map.service';
import { ZoneService } from './zone.service';
import { PolygonCanvasComponent } from './components/polygon-canvas/polygon-canvas';
import { Zone, Polygon } from './zone.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-zones-management',
  standalone: true,
  imports: [CommonModule, FormsModule, PolygonCanvasComponent],
  templateUrl: './zones-management.html',
  styleUrls: ['./zones-management.scss'],
})
export class ZonesManagementComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private mapService = inject(MapService);
  private zoneService = inject(ZoneService);
  private destroy$ = new Subject<void>();

  zones: Zone[] = [];
  selectedZone: Zone | null = null;
  mapImagePath: string = '';
  imageLoaded: boolean = false;
  showZoneForm = false;
  newZoneName = '';
  newZoneDescription = '';

  selectedMap = this.mapService.getSelectedMap();

  ngOnInit(): void {
    const selectedMap = this.mapService.getSelectedMap();
    if (!selectedMap) {
      this.router.navigate(['/maps']);
      return;
    }

    this.selectedMap = selectedMap;
    this.mapImagePath = this.mapService.getFullImageUrl(selectedMap.image);
    this.imageLoaded = true;

    this.loadZones();

    this.mapService.selectedMap$
      .pipe(takeUntil(this.destroy$))
      .subscribe(map => {
        if (map && map.image) {
          this.selectedMap = map;
          this.mapImagePath = this.mapService.getFullImageUrl(map.image);
          this.loadZones();
        } else {
          this.router.navigate(['/maps']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadZones(): void {
    if (this.selectedMap) {
      this.zones = this.zoneService.getZonesByFloorMap(this.selectedMap.id);
      if (this.zones.length > 0) {
        this.selectZone(this.zones[0]);
      }
    }
  }

  selectZone(zone: Zone): void {
    this.selectedZone = zone;
    this.zoneService.selectZone(zone);
  }

  createZone(): void {
    if (!this.newZoneName.trim() || !this.selectedMap) return;

    const zone = this.zoneService.createZone(
      this.selectedMap.id,
      this.newZoneName,
      this.newZoneDescription
    );

    this.zones.push(zone);
    this.selectZone(zone);
    this.newZoneName = '';
    this.newZoneDescription = '';
    this.showZoneForm = false;
  }

  deleteZone(zoneId: string): void {
    if (confirm('Are you sure you want to delete this zone?')) {
      this.zoneService.deleteZone(zoneId);
      this.zones = this.zones.filter(z => z.id !== zoneId);
      if (this.selectedZone?.id === zoneId) {
        this.selectedZone = null;
      }
    }
  }

  onPolygonCreated(polygon: Polygon): void {
    if (this.selectedZone) {
      this.zoneService.addPolygonToZone(this.selectedZone.id, polygon);
      // Refresh the selected zone from the service to ensure consistency
      const updatedZone = this.zoneService.getZoneById(this.selectedZone.id);
      if (updatedZone) {
        this.selectedZone = updatedZone;
      }
    }
  }

  onPolygonRemoved(polygonId: string): void {
    if (this.selectedZone) {
      this.zoneService.removePolygonFromZone(this.selectedZone.id, polygonId);
      this.selectedZone.polygons = this.selectedZone.polygons.filter(p => p.id !== polygonId);
    }
  }

  goToMaps(): void {
    this.router.navigate(['/maps']);
  }
}
