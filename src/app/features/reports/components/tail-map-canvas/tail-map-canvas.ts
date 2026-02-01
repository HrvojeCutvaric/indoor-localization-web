import {
    Component,
    OnInit,
    AfterViewInit,
    ViewChild,
    ElementRef,
    OnDestroy,
    inject,
    ChangeDetectorRef,
    HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MapService, type Map } from '../../../../core/services/map.service';
import {
    TailMapService,
    AssetOnFloorMap,
    AssetPositionHistoryRecord,
} from './tail-map.service';

@Component({
    selector: 'app-tail-map-canvas',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './tail-map-canvas.html',
    styleUrls: ['./tail-map-canvas.scss'],
})
export class TailMapCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('tailCanvas', { static: false })
    canvasRef!: ElementRef<HTMLCanvasElement>;

    private ctx!: CanvasRenderingContext2D;
    private mapService = inject(MapService);
    private tailMapService = inject(TailMapService);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    private image!: HTMLImageElement;
    imageLoaded = false;
    mapImagePath = '';

    selectedMap: Map | null = null;
    private canvasReady = false;

    assets: AssetOnFloorMap[] = [];
    selectedAssetId: number | null = null;

    startDate = '';
    endDate = '';
    dateRangeApplied = false;
    dataLoading = false;

    trailLineWidth = 3;
    showPoints = true;

    isGenerating = false;

    history: AssetPositionHistoryRecord[] = [];

    private scale = 1;
    private baseScale = 1;
    private offsetX = 0;
    private offsetY = 0;
    private minScale = 0.5;
    private maxScale = 4;

    private isDragging = false;
    private lastDragX = 0;
    private lastDragY = 0;

    private floorWidthMeters = 40;
    private floorHeightMeters = 40;
    private pxPerMeterX = 1;
    private pxPerMeterY = 1;

    @HostListener('window:resize')
    onResize(): void {
        if (!this.imageLoaded) return;
        this.initCanvas();
        this.setupScaleAndOffset();
        this.draw();
    }

    ngOnInit(): void {
        this.mapService.selectedMap$
            .pipe(takeUntil(this.destroy$))
            .subscribe((mapValue) => {
                this.selectedMap = mapValue;

                if (!this.selectedMap?.image) {
                    this.imageLoaded = false;
                    this.mapImagePath = '';
                    this.assets = [];
                    this.selectedAssetId = null;
                    this.history = [];
                    this.draw();
                    return;
                }

                this.mapImagePath = this.mapService.getFullImageUrl(this.selectedMap.image);

                if (this.selectedMap.widthInMeters) this.floorWidthMeters = this.selectedMap.widthInMeters;
                if (this.selectedMap.heightInMeters) this.floorHeightMeters = this.selectedMap.heightInMeters;

                if (this.selectedMap.id != null) {
                    this.loadAssetsForMap(Number(this.selectedMap.id));
                }

                if (this.canvasReady) {
                    this.loadMapImageAndInit();
                }
            });
    }

    ngAfterViewInit(): void {
        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.canvasReady = true;

        if (this.selectedMap?.image) {
            this.loadMapImageAndInit();
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadMapImageAndInit(): void {
        if (!this.mapImagePath) return;

        this.imageLoaded = false;

        const image = new Image();
        image.onload = () => {
            this.image = image;
            this.imageLoaded = true;
            this.initCanvas();
            this.setupScaleAndOffset();
            this.cdr.detectChanges();
            this.draw();
        };
        image.onerror = () => console.error('Failed to load map image');
        image.src = this.mapImagePath;
    }

    private loadAssetsForMap(floorMapId: number): void {
        this.tailMapService
            .getAssetsByFloorMap(floorMapId)
            .pipe(takeUntil(this.destroy$))
            .subscribe((assets) => {
                this.assets = (assets ?? []).filter((a) => a?.active !== false);
            });
    }

    onAssetChange(): void {
        this.history = [];
        this.draw();
    }

    generateTailMap(): void {
        if (!this.selectedAssetId || this.isGenerating) return;

        this.isGenerating = true;
        this.dataLoading = true;

        this.tailMapService
            .getAssetPositionHistory(this.selectedAssetId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (records) => {
                    let start: Date | undefined = undefined;
                    let end: Date | undefined = undefined;

                    if (this.startDate) {
                        start = new Date(this.startDate);
                        if (isNaN(start.getTime())) {
                            start = undefined;
                            console.error('Invalid trail startDate:', this.startDate);
                        } else {
                            console.log('Parsed trail startDate (local):', { input: this.startDate, parsed: start.toString(), time: start.getTime() });
                        }
                    }

                    if (this.endDate) {
                        end = new Date(this.endDate);
                        if (isNaN(end.getTime())) {
                            end = undefined;
                            console.error('Invalid trail endDate:', this.endDate);
                        } else {
                            console.log('Parsed trail endDate (local):', { input: this.endDate, parsed: end.toString(), time: end.getTime() });
                        }
                    }

                    let filtered = records ?? [];
                    if (start || end) {
                        const startTime = start?.getTime();
                        const endTime = end?.getTime();
                        
                        if (filtered.length > 0) {
                            const sample = filtered[0];
                            const sampleTs = (sample as any).dateTime || sample.timestamp;
                            console.log('%c🔍 TRAIL FILTER DEBUG', 'background: orange; color: black; font-weight: bold', {
                                startTime,
                                endTime,
                                startStr: start?.toString(),
                                endStr: end?.toString(),
                                totalRecords: filtered.length,
                                sampleRecord: sample,
                                allKeys: Object.keys(sample),
                                sampleTimestampValue: sampleTs,
                                sampleTimestampParsed: new Date(sampleTs).toString(),
                                sampleTimestampMs: new Date(sampleTs).getTime()
                            });
                        }
                        
                        console.log('Before filtering:', filtered.length, 'records');
                        filtered = filtered.filter((r) => {
                            const timestampValue = (r as any).dateTime || r.timestamp || (r as any).DateTime;
                            if (!timestampValue) {
                                console.warn('No timestamp field in record:', r);
                                return false;
                            }
                            const t = new Date(timestampValue).getTime();
                            if (isNaN(t)) {
                                console.warn('Invalid timestamp:', timestampValue);
                                return false;
                            }
                            const include = (!startTime || t >= startTime) && (!endTime || t <= endTime);
                            return include;
                        });
                        console.log('After filtering:', filtered.length, 'records');
                    }

                    filtered.sort(
                        (a, b) => {
                            const tsA = (a as any).dateTime || a.timestamp;
                            const tsB = (b as any).dateTime || b.timestamp;
                            return new Date(tsA).getTime() - new Date(tsB).getTime();
                        }
                    );

                    this.history = filtered;
                    this.isGenerating = false;
                    this.dataLoading = false;
                    console.log('Trail data loaded:', filtered.length, 'records');
                    this.draw();
                },
                error: (err) => {
                    console.error('Failed to load tail history:', err);
                    this.isGenerating = false;
                    this.dataLoading = false;
                },
            });
    }

    refreshTailMap(): void {
        if (!this.selectedAssetId || this.isGenerating) return;
        this.generateTailMap();
    }

    applyDateRange(): void {
        if (!this.startDate && !this.endDate) return;
        this.dateRangeApplied = true;
        console.log('Applying date range filter:', { start: this.startDate, end: this.endDate });
        if (this.selectedAssetId) this.generateTailMap();
    }

    clearDateRange(): void {
        this.startDate = '';
        this.endDate = '';
        this.dateRangeApplied = false;
        this.dataLoading = false;

        if (this.selectedAssetId) {
            this.generateTailMap();
        } else {
            this.history = [];
            this.draw();
        }
    }

    exportTailMap(): void {
        const canvas = this.canvasRef?.nativeElement;
        if (!canvas || this.history.length === 0) return;

        this.draw();

        const link = document.createElement('a');
        link.download = `tail-map-asset-${this.selectedAssetId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    private initCanvas(): void {
        const canvas = this.canvasRef.nativeElement;
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
        }
    }

    private setupScaleAndOffset(): void {
        if (!this.image) return;

        const canvas = this.canvasRef.nativeElement;

        const scaleX = canvas.width / this.image.width;
        const scaleY = canvas.height / this.image.height;

        this.baseScale = Math.min(scaleX, scaleY);
        this.scale = this.baseScale;

        this.offsetX = (canvas.width - this.image.width * this.scale) / 2;
        this.offsetY = (canvas.height - this.image.height * this.scale) / 2;

        this.pxPerMeterX = (this.image.width * this.scale) / this.floorWidthMeters;
        this.pxPerMeterY = (this.image.height * this.scale) / this.floorHeightMeters;
    }

    draw(): void {
        if (!this.ctx || !this.image) return;

        const canvas = this.canvasRef.nativeElement;
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        this.ctx.drawImage(this.image, 0, 0);
        this.ctx.restore();

        this.drawTrail();
    }

    private drawTrail(): void {
        if (!this.ctx || this.history.length < 2) return;

        this.ctx.save();
        this.ctx.lineWidth = this.trailLineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = 'rgba(33, 150, 243, 0.95)';

        this.ctx.beginPath();

        const first = this.history[0];
        this.ctx.moveTo(
            this.offsetX + first.x * this.pxPerMeterX,
            this.offsetY + (this.floorHeightMeters - first.y) * this.pxPerMeterY
        );

        for (let i = 1; i < this.history.length; i++) {
            const p = this.history[i];
            this.ctx.lineTo(
                this.offsetX + p.x * this.pxPerMeterX,
                this.offsetY + (this.floorHeightMeters - p.y) * this.pxPerMeterY
            );
        }

        this.ctx.stroke();

        if (this.showPoints) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
            this.ctx.strokeStyle = 'rgba(33,150,243,0.95)';
            this.ctx.lineWidth = 1.5;

            for (const p of this.history) {
                this.ctx.beginPath();
                this.ctx.arc(
                    this.offsetX + p.x * this.pxPerMeterX,
                    this.offsetY + (this.floorHeightMeters - p.y) * this.pxPerMeterY,
                    3,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
                this.ctx.stroke();
            }
        }

        this.ctx.restore();
    }

    onMouseDown(event: MouseEvent): void {
        this.isDragging = true;
        this.lastDragX = event.clientX;
        this.lastDragY = event.clientY;
    }

    onMouseMove(event: MouseEvent): void {
        if (!this.isDragging) return;

        this.offsetX += event.clientX - this.lastDragX;
        this.offsetY += event.clientY - this.lastDragY;

        this.lastDragX = event.clientX;
        this.lastDragY = event.clientY;

        this.draw();
    }

    onMouseUp(): void {
        this.isDragging = false;
    }

    onWheel(event: WheelEvent): void {
        if (!this.imageLoaded) return;
        event.preventDefault();

        const canvas = this.canvasRef.nativeElement;
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        const zoom = event.deltaY > 0 ? 0.9 : 1.1;
        const newScale = this.scale * zoom;

        if (newScale < this.minScale || newScale > this.maxScale) return;

        this.offsetX = mouseX - ((mouseX - this.offsetX) * newScale) / this.scale;
        this.offsetY = mouseY - ((mouseY - this.offsetY) * newScale) / this.scale;

        this.scale = newScale;

        this.pxPerMeterX = (this.image.width * this.scale) / this.floorWidthMeters;
        this.pxPerMeterY = (this.image.height * this.scale) / this.floorHeightMeters;

        this.draw();
    }
}