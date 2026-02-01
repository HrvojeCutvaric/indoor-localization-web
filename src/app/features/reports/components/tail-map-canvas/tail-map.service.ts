import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export type AssetOnFloorMap = {
    id: number;
    name?: string;
    x?: number | null;
    y?: number | null;
    lastSync?: string | null;
    floorMapId?: number;
    active?: boolean;
    color?: string;
};

export type AssetPositionHistoryRecord = {
    x: number;
    y: number;
    timestamp: string;
};

@Injectable({ providedIn: 'root' })
export class TailMapService {
    private http = inject(HttpClient);
    private readonly assetApiUrl = '/api/Asset';

    getAssetsByFloorMap(floorMapId: number): Observable<AssetOnFloorMap[]> {
        return this.http.get<any>(`${this.assetApiUrl}/floormap/${floorMapId}`).pipe(
            map((res) => (res?.data ?? res ?? []) as AssetOnFloorMap[]),
            catchError((err) => {
                console.warn('Failed to fetch assets for floormap:', err);
                return of([]);
            })
        );
    }

    getAssetPositionHistory(assetId: number): Observable<AssetPositionHistoryRecord[]> {
        return this.http.get<any>(`${this.assetApiUrl}/${assetId}/history/position`).pipe(
            map((res) => (res?.data ?? res ?? []) as AssetPositionHistoryRecord[]),
            catchError((err) => {
                console.warn('Failed to fetch asset position history:', err);
                return of([]);
            })
        );
    }
}