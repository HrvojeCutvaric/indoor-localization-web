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

    // Color palette for assets
    private colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

    /**
     * Fetch heatmap data from asset position history for a floor map
     * Gets all assets on the floor map and their position history
     */
    generateHeatmapData(
        floorMapId: string | number,
        startDate?: Date,
        endDate?: Date
    ): Observable<HeatmapData> {
        // Fetch all assets for this floor map
        return this.http.get<any>(`${this.assetApiUrl}/floormap/${floorMapId}`).pipe(
            switchMap((response) => {
                const assets = response.data || response;
                if (!Array.isArray(assets) || assets.length === 0) {
                    return of(this.createEmptyHeatmap(floorMapId));
                }

                // Fetch position history for each asset
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
                    map((results) =>
                        this.buildHeatmapFromHistory(
                            floorMapId,
                            results,
                            startDate,
                            endDate
                        )
                    )
                );
            }),
            catchError((error) => {
                console.error('Failed to fetch assets for heatmap:', error);
                return of(this.createEmptyHeatmap(floorMapId));
            })
        );
    }

    /**
     * Build heatmap data from asset position history
     */
    private buildHeatmapFromHistory(
        floorMapId: string | number,
        assetHistoryResults: Array<{ asset: any; history: any[] }>,
        startDate?: Date,
        endDate?: Date
    ): HeatmapData {
        const trails: AssetTrail[] = [];
        const allPoints: HeatmapDataPoint[] = [];

        assetHistoryResults.forEach((result, idx) => {
            const { asset, history } = result;
            if (!Array.isArray(history) || history.length === 0) {
                return;
            }

            // Filter by date range if provided
            let filteredHistory = history;
            if (startDate || endDate) {
                filteredHistory = history.filter((h) => {
                    const timestamp = new Date(h.timestamp);
                    if (startDate && timestamp < startDate) return false;
                    if (endDate && timestamp > endDate) return false;
                    return true;
                });
            }

            if (filteredHistory.length === 0) {
                return;
            }

            // Sort by timestamp ascending
            filteredHistory.sort(
                (a, b) =>
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            // Create trail points with intensity based on recency
            const points = filteredHistory.map((record, i) => {
                const intensity = 0.3 + (i / filteredHistory.length) * 0.7; // 0.3 to 1.0
                return {
                    x: record.x || 0,
                    y: record.y || 0,
                    timestamp: record.timestamp || new Date().toISOString(),
                    intensity,
                };
            });

            // Add trail
            trails.push({
                assetId: asset.id,
                assetName: asset.name || `Asset ${asset.id}`,
                color: this.colors[idx % this.colors.length],
                points,
            });

            // Add points to heatmap
            points.forEach((p) => {
                allPoints.push({
                    x: p.x,
                    y: p.y,
                    intensity: p.intensity,
                });
            });
        });

        // Calculate intensity bounds
        if (allPoints.length === 0) {
            return this.createEmptyHeatmap(floorMapId);
        }

        const intensities = allPoints.map((p) => p.intensity);
        const minIntensity = Math.min(...intensities);
        const maxIntensity = Math.max(...intensities);

        return {
            mapId: floorMapId,
            points: allPoints,
            trails,
            minIntensity,
            maxIntensity,
        };
    }

    /**
     * Create empty heatmap when no data available
     */
    private createEmptyHeatmap(floorMapId: string | number): HeatmapData {
        return {
            mapId: floorMapId,
            points: [],
            trails: [],
            minIntensity: 0,
            maxIntensity: 1,
        };
    }

    /**
     * Update heatmap data and notify subscribers
     */
    updateHeatmapData(data: HeatmapData): void {
        this.heatmapDataSubject.next(data);
    }

    /**
     * Get current heatmap data
     */
    getHeatmapData(): HeatmapData | null {
        return this.heatmapDataSubject.value;
    }

    /**
     * Convert intensity value to color (blue -> green -> yellow -> red)
     */
    getColorForIntensity(intensity: number, minIntensity: number = 0, maxIntensity: number = 1): string {
        // Normalize intensity to 0-1 range
        const normalized = maxIntensity > minIntensity 
            ? (intensity - minIntensity) / (maxIntensity - minIntensity)
            : 0;

        // Clamp to 0-1
        const clamped = Math.max(0, Math.min(1, normalized));

        // Color gradient: blue -> cyan -> green -> yellow -> red
        if (clamped < 0.25) {
            // Blue to Cyan
            const t = clamped / 0.25;
            const r = 0;
            const g = Math.round(255 * t);
            const b = 255;
            return `rgb(${r}, ${g}, ${b})`;
        } else if (clamped < 0.5) {
            // Cyan to Green
            const t = (clamped - 0.25) / 0.25;
            const r = 0;
            const g = 255;
            const b = Math.round(255 * (1 - t));
            return `rgb(${r}, ${g}, ${b})`;
        } else if (clamped < 0.75) {
            // Green to Yellow
            const t = (clamped - 0.5) / 0.25;
            const r = Math.round(255 * t);
            const g = 255;
            const b = 0;
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Yellow to Red
            const t = (clamped - 0.75) / 0.25;
            const r = 255;
            const g = Math.round(255 * (1 - t));
            const b = 0;
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    /**
     * Generate radial gradient for smooth heatmap visualization
     */
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
        // Convert rgb to rgba for transparency
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
