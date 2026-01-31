import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, switchMap, tap } from 'rxjs';
import type { DraftPoint, Zone, ZoneValidationError, Polygon } from './zone.model';
import { validatePolygon } from './polygon-validation';
import { LocalZonesRepository } from './zones.repository';
import { ZonesApiService } from './zones-api.service';

@Injectable({ providedIn: 'root' })
export class ZonesService {
    private repo = inject(LocalZonesRepository);
    private apiService = inject(ZonesApiService);

    private mapId$ = new BehaviorSubject<string | null>(null);

    private zonesSubject = new BehaviorSubject<Zone[]>([]);
    zones$ = this.zonesSubject.asObservable();

    private draftSubject = new BehaviorSubject<DraftPoint[]>([]);
    draftPoints$ = this.draftSubject.asObservable();

    private errorSubject = new BehaviorSubject<ZoneValidationError | null>(null);
    error$ = this.errorSubject.asObservable();

    private selectedZoneSubject = new BehaviorSubject<Zone | null>(null);
    selectedZone$ = this.selectedZoneSubject.asObservable();

    setMap(mapId: string | number): void {
        const id = String(mapId);
        this.mapId$.next(id);

        // Fetch zones from backend
        this.repo.list(id).subscribe({
            next: (z) => this.zonesSubject.next(z),
            error: (err) => console.error('Failed to load zones:', err)
        });
        this.resetDraft();
        this.errorSubject.next(null);
    }

    addDraftPoint(point: DraftPoint): void {
        const next = [...this.draftSubject.value, point];
        this.draftSubject.next(next);
        this.errorSubject.next(null);
    }

    resetDraft(): void {
        this.draftSubject.next([]);
        this.errorSubject.next(null);
    }

    finishDraft(name: string): void {
        const mapId = this.mapId$.value;
        if (!mapId) return;

        const pts = this.draftSubject.value;
        const err = validatePolygon(pts);
        if (err) {
            this.errorSubject.next(err);
            return;
        }

        this.repo.create(mapId, name || 'Zone', pts).subscribe(() => {
            this.repo.list(mapId).subscribe(z => this.zonesSubject.next(z));
            this.resetDraft();
        });
    }

    // Methods for zones-management compatibility
    getZonesByFloorMap(mapId: string): Zone[] {
        return this.zonesSubject.value.filter(z => z.floorMapId === mapId);
    }

    selectZone(zone: Zone): void {
        this.selectedZoneSubject.next(zone);
    }

    getSelectedZone(): Zone | null {
        return this.selectedZoneSubject.value;
    }

    getZoneById(zoneId: string): Zone | null {
        return this.zonesSubject.value.find(z => z.id === zoneId) || null;
    }

    createZone(mapId: string, name: string, description: string = ''): Zone {
        console.log('ZonesService: createZone called', { mapId, name, description });
        const zone: Zone = {
            id: `zone_${Date.now()}`,
            mapId: mapId,
            floorMapId: mapId,
            name,
            description,
            points: [],
            polygons: [],
            createdAt: Date.now(),
        };

        // Add to local state immediately
        const zones = [...this.zonesSubject.value];
        zones.push(zone);
        this.zonesSubject.next(zones);
        console.log('ZonesService: Zone added to local state', zone);

        // Send to backend and update with real ID when response comes back
        this.repo.create(mapId, name, []).subscribe({
            next: (backendZone) => {
                console.log('ZonesService: Received response from backend', backendZone);
                // Ensure polygons is initialized
                if (!backendZone.polygons) {
                    backendZone.polygons = [];
                }
                // Replace the temporary zone with the backend zone
                const currentZones = this.zonesSubject.value;
                const index = currentZones.findIndex(z => z.id === zone.id);
                if (index !== -1) {
                    currentZones[index] = backendZone;
                    this.zonesSubject.next([...currentZones]);
                    console.log('ZonesService: Zone updated with backend ID');
                }
            },
            error: (err) => {
                console.error('ZonesService: Failed to create zone on backend:', err);
                // Zone remains in local state with temporary ID as fallback
            }
        });

        return zone;
    }

    deleteZone(zoneId: string): void {
        const zones = this.zonesSubject.value;
        const updatedZones = zones.filter(z => z.id !== zoneId);
        this.zonesSubject.next(updatedZones);

        // Send delete to backend asynchronously
        this.apiService.delete(zoneId).subscribe({
            error: (err) => {
                console.error('Failed to delete zone on backend:', err);
                // Zone already removed from local state as fallback
            }
        });

        if (this.selectedZoneSubject.value?.id === zoneId) {
            this.selectedZoneSubject.next(null);
        }
    }

    syncZones(mapId: string): void {
        // Refresh zones from backend
        this.repo.list(mapId).subscribe(z => this.zonesSubject.next(z));
    }

    addPolygonToZone(zoneId: string, polygon: Polygon): void {
        console.log('ZonesService: addPolygonToZone called with zoneId:', zoneId, 'polygon:', polygon);
        const zones = this.zonesSubject.value;
        const zone = zones.find(z => z.id === zoneId);
        
        if (zone) {
            console.log('ZonesService: Found zone:', zone);
            // Ensure polygons is initialized
            if (!zone.polygons) {
                zone.polygons = [];
            }
            
            // Add to local state
            zone.polygons.push(polygon);
            this.zonesSubject.next([...zones]);
            console.log('ZonesService: Zone after adding polygon:', zone);

            // Send updated zone to backend via PUT /api/Zone/{id}
            this.apiService.updateZonePoints(zoneId, zone).subscribe({
                next: () => {
                    console.log('ZonesService: Polygon saved to backend');
                    this.selectedZoneSubject.next({ ...zone });
                },
                error: (err) => {
                    console.error('ZonesService: Failed to save polygon to backend:', err);
                    // Polygon already added to local state as fallback
                }
            });
        } else {
            console.error('ZonesService: Zone not found:', zoneId);
        }
    }

    removePolygonFromZone(zoneId: string, polygonId: string): void {
        console.log('ZonesService: removePolygonFromZone called with zoneId:', zoneId, 'polygonId:', polygonId);
        const zones = this.zonesSubject.value;
        const zone = zones.find(z => z.id === zoneId);
        
        if (zone) {
            console.log('ZonesService: Found zone, current polygons count:', zone.polygons.length);
            // Remove from local state
            zone.polygons = zone.polygons.filter((p: Polygon) => p.id !== polygonId);
            this.zonesSubject.next([...zones]);
            console.log('ZonesService: After removal, polygons count:', zone.polygons.length);

            // Send updated zone to backend via PUT /api/Zone/{id}
            this.apiService.updateZonePoints(zoneId, zone).subscribe({
                next: () => {
                    console.log('ZonesService: Polygon removed from backend');
                    this.selectedZoneSubject.next({ ...zone });
                },
                error: (err) => {
                    console.error('ZonesService: Failed to delete polygon from backend:', err);
                    // Polygon already removed from local state as fallback
                }
            });
        } else {
            console.error('ZonesService: Zone not found for deletion:', zoneId);
        }
    }
}