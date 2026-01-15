import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Zone, Polygon, Point } from './zone.model';

@Injectable({
  providedIn: 'root',
})
export class ZoneService {
  private zones: Map<string, Zone[]> = new Map();
  private selectedZoneSubject = new BehaviorSubject<Zone | null>(null);
  public selectedZone$ = this.selectedZoneSubject.asObservable();

  selectZone(zone: Zone): void {
    this.selectedZoneSubject.next(zone);
  }

  getSelectedZone(): Zone | null {
    return this.selectedZoneSubject.value;
  }

  getZonesByFloorMap(floorMapId: string): Zone[] {
    return this.zones.get(floorMapId) || [];
  }

  getZoneById(zoneId: string): Zone | null {
    for (const zones of this.zones.values()) {
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        return zone;
      }
    }
    return null;
  }

  createZone(floorMapId: string, name: string, description: string = ''): Zone {
    const zone: Zone = {
      id: `zone_${Date.now()}`,
      mapId: floorMapId,
      name,
      description,
      floorMapId,
      polygons: [],
      points: [],
      createdAt: Date.now(),
    };

    if (!this.zones.has(floorMapId)) {
      this.zones.set(floorMapId, []);
    }

    this.zones.get(floorMapId)!.push(zone);
    return zone;
  }

  deleteZone(zoneId: string): void {
    for (const [floorMapId, zones] of this.zones.entries()) {
      const index = zones.findIndex(z => z.id === zoneId);
      if (index !== -1) {
        zones.splice(index, 1);
        break;
      }
    }

    if (this.selectedZoneSubject.value?.id === zoneId) {
      this.selectedZoneSubject.next(null);
    }
  }

  addPolygonToZone(zoneId: string, polygon: Polygon): void {
    for (const zones of this.zones.values()) {
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        zone.polygons.push(polygon);
        if (this.selectedZoneSubject.value?.id === zoneId) {
          this.selectedZoneSubject.next({ ...zone });
        }
        return;
      }
    }
  }

  removePolygonFromZone(zoneId: string, polygonId: string): void {
    for (const zones of this.zones.values()) {
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        zone.polygons = zone.polygons.filter((p: Polygon) => p.id !== polygonId);
        if (this.selectedZoneSubject.value?.id === zoneId) {
          this.selectedZoneSubject.next({ ...zone });
        }
        return;
      }
    }
  }

  updateZone(zoneId: string, updates: Partial<Zone>): void {
    for (const zones of this.zones.values()) {
      const zone = zones.find(z => z.id === zoneId);
      if (zone) {
        Object.assign(zone, updates);
        if (this.selectedZoneSubject.value?.id === zoneId) {
          this.selectedZoneSubject.next({ ...zone });
        }
        return;
      }
    }
  }

  clearZonesByFloorMap(floorMapId: string): void {
    this.zones.delete(floorMapId);
  }
}
