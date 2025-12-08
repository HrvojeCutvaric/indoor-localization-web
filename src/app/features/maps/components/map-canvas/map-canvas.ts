import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  HostListener,
  inject,
  OnInit,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MapService } from '../../../../core/services/map.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-canvas.html',
  styleUrls: ['./map-canvas.scss'],
})

export class MapCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private router = inject(Router);
  private mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private image!: HTMLImageElement;
  private imageLoaded = false;
  private mapImagePath: string = '/floormaps/demo-floormap.png';

  private scale = 1;
  private baseScale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private minScale = 0.5;
  private maxScale = 4;

  private floorWidthMeters = 40;
  private floorHeightMeters = 40;

  private pxPerMeterX = 1;
  private pxPerMeterY = 1;

  private isDragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private lastTouchDistance = 0;
  private isTouchPanning = false;

  @HostListener('window:resize')
  onResize() {
    if (!this.imageLoaded) return;
    this.initCanvas();
    this.setupScaleAndOffset();
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

    this.mapService.selectedMap$
      .pipe(takeUntil(this.destroy$))
      .subscribe((map) => {
        if (map && map.image) {
          const newImagePath = this.mapService.getFullImageUrl(map.image);
          if (this.mapImagePath !== newImagePath) {
            this.mapImagePath = newImagePath;
            if (map.widthInMeters) {
              this.floorWidthMeters = map.widthInMeters;
            }
            if (map.heightInMeters) {
              this.floorHeightMeters = map.heightInMeters;
            }
            this.imageLoaded = false;
            if (this.ctx) {
              this.loadImage();
            }
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.initCanvas();
    this.loadImage();
    this.setupCanvasListeners();
  }

  private setupCanvasListeners(): void {
    const canvas = this.canvasRef.nativeElement;

    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', () => this.onMouseUp());
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', () => this.onTouchEnd());
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

  private loadImage(): void {
    const img = new Image();
    img.src = this.mapImagePath;
    img.onload = () => {
      this.image = img;
      this.imageLoaded = true;

      this.setupScaleAndOffset();
      this.draw();
    };
    img.onerror = () => {
      console.error('Failed to load floor map image');
    };
  }

  private setupScaleAndOffset(): void {
    const canvas = this.canvasRef.nativeElement;

    const scaleX = canvas.width / this.image.width;
    const scaleY = canvas.height / this.image.height;
    this.baseScale = Math.min(scaleX, scaleY);
    this.scale = this.baseScale;
    this.minScale = this.baseScale * 0.5;
    this.maxScale = this.baseScale * 4;

    this.offsetX = (canvas.width - this.image.width * this.scale) / 2;
    this.offsetY = (canvas.height - this.image.height * this.scale) / 2;

    const selectedMap = this.mapService.getSelectedMap();
    if (selectedMap?.widthInMeters && selectedMap?.heightInMeters) {
      this.floorWidthMeters = selectedMap.widthInMeters;
      this.floorHeightMeters = selectedMap.heightInMeters;
    } else {
      const aspectRatio = this.image.width / this.image.height;
      const baseMeters = 40;
      
      if (aspectRatio >= 1) {
        this.floorWidthMeters = baseMeters;
        this.floorHeightMeters = baseMeters / aspectRatio;
      } else {
        this.floorHeightMeters = baseMeters;
        this.floorWidthMeters = baseMeters * aspectRatio;
      }
    }

    this.pxPerMeterX = this.image.width / this.floorWidthMeters;
    this.pxPerMeterY = this.image.height / this.floorHeightMeters;
  }

  private draw(): void {
    if (!this.imageLoaded) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(
      this.scale,
      0,
      0,
      this.scale,
      this.offsetX,
      this.offsetY
    );

    ctx.drawImage(this.image, 0, 0);

    this.drawCoordinateSystem();
  }

  private drawCoordinateSystem(): void {
    const ctx = this.ctx;
    const imgW = this.image.width;
    const imgH = this.image.height;

    const pad = 20 / this.scale;

    ctx.save();
    ctx.lineWidth = 1 / this.scale;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.font = `${12 / this.scale}px Arial`;

    const step = 5;

    const xAxisY = imgH - pad;

    ctx.beginPath();
    ctx.moveTo(pad, xAxisY);
    ctx.lineTo(imgW - pad, xAxisY);
    ctx.stroke();

    for (let m = step; m < this.floorWidthMeters; m += step) {
      const x = pad + m * this.pxPerMeterX;

      ctx.beginPath();
      ctx.moveTo(x, xAxisY);
      ctx.lineTo(x, xAxisY - 6 / this.scale);
      ctx.stroke();

      ctx.fillText(m.toString(), x - 4 / this.scale, xAxisY + 14 / this.scale);
    }

    const yAxisX = pad;

    ctx.beginPath();
    ctx.moveTo(yAxisX, imgH - pad);
    ctx.lineTo(yAxisX, pad);
    ctx.stroke();

    for (let m = step; m < this.floorHeightMeters; m += step) {
      const y = imgH - pad - m * this.pxPerMeterY;

      ctx.beginPath();
      ctx.moveTo(yAxisX, y);
      ctx.lineTo(yAxisX + 6 / this.scale, y);
      ctx.stroke();

      ctx.fillText(m.toString(), yAxisX + 10 / this.scale, y + 4 / this.scale);
    }
    ctx.restore();
  }

  goToMaps(): void {
    this.router.navigate(['/maps']);
  }

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
    this.isDragging = true;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastDragX;
    const deltaY = e.clientY - this.lastDragY;

    this.offsetX += deltaX;
    this.offsetY += deltaY;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;

    this.draw();
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isTouchPanning = true;
      this.lastDragX = e.touches[0].clientX;
      this.lastDragY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this.isTouchPanning = false;
      this.lastTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
    }
  }

  private onTouchMove(e: TouchEvent): void {
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
}