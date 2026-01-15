import { Observable, of } from 'rxjs';
import type { Zone, DraftPoint } from './zone.model';

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

export class LocalZonesRepository {
    list(mapId: string): Observable<Zone[]> {
        const zones = safeParse<Zone[]>(localStorage.getItem(storageKey(mapId)), []);
        return of(zones);
    }

    create(mapId: string, name: string, points: DraftPoint[]): Observable<Zone> {
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
    }

    clear(mapId: string): Observable<void> {
        localStorage.removeItem(storageKey(mapId));
        return of(void 0);
    }
}