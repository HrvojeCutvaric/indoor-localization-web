import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import type { Zone, DraftPoint, Polygon } from './zone.model';
import { ZonesApiService } from './zones-api.service';

function storageKey(mapId: string): string {
    return `zones:${mapId}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

@Injectable({ providedIn: 'root' })
export class LocalZonesRepository {
    private apiService = inject(ZonesApiService);

    list(mapId: string): Observable<Zone[]> {
        return this.apiService.list(mapId).pipe(
            map(response => {
                const zones = response.data || [];
                // Cache to localStorage as backup
                localStorage.setItem(storageKey(mapId), JSON.stringify(zones));
                return zones.map(z => {
                    // Parse points if it's a string (JSONB from backend)
                    let points = z.points || [];
                    if (typeof points === 'string') {
                        try {
                            points = JSON.parse(points);
                        } catch (e) {
                            console.error('Failed to parse zone points:', e);
                            points = [];
                        }
                    }
                    
                    // Convert backend points array to frontend polygon structure
                    // Backend stores points flat with OrdinalNumber resetting per polygon
                    // When OrdinalNumber resets to 0, it indicates a new polygon is starting
                    let polygons: Polygon[] = [];
                    if (Array.isArray(points) && points.length > 0) {
                        let currentPolygonPoints: any[] = [];
                        let currentOrdinal = 0;
                        
                        points.forEach((point: any, index: number) => {
                            const ordinal = point.OrdinalNumber ?? 0;
                            
                            // If ordinal resets to 0 and we already have points, start new polygon
                            if (ordinal === 0 && currentPolygonPoints.length > 0) {
                                console.log('Repository: Polygon boundary detected at point', index);
                                // Save current polygon
                                polygons.push({
                                    id: `polygon_from_db_${z.id}_group_${polygons.length}`,
                                    points: currentPolygonPoints.map((p: any) => ({
                                        x: p.X || p.x || 0,
                                        y: p.Y || p.y || 0
                                    })),
                                    name: `${z.name} - Part ${polygons.length + 1}`,
                                    createdAt: z.createdAt,
                                    color: 'rgba(100, 200, 100, 0.3)'
                                });
                                // Start new polygon
                                currentPolygonPoints = [];
                            }
                            
                            // Add point to current polygon
                            currentPolygonPoints.push(point);
                            currentOrdinal = ordinal;
                        });
                        
                        // Don't forget the last polygon
                        if (currentPolygonPoints.length > 0) {
                            console.log('Repository: Saving final polygon with', currentPolygonPoints.length, 'points');
                            polygons.push({
                                id: `polygon_from_db_${z.id}_group_${polygons.length}`,
                                points: currentPolygonPoints.map((p: any) => ({
                                    x: p.X || p.x || 0,
                                    y: p.Y || p.y || 0
                                })),
                                name: `${z.name} - Part ${polygons.length + 1}`,
                                createdAt: z.createdAt,
                                color: 'rgba(100, 200, 100, 0.3)'
                            });
                        }
                        
                        console.log('Repository: Reconstructed', polygons.length, 'polygons from', points.length, 'backend points');
                    }
                    
                    return {
                        id: z.id.toString(),
                        mapId: z.mapId?.toString(),
                        floorMapId: z.floorMapId?.toString(),
                        name: z.name,
                        description: z.description,
                        points: Array.isArray(points) ? points : [],
                        polygons: polygons,
                        createdAt: z.createdAt,
                    };
                }) as Zone[];
            }),
            catchError(() => {
                // Fall back to localStorage if API fails
                const zones = safeParse<Zone[]>(localStorage.getItem(storageKey(mapId)), []);
                return of(zones);
            })
        );
    }

    create(mapId: string, name: string, points: DraftPoint[]): Observable<Zone> {
        console.log('Repository: Creating zone', { mapId, name, points });
        return this.apiService.create(mapId, name, points).pipe(
            tap(response => console.log('Repository: Full response from backend:', response)),
            map(response => {
                console.log('Repository: response.data =', response.data);
                const z = response.data;
                if (!z) {
                    throw new Error('Backend returned empty data');
                }
                
                // Parse points if it's a string (JSONB from backend)
                let parsedPoints = z.points || [];
                if (typeof parsedPoints === 'string') {
                    try {
                        parsedPoints = JSON.parse(parsedPoints);
                    } catch (e) {
                        console.error('Failed to parse zone points:', e);
                        parsedPoints = [];
                    }
                }
                
                // Convert backend points array to frontend polygon structure
                // Backend stores points flat with OrdinalNumber resetting per polygon
                // When OrdinalNumber resets to 0, it indicates a new polygon is starting
                let polygons: Polygon[] = [];
                if (Array.isArray(parsedPoints) && parsedPoints.length > 0) {
                    let currentPolygonPoints: any[] = [];
                    let currentOrdinal = 0;
                    
                    parsedPoints.forEach((point: any, index: number) => {
                        const ordinal = point.OrdinalNumber ?? 0;
                        
                        // If ordinal resets to 0 and we already have points, start new polygon
                        if (ordinal === 0 && currentPolygonPoints.length > 0) {
                            console.log('Repository: Polygon boundary detected at point', index);
                            // Save current polygon
                            polygons.push({
                                id: `polygon_from_db_${z.id}_group_${polygons.length}`,
                                points: currentPolygonPoints.map((p: any) => ({
                                    x: p.X || p.x || 0,
                                    y: p.Y || p.y || 0
                                })),
                                name: `${z.name} - Part ${polygons.length + 1}`,
                                createdAt: z.createdAt,
                                color: 'rgba(100, 200, 100, 0.3)'
                            });
                            // Start new polygon
                            currentPolygonPoints = [];
                        }
                        
                        // Add point to current polygon
                        currentPolygonPoints.push(point);
                        currentOrdinal = ordinal;
                    });
                    
                    // Don't forget the last polygon
                    if (currentPolygonPoints.length > 0) {
                        console.log('Repository: Saving final polygon with', currentPolygonPoints.length, 'points');
                        polygons.push({
                            id: `polygon_from_db_${z.id}_group_${polygons.length}`,
                            points: currentPolygonPoints.map((p: any) => ({
                                x: p.X || p.x || 0,
                                y: p.Y || p.y || 0
                            })),
                            name: `${z.name} - Part ${polygons.length + 1}`,
                            createdAt: z.createdAt,
                            color: 'rgba(100, 200, 100, 0.3)'
                        });
                    }
                    
                    console.log('Repository: Reconstructed', polygons.length, 'polygons from', parsedPoints.length, 'backend points');
                }
                
                const zone = {
                    id: z.id.toString(),
                    mapId: z.mapId?.toString(),
                    floorMapId: z.floorMapId?.toString(),
                    name: z.name,
                    description: z.description,
                    points: Array.isArray(parsedPoints) ? parsedPoints : [],
                    polygons: polygons,
                    createdAt: z.createdAt,
                } as Zone;
                
                // Cache to localStorage
                const zones = safeParse<Zone[]>(localStorage.getItem(storageKey(mapId)), []);
                zones.push(zone);
                localStorage.setItem(storageKey(mapId), JSON.stringify(zones));
                
                return zone;
            }),
            catchError((err) => {
                console.error('Repository: Failed to create zone on backend:', err);
                // Fall back to localStorage if API fails
                const zones = safeParse<Zone[]>(localStorage.getItem(storageKey(mapId)), []);

                const zone: Zone = {
                    id: crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
                    mapId,
                    floorMapId: mapId,
                    name,
                    points: points.map((p, idx) => ({
                        x: p.x,
                        y: p.y,
                        ordinalNumber: idx + 1,
                    })),
                    polygons: [],
                };

                zones.push(zone);
                localStorage.setItem(storageKey(mapId), JSON.stringify(zones));
                return of(zone);
            })
        );
    }

    clear(mapId: string): Observable<void> {
        localStorage.removeItem(storageKey(mapId));
        return of(void 0);
    }
}