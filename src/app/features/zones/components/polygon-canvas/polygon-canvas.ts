import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
  HostListener,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapService, type Map } from '../../../../core/services/map.service';
import { Zone, Polygon, Point } from '../../zone.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-polygon-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './polygon-canvas.html',
  styleUrls: ['./polygon-canvas.scss'],
})
export class PolygonCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('polygonCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() zone!: Zone;
  @Input() mapImagePath: string = '';
  @Input() imageLoaded: boolean = false;
  @Input() floorWidthMeters: number = 40;
  @Input() floorHeightMeters: number = 40;

  @Output() polygonCreated = new EventEmitter<Polygon>();
  @Output() polygonRemoved = new EventEmitter<string>();
  @Output() polygonsCleared = new EventEmitter<string[]>();  // Emits array of removed polygon IDs

  // Canvas and drawing state
  private ctx!: CanvasRenderingContext2D;
  private image!: HTMLImageElement;
  isDrawingMode = false;

  // Transform and viewport
  private scale = 1;
  private baseScale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private minScale = 0.5;
  private maxScale = 4;

  // Floor dimensions in meters (will be set from inputs)
  private pxPerMeterX = 1;
  private pxPerMeterY = 1;

  // Drawing interaction
  private isDragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private lastTouchDistance = 0;
  private isTouchPanning = false;

  // Polygon drawing
  currentPoints: Array<Point & { pixelX: number; pixelY: number }> = [];
  private mouseCanvasPos: Point = { x: 0, y: 0 };
  private hoveringOverStartPoint = false;
  private readonly MIN_POINTS_FOR_POLYGON = 3;
  private polygonsHistory: Polygon[] = [];

  private destroy$ = new Subject<void>();
  private mapServiceInstance = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private animationFrameId: number | null = null;

  ngOnInit(): void {
    console.log('PolygonCanvas: ngOnInit - Input values:', { 
      floorWidthMeters: this.floorWidthMeters, 
      floorHeightMeters: this.floorHeightMeters,
      zone: this.zone,
      mapImagePath: this.mapImagePath
    });
    
    if (this.zone && this.zone.polygons) {
      this.polygonsHistory = [...this.zone.polygons];
    }
  }

  ngAfterViewInit(): void {
    if (this.canvasRef && this.canvasRef.nativeElement && this.mapImagePath) {
      this.initCanvas();
      this.setupCanvasListeners();
      this.loadImage();
    }
  }

  ngOnDestroy(): void {
    this.stopAnimationLoop();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.imageLoaded) return;
    this.initCanvas();
    this.setupScaleAndOffset();
    this.draw();
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const parentRect = canvas.parentElement?.getBoundingClientRect();

    canvas.width = parentRect?.width ?? 800;
    canvas.height = parentRect?.height ?? 600;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get 2D canvas context');
    }
    this.ctx = ctx;
  }

  private setupCanvasListeners(): void {
    const canvas = this.canvasRef.nativeElement;

    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', () => this.onMouseUp());
    canvas.addEventListener('mouseleave', () => this.onMouseLeave());
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', () => this.onTouchEnd());
  }

  private loadImage(): void {
    if (!this.mapImagePath) return;

    const img = new Image();
    img.src = this.mapImagePath;
    img.onload = () => {
      this.image = img;
      this.setupScaleAndOffset();
      this.draw();
    };
    img.onerror = () => {
      console.error('Failed to load map image from:', this.mapImagePath);
    };
  }

  private setupScaleAndOffset(): void {
    if (!this.image) return;

    const canvas = this.canvasRef.nativeElement;
    const scaleX = canvas.width / this.image.width;
    const scaleY = canvas.height / this.image.height;
    this.baseScale = Math.min(scaleX, scaleY);
    this.scale = this.baseScale;
    this.minScale = this.baseScale * 0.5;
    this.maxScale = this.baseScale * 4;

    this.offsetX = (canvas.width - this.image.width * this.scale) / 2;
    this.offsetY = (canvas.height - this.image.height * this.scale) / 2;

    // Set floor dimensions - use inputs first, then fallback to selected map
    let floorWidth = this.floorWidthMeters;
    let floorHeight = this.floorHeightMeters;
    
    const selectedMap = this.mapServiceInstance.getSelectedMap();
    if (selectedMap?.widthInMeters && selectedMap?.heightInMeters) {
      floorWidth = selectedMap.widthInMeters;
      floorHeight = selectedMap.heightInMeters;
    }

    this.pxPerMeterX = this.image.width / floorWidth;
    this.pxPerMeterY = this.image.height / floorHeight;
    
    console.log('PolygonCanvas: Initialized floor dimensions', { floorWidth, floorHeight, pxPerMeterX: this.pxPerMeterX, pxPerMeterY: this.pxPerMeterY });
  }

  private draw(): void {
    if (!this.imageLoaded || !this.image) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

    ctx.drawImage(this.image, 0, 0);

    this.drawCompletedPolygons();
    this.drawCurrentPolygon();
  }

  private drawCompletedPolygons(): void {
    this.polygonsHistory.forEach(polygon => {
      this.drawPolygonShape(polygon.points, polygon.color || 'rgba(100, 200, 100, 0.3)', '#4CAF50', 2);
    });
  }

  private drawCurrentPolygon(): void {
    if (!this.isDrawingMode || this.currentPoints.length === 0) return;

    const currentPoints = this.currentPoints.map(p => ({ x: p.pixelX, y: p.pixelY }));

    // Draw filled area if we have enough points
    if (this.currentPoints.length >= this.MIN_POINTS_FOR_POLYGON) {
      this.drawPolygonShape(currentPoints, 'rgba(66, 165, 245, 0.2)', '#2196F3', 2);
    }

    // Draw lines connecting points
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2 / this.scale;
    ctx.setLineDash([5 / this.scale, 5 / this.scale]);

    for (let i = 0; i < currentPoints.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(currentPoints[i].x, currentPoints[i].y);
      ctx.lineTo(currentPoints[i + 1].x, currentPoints[i + 1].y);
      ctx.stroke();
    }

    // Draw line from last point to mouse position (preview)
    if (this.mouseCanvasPos.x >= 0 && this.mouseCanvasPos.y >= 0) {
      ctx.beginPath();
      ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
      ctx.lineTo(this.mouseCanvasPos.x, this.mouseCanvasPos.y);
      ctx.stroke();
    }

    // Draw line back to start point if we have minimum points
    if (this.currentPoints.length >= this.MIN_POINTS_FOR_POLYGON) {
      ctx.setLineDash([10 / this.scale, 5 / this.scale]);
      ctx.strokeStyle = '#4CAF50';
      ctx.beginPath();
      ctx.moveTo(currentPoints[currentPoints.length - 1].x, currentPoints[currentPoints.length - 1].y);
      ctx.lineTo(currentPoints[0].x, currentPoints[0].y);
      ctx.stroke();
    }

    ctx.restore();

    // Draw vertices
    this.drawVertices(currentPoints);

    // Draw start point highlight if hovering
    if (this.hoveringOverStartPoint && this.currentPoints.length >= this.MIN_POINTS_FOR_POLYGON) {
      ctx.save();
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(currentPoints[0].x, currentPoints[0].y, 8 / this.scale, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    this.drawDrawingGuidance();
  }

  private drawPolygonShape(points: Point[], fillStyle: string, strokeStyle: string, lineWidth: number): void {
    if (points.length < 3) return;

    const ctx = this.ctx;
    ctx.save();

    const imagePoints = points.map(p => this.convertMetersToImageCoordinates(p.x, p.y));

    // Draw filled area
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(imagePoints[0].x, imagePoints[0].y);
    for (let i = 1; i < imagePoints.length; i++) {
      ctx.lineTo(imagePoints[i].x, imagePoints[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Draw border
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth / this.scale;
    ctx.stroke();

    ctx.restore();

    // Draw vertices
    this.drawVertices(imagePoints);
  }

  private drawVertices(points: Array<{ x: number; y: number }>): void {
    const ctx = this.ctx;
    ctx.save();

    points.forEach((point, index) => {
      ctx.fillStyle = index === 0 ? '#4CAF50' : '#2196F3';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6 / this.scale, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5 / this.scale;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = `${10 / this.scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(index.toString(), point.x, point.y + 3 / this.scale);
    });

    ctx.restore();
  }

  private drawDrawingGuidance(): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef.nativeElement;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const guidance = [];
    const pointCount = this.currentPoints.length;

    if (pointCount === 0) {
      guidance.push('Click to start drawing a polygon');
    } else if (pointCount < this.MIN_POINTS_FOR_POLYGON) {
      guidance.push(`Click to add points (${this.MIN_POINTS_FOR_POLYGON - pointCount} more needed)`);
    } else {
      guidance.push('Click near the starting point to close polygon, or click to add more points');
    }

    guidance.push(`Points: ${pointCount}`);

    const fontSize = 14;
    const padding = 10;
    const lineHeight = 20;
    const textWidth = Math.max(...guidance.map(text => ctx.measureText(text).width)) + padding * 2;
    const textHeight = guidance.length * lineHeight + padding * 2;

    const x = canvas.width - textWidth - 15;
    const y = 15;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, textWidth, textHeight);

    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, textWidth, textHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'left';

    guidance.forEach((text, index) => {
      ctx.fillText(text, x + padding, y + padding + (index + 1) * lineHeight - 5);
    });

    ctx.restore();
  }

  private convertCanvasToImageCoordinates(canvasX: number, canvasY: number): Point {
    const imageX = (canvasX - this.offsetX) / this.scale;
    const imageY = (canvasY - this.offsetY) / this.scale;
    return { x: imageX, y: imageY };
  }

  private convertImageToMetersCoordinates(imageX: number, imageY: number): Point {
    // Safety check: if pxPerMeterX/Y are still at default 1, log warning
    if (this.pxPerMeterX === 1 || this.pxPerMeterY === 1) {
      console.warn('PolygonCanvas: pxPerMeterX/Y not properly initialized!', { pxPerMeterX: this.pxPerMeterX, pxPerMeterY: this.pxPerMeterY });
      console.warn('PolygonCanvas: Image dimensions:', { width: this.image?.width, height: this.image?.height });
      console.warn('PolygonCanvas: Floor dimensions:', { floorWidthMeters: this.floorWidthMeters, floorHeightMeters: this.floorHeightMeters });
    }
    
    const metersX = imageX / this.pxPerMeterX;
    const metersY = (this.image.height - imageY) / this.pxPerMeterY;
    return { x: metersX, y: metersY };
  }

  private convertMetersToImageCoordinates(metersX: number, metersY: number): Point {
    const imageX = metersX * this.pxPerMeterX;
    const imageY = this.image.height - metersY * this.pxPerMeterY;
    return { x: imageX, y: imageY };
  }

  private isPointNearStartPoint(pointX: number, pointY: number, threshold: number = 15): boolean {
    if (this.currentPoints.length < 3) return false;

    const startPoint = this.currentPoints[0];
    const distance = Math.sqrt(
      Math.pow(pointX - startPoint.pixelX, 2) + Math.pow(pointY - startPoint.pixelY, 2)
    );

    return distance <= threshold;
  }

  private getMouseImageCoordinates(canvasX: number, canvasY: number): Point & { metersX: number; metersY: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const relativeX = canvasX - rect.left;
    const relativeY = canvasY - rect.top;

    const { x: imageX, y: imageY } = this.convertCanvasToImageCoordinates(relativeX, relativeY);
    const { x: metersX, y: metersY } = this.convertImageToMetersCoordinates(imageX, imageY);

    return { x: imageX, y: imageY, metersX, metersY };
  }

  private onCanvasClick(canvasX: number, canvasY: number): void {
    if (!this.isDrawingMode || !this.imageLoaded) return;

    const { x: imageX, y: imageY, metersX, metersY } = this.getMouseImageCoordinates(canvasX, canvasY);

    // Check if clicking near the start point (to close polygon)
    if (this.isPointNearStartPoint(imageX, imageY)) {
      if (this.currentPoints.length >= this.MIN_POINTS_FOR_POLYGON) {
        this.finishPolygon();
      }
      return;
    }

    // Add new point to polygon
    this.currentPoints.push({
      x: metersX,
      y: metersY,
      pixelX: imageX,
      pixelY: imageY
    });

    this.draw();
  }

  private onCanvasMouseMove(canvasX: number, canvasY: number): void {
    if (!this.isDrawingMode || !this.imageLoaded) return;

    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const relativeX = canvasX - rect.left;
    const relativeY = canvasY - rect.top;

    const { x: imageX, y: imageY } = this.convertCanvasToImageCoordinates(relativeX, relativeY);

    this.mouseCanvasPos = { x: imageX, y: imageY };
    this.hoveringOverStartPoint = this.isPointNearStartPoint(imageX, imageY);

    if (this.currentPoints.length === 0) {
      canvas.style.cursor = 'crosshair';
    } else if (this.hoveringOverStartPoint && this.currentPoints.length >= this.MIN_POINTS_FOR_POLYGON) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'crosshair';
    }

    this.draw();
  }

  private onMouseLeave(): void {
    if (this.isDrawingMode) {
      this.mouseCanvasPos = { x: -1, y: -1 };
      this.draw();
    }
  }

  toggleDrawingMode(): void {
    this.isDrawingMode = !this.isDrawingMode;
    if (!this.isDrawingMode) {
      this.clearCurrentDrawing();
    } else {
      const canvas = this.canvasRef.nativeElement;
      canvas.style.cursor = 'crosshair';
    }
  }

  finishPolygon(): void {
    if (this.currentPoints.length < this.MIN_POINTS_FOR_POLYGON) return;

    console.log('PolygonCanvas: finishPolygon - currentPoints:', this.currentPoints);
    console.log('PolygonCanvas: finishPolygon - pxPerMeterX:', this.pxPerMeterX, 'pxPerMeterY:', this.pxPerMeterY);
    console.log('PolygonCanvas: finishPolygon - image dimensions:', { width: this.image.width, height: this.image.height });

    const polygon: Polygon = {
      id: `polygon_${Date.now()}`,
      points: this.currentPoints.map(p => {
        const pointData = { x: p.x, y: p.y };
        console.log('PolygonCanvas: Storing point:', pointData, '(original pixel: x=', p.pixelX, 'y=', p.pixelY, ')');
        return pointData;
      }),
      createdAt: Date.now(),
      color: 'rgba(100, 200, 100, 0.3)',
      name: `Zone ${this.polygonsHistory.length + 1}`
    };

    console.log('PolygonCanvas: Creating polygon:', polygon);
    console.log('PolygonCanvas: Polygon points array:', polygon.points);

    this.polygonsHistory.push(polygon);
    this.polygonCreated.emit(polygon);
    this.clearCurrentDrawing();
    this.draw();
  }

  clearCurrentDrawing(): void {
    this.currentPoints = [];
    this.mouseCanvasPos = { x: -1, y: -1 };
    this.hoveringOverStartPoint = false;
    const canvas = this.canvasRef.nativeElement;
    canvas.style.cursor = this.isDrawingMode ? 'crosshair' : 'default';
    this.draw();
  }

  removePolygon(polygonId: string): void {
    this.polygonsHistory = this.polygonsHistory.filter(p => p.id !== polygonId);
    this.polygonRemoved.emit(polygonId);
    this.draw();
  }

  clearAllPolygons(): void {
    const polygonIds = this.polygonsHistory.map(p => p.id);
    console.log('PolygonCanvas: Clearing all polygons:', polygonIds);
    
    this.polygonsHistory = [];
    this.clearCurrentDrawing();
    
    // Emit event for all removed polygons
    if (polygonIds.length > 0) {
      this.polygonsCleared.emit(polygonIds);
    }
  }

  undoLastPolygon(): void {
    if (this.polygonsHistory.length > 0) {
      const removed = this.polygonsHistory.pop();
      if (removed) {
        this.polygonRemoved.emit(removed.id);
      }
      this.draw();
    }
  }

  getPolygons(): Polygon[] {
    return this.polygonsHistory;
  }

  // Mouse and touch event handlers
  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoomFactor));

    this.offsetX = mouseX - (mouseX - this.offsetX) * (newScale / this.scale);
    this.offsetY = mouseY - (mouseY - this.offsetY) * (newScale / this.scale);
    this.scale = newScale;

    this.draw();
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.isDrawingMode) {
      this.onCanvasClick(e.clientX, e.clientY);
    } else {
      this.isDragging = true;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isDrawingMode) {
      this.onCanvasMouseMove(e.clientX, e.clientY);
    } else if (this.isDragging) {
      const deltaX = e.clientX - this.lastDragX;
      const deltaY = e.clientY - this.lastDragY;

      this.offsetX += deltaX;
      this.offsetY += deltaY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;

      this.draw();
    }
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onTouchStart(e: TouchEvent): void {
    if (!this.isDrawingMode) {
      if (e.touches.length === 1) {
        this.isTouchPanning = true;
        this.lastDragX = e.touches[0].clientX;
        this.lastDragY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.isTouchPanning = false;
        this.lastTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.isDrawingMode) return;
    e.preventDefault();

    if (e.touches.length === 1 && this.isTouchPanning) {
      const deltaX = e.touches[0].clientX - this.lastDragX;
      const deltaY = e.touches[0].clientY - this.lastDragY;

      this.offsetX += deltaX;
      this.offsetY += deltaY;
      this.lastDragX = e.touches[0].clientX;
      this.lastDragY = e.touches[0].clientY;

      this.draw();
    } else if (e.touches.length === 2) {
      const newDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
      const zoomFactor = newDistance / this.lastTouchDistance;
      const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoomFactor));

      const canvas = this.canvasRef.nativeElement;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      this.offsetX = centerX - (centerX - this.offsetX) * (newScale / this.scale);
      this.offsetY = centerY - (centerY - this.offsetY) * (newScale / this.scale);
      this.scale = newScale;

      this.draw();
      this.lastTouchDistance = newDistance;
    }
  }

  private onTouchEnd(): void {
    this.isTouchPanning = false;
  }

  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  zoomIn(): void {
    this.scale = Math.min(this.maxScale, this.scale * 1.1);
    this.draw();
  }

  zoomOut(): void {
    this.scale = Math.max(this.minScale, this.scale / 1.1);
    this.draw();
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
