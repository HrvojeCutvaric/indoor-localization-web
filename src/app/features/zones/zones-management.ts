import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MapService } from '../../core/services/map.service';
import { ZonesService } from './zones.service';
import { PolygonCanvasComponent } from './components/polygon-canvas/polygon-canvas';
import { ZoneEntryExitLogComponent } from './components/zone-entry-exit-log/zone-entry-exit-log';
import { Zone, Polygon } from './zone.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-zones-management',
  standalone: true,
  imports: [CommonModule, FormsModule, PolygonCanvasComponent, ZoneEntryExitLogComponent],
  templateUrl: './zones-management.html',
  styleUrls: ['./zones-management.scss'],
})
export class ZonesManagementComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private mapService = inject(MapService);
  private zonesService = inject(ZonesService);
  private destroy$ = new Subject<void>();

  zones: Zone[] = [];
  selectedZone: Zone | null = null;
  selectedMapName: string | null = null;
  mapImagePath: string = '';
  imageLoaded: boolean = false;
  showZoneForm = false;
  newZoneName = '';
  newZoneDescription = '';

  selectedMap = this.mapService.getSelectedMap();

  activeTab: 'zones' | 'logs' = 'zones';
  setActiveTab(tab: 'zones' | 'logs') {
    this.activeTab = tab;
  }

  selectedMapId: string | null = null;

  ngOnInit(): void {
    const selectedMap = this.mapService.getSelectedMap();
    if (!selectedMap) {
      this.router.navigate(['/maps']);
      return;
    }

    this.selectedMap = selectedMap;
    this.selectedMapId = selectedMap.id;
    this.selectedMapName = selectedMap.name;

    this.mapImagePath = this.mapService.getFullImageUrl(selectedMap.image);
    this.imageLoaded = true;

    this.loadZones();

    this.mapService.selectedMap$
      .pipe(takeUntil(this.destroy$))
      .subscribe(map => {
        if (map && map.image) {
          this.selectedMap = map;
          this.selectedMapId = map.id;
          this.selectedMapName = map.name;

          this.mapImagePath = this.mapService.getFullImageUrl(map.image);
          this.loadZones();
        } else {
          this.router.navigate(['/maps']);
        }
      });

    // Subscribe to zones from service
    this.zonesService.zones$
      .pipe(takeUntil(this.destroy$))
      .subscribe(zones => {
        this.zones = zones;
        // Update selected zone if it's in the list (in case ID changed after backend sync)
        if (this.selectedZone) {
          const updatedSelectedZone = zones.find(z => z.id === this.selectedZone!.id);
          if (updatedSelectedZone) {
            this.selectedZone = updatedSelectedZone;
          }
        }
        // Auto-select first zone if available
        if (zones.length > 0 && !this.selectedZone) {
          this.selectZone(zones[0]);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadZones(): void {
    if (this.selectedMap) {
      // Load zones from backend on initial load
      this.zonesService.setMap(this.selectedMap.id);
    }
  }

  selectZone(zone: Zone): void {
    this.selectedZone = zone;
    this.zonesService.selectZone(zone);
  }

  createZone(): void {
    if (!this.newZoneName.trim() || !this.selectedMap) return;

    const zone = this.zonesService.createZone(
      this.selectedMap.id,
      this.newZoneName,
      this.newZoneDescription
    );

    this.selectZone(zone);
    this.newZoneName = '';
    this.newZoneDescription = '';
    this.showZoneForm = false;
  }

  deleteZone(zoneId: string): void {
    if (confirm('Are you sure you want to delete this zone?')) {
      this.zonesService.deleteZone(zoneId);
      if (this.selectedZone?.id === zoneId) {
        this.selectedZone = null;
      }
    }
  }

  onPolygonCreated(polygon: Polygon): void {
    if (this.selectedZone) {
      this.zonesService.addPolygonToZone(this.selectedZone.id, polygon);
      // Update selected zone to reflect the new polygon
      const updatedZone = this.zonesService.getZoneById(this.selectedZone.id);
      if (updatedZone) {
        this.selectedZone = updatedZone;
      }
    }
  }

  onPolygonRemoved(polygonId: string): void {
    if (this.selectedZone) {
      this.zonesService.removePolygonFromZone(this.selectedZone.id, polygonId);
      const updatedZone = this.zonesService.getZoneById(this.selectedZone.id);
      if (updatedZone) {
        this.selectedZone = updatedZone;
      }
    }
  }

  onPolygonsCleared(polygonIds: string[]): void {
    if (this.selectedZone) {
      console.log('ZonesManagement: Clearing polygons:', polygonIds);
      // Remove each polygon
      polygonIds.forEach(polygonId => {
        this.zonesService.removePolygonFromZone(this.selectedZone!.id, polygonId);
      });
      // Update selected zone
      const updatedZone = this.zonesService.getZoneById(this.selectedZone.id);
      if (updatedZone) {
        this.selectedZone = updatedZone;
      }
    }
  }

  goToMaps(): void {
    this.router.navigate(['/maps']);
  }
}