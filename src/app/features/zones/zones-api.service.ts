import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Zone } from './zone.model';

export interface ZoneCreatePayload {
  name: string;
  floorMapId: string | number;
  points: Array<{ x: number; y: number; ordinalNumber: number }>;
  userId?: number;
}

export interface PolygonPayload {
  id: string;
  points: Array<{ x: number; y: number }>;
  color?: string;
  name?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ZonesApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/Zone`;

  private getUserIdFromToken(): number | null {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const decoded = JSON.parse(atob(parts[1]));
      return decoded.sub ? parseInt(decoded.sub, 10) : null;
    } catch (e) {
      console.error('Failed to decode token:', e);
      return null;
    }
  }

  getZonesByFloorMap(floorMapId: string | number): Observable<Zone[]> {
    return this.http.get<any>(`${this.apiUrl}/floormap/${floorMapId}`).pipe(
      map(response => {
        // Handle nested data structure: { success, data: [...] } or plain array
        const dataArray = response && response.data ? response.data : response;
        const zones = Array.isArray(dataArray) ? dataArray : [];
        // Ensure all zones have polygons array initialized
        return zones.map(zone => ({
          ...zone,
          polygons: zone.polygons || []
        }));
      })
    );
  }

  createZone(payload: ZoneCreatePayload): Observable<Zone> {
    // Add userId if not already present
    if (!payload.userId) {
      payload.userId = this.getUserIdFromToken() || undefined;
    }

    return this.http.post<any>(this.apiUrl, payload).pipe(
      map(response => {
        // Handle nested data structure: { success, data: {...} } or plain object
        return response && response.data ? response.data : response;
      })
    );
  }

  updateZone(id: string, payload: Partial<ZoneCreatePayload>): Observable<Zone> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload).pipe(
      map(response => {
        return response && response.data ? response.data : response;
      })
    );
  }

  deleteZone(id: string): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        return response && response.data ? response.data : response;
      })
    );
  }

  // Polygon operations - update the entire zone with new polygons
  addPolygon(zoneId: string, polygon: PolygonPayload): Observable<Zone> {
    // Get current zone and add the polygon to it, then PUT back
    return this.http.get<any>(`${this.apiUrl}/${zoneId}`).pipe(
      switchMap(response => {
        const zone = response && response.data ? response.data : response;
        if (!Array.isArray(zone.polygons)) {
          zone.polygons = [];
        }
        zone.polygons.push(polygon);
        
        // Update the zone with the new polygons via PUT
        return this.http.put<any>(`${this.apiUrl}/${zoneId}`, zone);
      }),
      map(response => response && response.data ? response.data : response)
    );
  }

  removePolygon(zoneId: string, polygonId: string): Observable<Zone> {
    // Get current zone, remove the polygon, then PUT back
    return this.http.get<any>(`${this.apiUrl}/${zoneId}`).pipe(
      switchMap(response => {
        const zone = response && response.data ? response.data : response;
        if (Array.isArray(zone.polygons)) {
          zone.polygons = zone.polygons.filter((p: any) => p.id !== polygonId);
        }
        
        // Update the zone with the removed polygons via PUT
        return this.http.put<any>(`${this.apiUrl}/${zoneId}`, zone);
      }),
      map(response => response && response.data ? response.data : response)
    );
  }
}
