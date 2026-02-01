import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

export interface HeatmapDataPoint {
    x: number;
    y: number;
    intensity: number;
}

export interface AssetTrail {
    assetId: number;
    assetName: string;
    color: string;
    points: Array<{
        x: number;
        y: number;
        timestamp: string;
        intensity: number;
    }>;
}

export interface HeatmapData {
    mapId: string | number;
    points: HeatmapDataPoint[];
    trails: AssetTrail[];
    minIntensity: number;
    maxIntensity: number;
}

@Injectable({
    providedIn: 'root',
})
export class HeatmapService {
    private http = inject(HttpClient);
    private readonly assetApiUrl = '/api/Asset';
    
    private heatmapDataSubject = new BehaviorSubject<HeatmapData | null>(null);
    heatmapData$ = this.heatmapDataSubject.asObservable();

    private colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

    generateHeatmapData(
        floorMapId: string | number,
        startDate?: Date,
        endDate?: Date
    ): Observable<HeatmapData> {
        console.log('%cgenerateHeatmapData called', 'background: cyan; color: black; font-weight: bold', { 
            floorMapId, 
            startDate, 
            endDate,
            hasStartDate: !!startDate,
            hasEndDate: !!endDate
        });
        
        return this.http.get<any>(`${this.assetApiUrl}/floormap/${floorMapId}`).pipe(
            switchMap((response) => {
                const assets = response.data || response;
                if (!Array.isArray(assets) || assets.length === 0) {
                    return of(this.createEmptyHeatmap(floorMapId));
                }

                const historyRequests = assets.map((asset) =>
                    this.http.get<any>(`${this.assetApiUrl}/${asset.id}/history/position`).pipe(
                        map((histResponse) => ({
                            asset,
                            history: histResponse.data || histResponse || [],
                        })),
                        catchError((err) => {
                            console.warn(`Failed to fetch history for asset ${asset.id}:`, err);
                            return of({ asset, history: [] });
                        })
                    )
                );

                return forkJoin(historyRequests).pipe(
                    map((results) => {
                        console.log('%c🔴 ABOUT TO BUILD HEATMAP WITH DATES', 'background: red; color: yellow; font-weight: bold; font-size: 14px', {
                            startDate,
                            endDate,
                            startDateMs: startDate?.getTime(),
                            endDateMs: endDate?.getTime()
                        });
                        return this.buildHeatmapFromHistory(
                            floorMapId,
                            results,
                            startDate,
                            endDate
                        );
                    })
                );
            }),
            catchError((error) => {
                console.error('Failed to fetch assets for heatmap:', error);
                return of(this.createEmptyHeatmap(floorMapId));
            })
        );
    }

    private buildHeatmapFromHistory(
        floorMapId: string | number,
        assetHistoryResults: Array<{ asset: any; history: any[] }>,
        startDate?: Date,
        endDate?: Date
    ): HeatmapData {
        const trails: AssetTrail[] = [];
        const allPoints: HeatmapDataPoint[] = [];

        const startMs = startDate ? startDate.getTime() : null;
        const endMs = endDate ? endDate.getTime() : null;
        
        console.log('=== HEATMAP FILTER START ===');
        console.log('Filter params:', { startDate, endDate, startMs, endMs });

        assetHistoryResults.forEach((result, idx) => {
            const { asset, history } = result;
            if (!Array.isArray(history) || history.length === 0) {
                return;
            }

            const originalCount = history.length;
            
            if (history.length > 0) {
                console.log(`Asset ${asset.id} sample record:`, history[0]);
            }

            let filteredHistory = history;
            if (startMs !== null || endMs !== null) {
                filteredHistory = history.filter((record) => {
                    const tsValue = record.dateTime || record.DateTime || record.timestamp || record.Timestamp || record.createdAt || record.time;
                    if (!tsValue) {
                        return false;
                    }
                    
                    const recordMs = new Date(tsValue).getTime();
                    if (isNaN(recordMs)) {
                        return false;
                    }
                    
                    if (startMs !== null && recordMs < startMs) {
                        return false;
                    }
                    if (endMs !== null && recordMs > endMs) {
                        return false;
                    }
                    return true;
                });
            }
            
            console.log(`Asset ${asset.id}: ${originalCount} -> ${filteredHistory.length} records after filter`);

            if (filteredHistory.length === 0) {
                return;
            }

            filteredHistory.sort(
                (a, b) =>
                    new Date(a.dateTime || a.timestamp).getTime() - new Date(b.dateTime || b.timestamp).getTime()
            );

            const points = filteredHistory.map((record, i) => {
                const intensity = 0.3 + (i / filteredHistory.length) * 0.7;
                return {
                    x: record.x || 0,
                    y: record.y || 0,
                    timestamp: record.dateTime || record.timestamp || new Date().toISOString(),
                    intensity,
                };
            });

            trails.push({
                assetId: asset.id,
                assetName: asset.name || `Asset ${asset.id}`,
                color: this.colors[idx % this.colors.length],
                points,
            });

            points.forEach((p) => {
                allPoints.push({
                    x: p.x,
                    y: p.y,
                    intensity: p.intensity,
                });
            });
        });

        if (allPoints.length === 0) {
            console.log('%cFINAL RESULT: No points after filtering', 'background: red; color: white; font-weight: bold');
            return this.createEmptyHeatmap(floorMapId);
        }

        const intensities = allPoints.map((p) => p.intensity);
        const minIntensity = Math.min(...intensities);
        const maxIntensity = Math.max(...intensities);

        console.log('%cFINAL RESULT: Success', 'background: green; color: white; font-weight: bold', {
            totalPoints: allPoints.length,
            totalTrails: trails.length,
            minIntensity,
            maxIntensity
        });

        return {
            mapId: floorMapId,
            points: allPoints,
            trails,
            minIntensity,
            maxIntensity,
        };
    }

    private createEmptyHeatmap(floorMapId: string | number): HeatmapData {
        return {
            mapId: floorMapId,
            points: [],
            trails: [],
            minIntensity: 0,
            maxIntensity: 1,
        };
    }

    updateHeatmapData(data: HeatmapData): void {
        this.heatmapDataSubject.next(data);
    }

    getHeatmapData(): HeatmapData | null {
        return this.heatmapDataSubject.value;
    }

    getColorForIntensity(intensity: number, minIntensity: number = 0, maxIntensity: number = 1): string {
        const normalized = maxIntensity > minIntensity 
            ? (intensity - minIntensity) / (maxIntensity - minIntensity)
            : 0;

        const clamped = Math.max(0, Math.min(1, normalized));

        if (clamped < 0.25) {
            const t = clamped / 0.25;
            const r = 0;
            const g = Math.round(255 * t);
            const b = 255;
            return `rgb(${r}, ${g}, ${b})`;
        } else if (clamped < 0.5) {
            const t = (clamped - 0.25) / 0.25;
            const r = 0;
            const g = 255;
            const b = Math.round(255 * (1 - t));
            return `rgb(${r}, ${g}, ${b})`;
        } else if (clamped < 0.75) {
            const t = (clamped - 0.5) / 0.25;
            const r = Math.round(255 * t);
            const g = 255;
            const b = 0;
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            const t = (clamped - 0.75) / 0.25;
            const r = 255;
            const g = Math.round(255 * (1 - t));
            const b = 0;
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    generateGradient(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        radius: number,
        intensity: number,
        minIntensity: number = 0,
        maxIntensity: number = 1
    ): CanvasGradient {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        
        const color = this.getColorForIntensity(intensity, minIntensity, maxIntensity);
        const rgbMatch = color.match(/\d+/g);
        if (rgbMatch && rgbMatch.length === 3) {
            const [r, g, b] = rgbMatch;
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
            gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.4)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        } else {
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'transparent');
        }
        
        return gradient;
    }
}
