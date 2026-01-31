import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
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
    private readonly reportApiUrl = '/api/Reports';
    private useMockData = true; // Toggle for testing
    
    private heatmapDataSubject = new BehaviorSubject<HeatmapData | null>(null);
    heatmapData$ = this.heatmapDataSubject.asObservable();

    /**
     * Fetch heatmap data from backend for a floor map
     * Uses asset position history to generate heat intensity map and trails
     */
    generateHeatmapData(
        floorMapId: string | number,
        startDate?: Date,
        endDate?: Date
    ): Observable<HeatmapData> {
        // Use mock data for demonstration
        if (this.useMockData) {
            console.log('Using mock heatmap data');
            return of(this.generateMockHeatmapData(floorMapId));
        }

        // Build query parameters if dates provided
        let url = `${this.reportApiUrl}/floormaps/${floorMapId}/heatmap`;
        const params = new URLSearchParams();
        
        if (startDate) {
            params.append('startDate', startDate.toISOString());
        }
        if (endDate) {
            params.append('endDate', endDate.toISOString());
        }
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        console.log('Fetching heatmap data from:', url);
        return this.http.get<any>(url).pipe(
            map((response) => {
                console.log('Heatmap response:', response);
                // Handle ApiResponse wrapper
                const heatmapDataRaw = response.data || response;
                return this.parseHeatmapData(floorMapId, heatmapDataRaw);
            }),
            catchError((error) => {
                console.error('Failed to generate heatmap data:', error);
                // Fall back to mock data on error
                return of(this.generateMockHeatmapData(floorMapId));
            })
        );
    }

    /**
     * Generate mock heatmap data with asset trails
     */
    private generateMockHeatmapData(floorMapId: string | number): HeatmapData {
        const trails: AssetTrail[] = [];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

        // Generate 3 asset trails with movement paths
        for (let assetIdx = 0; assetIdx < 3; assetIdx++) {
            const startX = 5 + assetIdx * 10;
            const startY = 5 + Math.sin(assetIdx) * 5;
            const points = [];

            // Create a winding path for the asset
            for (let i = 0; i < 30; i++) {
                const progress = i / 30;
                const x = startX + progress * 25 + Math.sin(progress * Math.PI * 4) * 3;
                const y = startY + Math.sin(progress * Math.PI * 2) * 10;
                
                points.push({
                    x: Math.max(0, Math.min(40, x)),
                    y: Math.max(0, Math.min(40, y)),
                    timestamp: new Date(Date.now() - (30 - i) * 5000).toISOString(),
                    intensity: 0.3 + progress * 0.7, // Intensity increases along the trail
                });
            }

            trails.push({
                assetId: 1000 + assetIdx,
                assetName: `Asset ${assetIdx + 1}`,
                color: colors[assetIdx % colors.length],
                points,
            });
        }

        // Extract all points for heatmap data
        const allPoints: HeatmapDataPoint[] = trails.flatMap(trail =>
            trail.points.map(p => ({
                x: p.x,
                y: p.y,
                intensity: p.intensity,
            }))
        );

        const intensities = allPoints.map(p => p.intensity);
        const minIntensity = Math.min(...intensities, 0);
        const maxIntensity = Math.max(...intensities, 1);

        return {
            mapId: floorMapId,
            points: allPoints,
            trails,
            minIntensity,
            maxIntensity,
        };
    }

    /**
     * Parse heatmap data from backend response
     */
    private parseHeatmapData(floorMapId: string | number, data: any): HeatmapData {
        if (!data) {
            return this.createEmptyHeatmap(floorMapId);
        }

        // If data already has points array, use it directly
        if (Array.isArray(data)) {
            const points: HeatmapDataPoint[] = data.map((point: any) => ({
                x: point.x || 0,
                y: point.y || 0,
                intensity: point.intensity || 0.5,
            }));

            if (points.length === 0) {
                return this.createEmptyHeatmap(floorMapId);
            }

            const intensities = points.map(p => p.intensity);
            const minIntensity = Math.min(...intensities);
            const maxIntensity = Math.max(...intensities);

            return {
                mapId: floorMapId,
                points,
                trails: [],
                minIntensity,
                maxIntensity: Math.max(maxIntensity, 1),
            };
        }

        // If data is an object with points property
        if (data.points && Array.isArray(data.points)) {
            const points: HeatmapDataPoint[] = data.points.map((point: any) => ({
                x: point.x || 0,
                y: point.y || 0,
                intensity: point.intensity || 0.5,
            }));

            if (points.length === 0) {
                return this.createEmptyHeatmap(floorMapId);
            }

            const intensities = points.map(p => p.intensity);
            const minIntensity = Math.min(...intensities);
            const maxIntensity = Math.max(...intensities);

            return {
                mapId: floorMapId,
                points,
                trails: data.trails || [],
                minIntensity: data.minIntensity || minIntensity,
                maxIntensity: data.maxIntensity || Math.max(maxIntensity, 1),
            };
        }

        return this.createEmptyHeatmap(floorMapId);
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
     * Toggle mock data mode
     */
    toggleMockData(useMock: boolean): void {
        this.useMockData = useMock;
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
