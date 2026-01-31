import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/services/api-response.model';
import type { Zone, DraftPoint, Point } from './zone.model';

export interface ZoneRequest {
    floorMapId: number;
    name: string;
    description?: string;
}

export interface PolygonRequest {
    name: string;
    points: Point[];
    color?: string;
}

export interface ZoneResponse {
    id: string;
    mapId: string | number;
    floorMapId: string | number;
    name: string;
    description?: string;
    points: { x: number; y: number; ordinalNumber: number }[];
    polygons?: PolygonResponse[];
    createdAt?: number;
}

export interface PolygonResponse {
    id: string;
    name: string;
    points: Point[];
    color?: string;
    createdAt?: number;
}

@Injectable({ providedIn: 'root' })
export class ZonesApiService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/Zone`;

    list(mapId: string | number): Observable<ApiResponse<ZoneResponse[]>> {
        return this.http.get<ApiResponse<ZoneResponse[]>>(`${this.apiUrl}/floormap/${mapId}`);
    }

    create(mapId: string | number, name: string, points: DraftPoint[], description?: string): Observable<ApiResponse<ZoneResponse>> {
        const payload: ZoneRequest = {
            floorMapId: Number(mapId), // Use floorMapId instead of mapId
            name,
            description,
        };

        console.log('API Service: Sending POST request to', this.apiUrl, 'with payload:', payload);
        return this.http.post<ApiResponse<ZoneResponse>>(this.apiUrl, payload);
    }

    update(zoneId: string | number, updates: Partial<ZoneRequest>): Observable<ApiResponse<ZoneResponse>> {
        return this.http.put<ApiResponse<ZoneResponse>>(`${this.apiUrl}/${zoneId}`, updates);
    }

    delete(zoneId: string | number): Observable<ApiResponse<void>> {
        return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${zoneId}`);
    }

    updateZonePoints(zoneId: string | number, zone: any): Observable<ApiResponse<ZoneResponse>> {
        console.log('API Service: updateZonePoints called with zone:', zone);
        console.log('API Service: zone.polygons:', zone.polygons);
        
        // Transform polygons to backend format
        // OrdinalNumber resets for each polygon (0, 1, 2... per polygon)
        let transformedPoints: any[] = [];
        
        if (zone.polygons && zone.polygons.length > 0) {
            zone.polygons.forEach((polygon: any, polygonIndex: number) => {
                if (polygon.points && Array.isArray(polygon.points)) {
                    polygon.points.forEach((point: any, pointIndex: number) => {
                        const transformedPoint = {
                            X: point.x || 0,
                            Y: point.y || 0,
                            OrdinalNumber: pointIndex  // Resets per polygon (0, 1, 2...)
                        };
                        console.log(`API Service: Polygon[${polygonIndex}].Point[${pointIndex}] - OrdinalNumber: ${pointIndex}, X: ${transformedPoint.X}, Y: ${transformedPoint.Y}`);
                        transformedPoints.push(transformedPoint);
                    });
                }
            });
        }

        const payload = { 
            name: zone.name,
            description: zone.description,
            points: transformedPoints,
            floorMapId: zone.floorMapId
        };
        
        console.log('API Service: Final payload to send:', payload);
        console.log('API Service: Total points being sent:', transformedPoints.length);
        console.log('API Service: Number of polygons:', zone.polygons?.length || 0);
        
        return this.http.put<ApiResponse<ZoneResponse>>(`${this.apiUrl}/${zoneId}`, payload);
    }
}
