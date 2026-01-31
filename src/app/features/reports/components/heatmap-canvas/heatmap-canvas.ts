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
import { MapService } from '../../../../core/services/map.service';
import { HeatmapService, HeatmapData } from '../../heatmap.service';

@Component({
  selector: 'app-heatmap-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './heatmap-canvas.html',
  styleUrls: ['./heatmap-canvas.scss'],
})
export class HeatmapCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heatmapCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private mapService = inject(MapService);
  private heatmapService = inject(HeatmapService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  private image!: HTMLImageElement;
  imageLoaded = false;
  mapImagePath: string = '';
  heatmapData: HeatmapData | null = null;

  // UI state
  showHeatmap = true;
  heatmapOpacity = 0.6;
  heatmapRadius = 50;
  selectedMap = this.mapService.getSelectedMap();

  // Canvas scaling
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private minScale = 0.5;
  private maxScale = 4;

  // Dragging
  private isDragging = false;
  private lastDragX = 0;
  private lastDragY = 0;

  // Floor dimensions
  private floorWidthMeters = 40;
  private floorHeightMeters = 40;
  private pxPerMeterX = 1;
  private pxPerMeterY = 1;

  // Date filtering
  startDate: string = '';
  endDate: string = '';
  dateRangeApplied = false;

  // Trail visualization
  showTrails = true;
  trailLineWidth = 3;

  @HostListener('window:resize')
  onResize() {
    if (!this.imageLoaded) return;
    this.initCanvas();
    this.draw();
  }

  ngOnInit(): void {
    const selectedMap = this.mapService.getSelectedMap();
    if (selectedMap && selectedMap.image) {
      this.mapImagePath = this.mapService.getFullImageUrl(selectedMap.image);
      if (selectedMap.widthInMeters) {
        this.floorWidthMeters = selectedMap.widthInMeters;
      }
      if (selectedMap.heightInMeters) {
        this.floorHeightMeters = selectedMap.heightInMeters;
      }
    }

    // Load heatmap data
    this.loadHeatmapData();
  }

  ngAfterViewInit(): void {
    if (this.canvasRef) {
      const canvas = this.canvasRef.nativeElement;
      this.ctx = canvas.getContext('2d')!;
      
      const image = new Image();
      image.onload = () => {
        this.image = image;
        this.imageLoaded = true;
        this.initCanvas();
        this.setupScaleAndOffset();
        this.cdr.detectChanges();
        this.draw();
      };
      image.onerror = () => {
        console.error('Failed to load map image');
      };
      image.src = this.mapImagePath;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load heatmap data from service
   */
  private loadHeatmapData(): void {
    if (!this.selectedMap) return;

    const startDate = this.startDate ? new Date(this.startDate) : undefined;
    const endDate = this.endDate ? new Date(this.endDate) : undefined;

    console.log('Loading heatmap with date range:', { startDate, endDate });
    this.heatmapService
      .generateHeatmapData(this.selectedMap.id, startDate, endDate)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.heatmapData = data;
          this.heatmapService.updateHeatmapData(data);
          if (this.imageLoaded) {
            this.draw();
          }
        },
        error: (err) => {
          console.error('Failed to load heatmap data:', err);
        },
      });
  }

  /**
   * Initialize canvas
   */
  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  }

  /**
   * Setup scale and offset for drawing
   */
  private setupScaleAndOffset(): void {
    if (!this.image) return;

    const canvas = this.canvasRef.nativeElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imageWidth = this.image.width;
    const imageHeight = this.image.height;

    // Calculate scale to fit image in canvas
    const scaleX = canvasWidth / imageWidth;
    const scaleY = canvasHeight / imageHeight;
    this.baseScale = Math.min(scaleX, scaleY);
    this.scale = this.baseScale;

    // Center image
    this.offsetX = (canvasWidth - imageWidth * this.scale) / 2;
    this.offsetY = (canvasHeight - imageHeight * this.scale) / 2;

    // Calculate pixels per meter for coordinate transformation
    this.pxPerMeterX = (imageWidth * this.scale) / this.floorWidthMeters;
    this.pxPerMeterY = (imageHeight * this.scale) / this.floorHeightMeters;
  }

  /**
   * Draw the canvas with map and heatmap
   */
  draw(): void {
    if (!this.ctx || !this.image) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw map image
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.drawImage(this.image, 0, 0);
    this.ctx.restore();

    // Draw heatmap overlay
    if (this.showHeatmap && this.heatmapData) {
      this.drawHeatmap();
    }
  }

  /**
   * Draw heatmap on canvas
   */
  private drawHeatmap(): void {
    if (!this.heatmapData || !this.ctx || !this.image) return;

    const canvas = this.canvasRef.nativeElement;

    // Draw asset trails first (underneath the heatmap)
    if (this.showTrails && this.heatmapData.trails.length > 0) {
      this.drawAssetTrails();
    }

    this.ctx.save();
    this.ctx.globalAlpha = this.heatmapOpacity;

    // Create a temporary canvas for the heatmap
    const heatmapCanvas = document.createElement('canvas');
    heatmapCanvas.width = canvas.width;
    heatmapCanvas.height = canvas.height;
    const heatmapCtx = heatmapCanvas.getContext('2d')!;

    // Draw heatmap points with gradients
    this.heatmapData.points.forEach((point) => {
      const screenX = this.offsetX + point.x * this.pxPerMeterX;
      const screenY = this.offsetY + point.y * this.pxPerMeterY;

      const gradient = this.heatmapService.generateGradient(
        heatmapCtx,
        screenX,
        screenY,
        this.heatmapRadius,
        point.intensity,
        this.heatmapData!.minIntensity,
        this.heatmapData!.maxIntensity
      );

      heatmapCtx.fillStyle = gradient;
      heatmapCtx.beginPath();
      heatmapCtx.arc(screenX, screenY, this.heatmapRadius, 0, Math.PI * 2);
      heatmapCtx.fill();
    });

    // Draw the heatmap canvas on main canvas
    this.ctx.drawImage(heatmapCanvas, 0, 0);
    this.ctx.restore();
  }

  /**
   * Draw asset trails showing movement paths
   */
  private drawAssetTrails(): void {
    if (!this.heatmapData || !this.ctx) return;

    this.heatmapData.trails.forEach((trail) => {
      if (trail.points.length < 2) return;

      this.ctx.save();
      this.ctx.lineWidth = this.trailLineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      // Draw the trail as a gradient line from old to new positions
      for (let i = 0; i < trail.points.length - 1; i++) {
        const currentPoint = trail.points[i];
        const nextPoint = trail.points[i + 1];

        const x1 = this.offsetX + currentPoint.x * this.pxPerMeterX;
        const y1 = this.offsetY + currentPoint.y * this.pxPerMeterY;
        const x2 = this.offsetX + nextPoint.x * this.pxPerMeterX;
        const y2 = this.offsetY + nextPoint.y * this.pxPerMeterY;

        // Create gradient for this segment based on intensity
        const gradient = this.ctx.createLinearGradient(x1, y1, x2, y2);
        const color1 = this.heatmapService.getColorForIntensity(
          currentPoint.intensity,
          this.heatmapData!.minIntensity,
          this.heatmapData!.maxIntensity
        );
        const color2 = this.heatmapService.getColorForIntensity(
          nextPoint.intensity,
          this.heatmapData!.minIntensity,
          this.heatmapData!.maxIntensity
        );

        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);

        this.ctx.strokeStyle = gradient;
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
      }

      // Draw dots at each point along the trail
      trail.points.forEach((point, idx) => {
        const screenX = this.offsetX + point.x * this.pxPerMeterX;
        const screenY = this.offsetY + point.y * this.pxPerMeterY;

        // Dot size increases with intensity
        const dotRadius = 3 + point.intensity * 4;
        const color = this.heatmapService.getColorForIntensity(
          point.intensity,
          this.heatmapData!.minIntensity,
          this.heatmapData!.maxIntensity
        );

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, dotRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw white outline around dots for visibility
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
      });

      this.ctx.restore();
    });
  }

  /**
   * Update heatmap opacity
   */
  updateOpacity(value: number): void {
    this.heatmapOpacity = value;
    this.draw();
  }

  /**
   * Update heatmap radius
   */
  updateRadius(value: number): void {
    this.heatmapRadius = value;
    this.draw();
  }

  /**
   * Toggle heatmap visibility
   */
  toggleHeatmap(): void {
    this.showHeatmap = !this.showHeatmap;
    this.draw();
  }

  /**
   * Refresh heatmap data
   */
  refreshHeatmap(): void {
    this.loadHeatmapData();
  }

  /**
   * Apply date range filter
   */
  applyDateRange(): void {
    if (!this.startDate && !this.endDate) {
      console.warn('Please select at least one date');
      return;
    }
    this.dateRangeApplied = true;
    this.loadHeatmapData();
  }

  /**
   * Clear date range filter
   */
  clearDateRange(): void {
    this.startDate = '';
    this.endDate = '';
    this.dateRangeApplied = false;
    this.loadHeatmapData();
  }

  /**
   * Export heatmap as image
   */
  exportHeatmap(): void {
    const canvas = this.canvasRef.nativeElement;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `heatmap-${Date.now()}.png`;
    link.click();
  }

  // ─────────────────────────────────────────────────────────────
  // Canvas interaction handlers
  // ─────────────────────────────────────────────────────────────

  onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.lastDragX = event.clientX;
    this.lastDragY = event.clientY;
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.lastDragX;
    const deltaY = event.clientY - this.lastDragY;

    this.offsetX += deltaX;
    this.offsetY += deltaY;

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

    const zoomDirection = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = this.scale * zoomDirection;

    if (newScale >= this.minScale && newScale <= this.maxScale) {
      // Adjust offset to zoom towards mouse position
      this.offsetX = mouseX - ((mouseX - this.offsetX) * newScale) / this.scale;
      this.offsetY = mouseY - ((mouseY - this.offsetY) * newScale) / this.scale;

      this.scale = newScale;

      // Recalculate pixels per meter when zoom changes
      if (this.image) {
        const imageWidth = this.image.width;
        const imageHeight = this.image.height;
        this.pxPerMeterX = (imageWidth * this.scale) / this.floorWidthMeters;
        this.pxPerMeterY = (imageHeight * this.scale) / this.floorHeightMeters;
      }

      this.draw();
    }
  }

  private baseScale = 1;
}
