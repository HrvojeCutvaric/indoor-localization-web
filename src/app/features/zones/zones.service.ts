import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, switchMap, tap } from 'rxjs';
import type { DraftPoint, Zone, ZoneValidationError } from './zone.model';
import { validatePolygon } from './polygon-validation';
import { LocalZonesRepository } from './zones.repository';
import { ZonesApiService } from './zones-api.service';

@Injectable({ providedIn: 'root' })
export class ZonesService {
    private repo = new LocalZonesRepository();
    private apiService = inject(ZonesApiService);

    private mapId$ = new BehaviorSubject<string | null>(null);

    private zonesSubject = new BehaviorSubject<Zone[]>([]);
    zones$ = this.zonesSubject.asObservable();

    private draftSubject = new BehaviorSubject<DraftPoint[]>([]);
    draftPoints$ = this.draftSubject.asObservable();

    private errorSubject = new BehaviorSubject<ZoneValidationError | null>(null);
    error$ = this.errorSubject.asObservable();

    setMap(mapId: string | number): void {
        const id = String(mapId);
        this.mapId$.next(id);

        // Load zones from backend API instead of localStorage
        this.apiService.getZonesByFloorMap(id).subscribe({
            next: (zones) => this.zonesSubject.next(zones),
            error: (err) => {
                console.error('Failed to load zones from backend:', err);
                // Fallback to localStorage if backend fails
                this.repo.list(id).subscribe(z => this.zonesSubject.next(z));
            }
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

        // Create zone on backend API
        const payload = {
            name: name || 'Zone',
            floorMapId: mapId,
            points: pts.map((p, idx) => ({
                x: p.x,
                y: p.y,
                ordinalNumber: idx + 1,
            })),
        };

        this.apiService.createZone(payload).subscribe({
            next: () => {
                // Reload zones from backend
                this.apiService.getZonesByFloorMap(mapId).subscribe(z => this.zonesSubject.next(z));
                this.resetDraft();
            },
            error: (err) => {
                console.error('Failed to create zone:', err);
                // ZoneValidationError is a string union, so we can't set a custom error here
                // Just log and reset draft
            }
        });
    }

    getZonesByFloorMap(mapId: string): Zone[] {
        // Return current zones from subject; the actual loading happens in setMap()
        return this.zonesSubject.value;
    }

    createZone(mapId: string, name: string, description?: string): Zone {
        // Create zone with just a name (no polygons yet)
        // This is called from the form. Polygons are added separately via addPolygonToZone
        const zone: Zone = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            mapId,
            floorMapId: mapId,
            name,
            description,
            points: [],
            polygons: [],
            createdAt: Date.now(),
        };

        // Send to backend with empty points array
        const payload = {
            name,
            floorMapId: mapId,
            points: [] as Array<{ x: number; y: number; ordinalNumber: number }>,
        };

        console.log('Creating zone with payload:', payload);

        this.apiService.createZone(payload).subscribe({
            next: (response) => {
                console.log('Zone created successfully:', response);
                // Reload zones from backend after creation
                const id = String(mapId);
                this.apiService.getZonesByFloorMap(id).subscribe(zones => {
                    console.log('Zones reloaded from backend:', zones);
                    this.zonesSubject.next(zones);
                });
            },
            error: (err) => {
                console.error('Failed to create zone:', err);
            }
        });

        // Return zone immediately for UI updates (actual zone with proper ID will come from backend)
        return zone;
    }

    addPolygonToZone(zoneId: string, polygon: any): void {
        const zones = this.zonesSubject.value;
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            // Ensure polygons is an array
            if (!Array.isArray(zone.polygons)) {
                zone.polygons = [];
            }
            zone.polygons.push(polygon);
            this.zonesSubject.next([...zones]);
        }
    }

    removePolygonFromZone(zoneId: string, polygonId: string): void {
        const zones = this.zonesSubject.value;
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            zone.polygons = zone.polygons.filter((p: any) => p.id !== polygonId);
            this.zonesSubject.next([...zones]);
        }
    }

    getZoneById(zoneId: string): Zone | undefined {
        return this.zonesSubject.value.find(z => z.id === zoneId);
    }

    selectZone(zone: Zone): void {
        // Handle zone selection if needed
    }

    deleteZone(zoneId: string): void {
        console.log('Deleting zone:', zoneId, 'type:', typeof zoneId);
        this.apiService.deleteZone(String(zoneId)).subscribe({
            next: () => {
                console.log('Zone deleted from backend successfully');
                const zones = this.zonesSubject.value.filter(z => z.id !== zoneId);
                this.zonesSubject.next(zones);
            },
            error: (err) => {
                console.error('Failed to delete zone from backend:', err);
            }
        });
    }
}
