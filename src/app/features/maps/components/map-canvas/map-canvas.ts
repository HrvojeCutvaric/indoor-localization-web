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
import { MapService, type Map } from '../../../../core/services/map.service';
import { AssetService } from '../../../../features/assets/asset.service';
import { Asset } from '../../../../features/assets/asset.model';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AppMqttService } from '../../../../core/services/mqtt.service';
import { ZonesService } from '../../../../features/zones/zones.service';
import type { DraftPoint, Zone } from '../../../../features/zones/zone.model';

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-canvas.html',
  styleUrls: ['./map-canvas.scss'],
})

export class MapCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas', { static: false })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private router = inject(Router);
  private mapService = inject(MapService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private assetService = inject(AssetService);
  private zonesService = inject(ZonesService);
  private mqttService = inject(AppMqttService);
  private assets: Asset[] = [];
  private assetUpdateSubscription?: Subscription;
  private image!: HTMLImageElement;
  imageLoaded = false;
  mapImagePath: string = '';

  private zones: Zone[] = [];
  private draftPoints: DraftPoint[] = [];

  // Animation properties
  private assetAnimationStates: Record<number, { currentX: number; currentY: number; targetX: number; targetY: number }> = {};
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private readonly LERP_SPEED = 0.1; // 0-1, higher = faster animation (10% per frame)

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
  private hasSelectedMap = false;

  @HostListener('window:resize')
  onResize() {
    if (!this.imageLoaded) return;
    this.initCanvas();
    this.setupScaleAndOffset();
    this.draw();
  }

  ngOnInit(): void {
    const selectedMap = this.mapService.getSelectedMap();
    console.log('MapCanvas ngOnInit - selectedMap:', selectedMap);
    if (selectedMap && selectedMap.image) {
      this.mapImagePath = this.mapService.getFullImageUrl(selectedMap.image);
      this.hasSelectedMap = true;
      console.log('Set mapImagePath to:', this.mapImagePath);
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
        console.log('MapCanvas selectedMap$ subscription - map:', map);
        if (map && map.image) {
          const newImagePath = this.mapService.getFullImageUrl(map.image);
          this.hasSelectedMap = true;
          this.mapImagePath = newImagePath;
          console.log('Updated mapImagePath to:', newImagePath);
          if (map.widthInMeters) {
            this.floorWidthMeters = map.widthInMeters;
          }
          if (map.heightInMeters) {
            this.floorHeightMeters = map.heightInMeters;
          }
          this.imageLoaded = false;
          this.cdr.detectChanges(); // Trigger change detection to render canvas
          // Use setTimeout to ensure canvas is rendered before we access it
          setTimeout(() => {
            this.loadImageIfCanvasReady();
          }, 0);

          // Start live asset updates for this floor map
          this.startAssetUpdates();
          this.zonesService.setMap(map.id);
        } else {
          // No map selected, stop asset updates
          this.stopAssetUpdates();
          this.assets = [];
        }
      });

    this.zonesService.zones$
      .pipe(takeUntil(this.destroy$))
      .subscribe(z => {
        this.zones = z;
        this.draw();
      });

    this.zonesService.draftPoints$
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => {
        this.draftPoints = p;
        this.draw();
      });
  }

  private loadImageIfCanvasReady(): void {
    if (this.canvasRef && this.canvasRef.nativeElement && this.mapImagePath) {
      if (!this.ctx) {
        this.initCanvas();
        this.setupCanvasListeners();
      }
      this.loadImage();
    }
  }

  private startAssetUpdates(): void {
    this.stopAssetUpdates(); // Clean up any existing subscription

    const selectedMap = this.mapService.getSelectedMap();
    if (!selectedMap) return;

    // Subscribe to MQTT asset updates
    this.assetUpdateSubscription = this.mqttService
      .getAssetUpdates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (mqttAssets) => {
          // Filter assets for the current floor map and only active ones
          const filteredAssets = mqttAssets.filter(
            asset => asset.floorMapId === Number(selectedMap.id) && asset.active
          );

          // Update animation states for new positions
          filteredAssets.forEach(asset => {
            if (asset.x !== null && asset.x !== undefined && asset.y !== null && asset.y !== undefined) {
              const state = this.assetAnimationStates[asset.id];
              if (!state) {
                // First time seeing this asset, initialize at target position
                this.assetAnimationStates[asset.id] = {
                  currentX: asset.x,
                  currentY: asset.y,
                  targetX: asset.x,
                  targetY: asset.y,
                };
              } else {
                // Update target position for animation
                state.targetX = asset.x;
                state.targetY = asset.y;
              }
            }
          });

          // Remove animation states for assets no longer in this map
          const assetIds = new Set(filteredAssets.map(a => a.id));
          for (const id in this.assetAnimationStates) {
            if (!assetIds.has(Number(id))) {
              delete this.assetAnimationStates[Number(id)];
            }
          }

          this.assets = filteredAssets;

          // Start animation loop if not already running
          if (!this.animationFrameId) {
            this.startAnimationLoop();
          }
        },
        error: (err) => {
          console.error('Failed to receive asset updates from MQTT:', err);
        }
      });
  }

  private startAnimationLoop(): void {
    const animate = (currentTime: number) => {
      const deltaTime = this.lastFrameTime ? (currentTime - this.lastFrameTime) / 1000 : 0;
      this.lastFrameTime = currentTime;

      // Update animation states with linear interpolation
      let hasActiveAnimation = false;
      for (const assetId in this.assetAnimationStates) {
        const state = this.assetAnimationStates[assetId];
        // Smoothly interpolate towards target position
        const distance = Math.sqrt(
          Math.pow(state.targetX - state.currentX, 2) +
          Math.pow(state.targetY - state.currentY, 2)
        );

        if (distance > 0.01) { // Only animate if distance is significant
          hasActiveAnimation = true;
          // Use LERP_SPEED as interpolation factor
          state.currentX += (state.targetX - state.currentX) * this.LERP_SPEED;
          state.currentY += (state.targetY - state.currentY) * this.LERP_SPEED;
        } else {
          // Snap to target if very close
          state.currentX = state.targetX;
          state.currentY = state.targetY;
        }
      }

      // Draw with interpolated positions
      this.draw();

      // Continue animation if there are still active animations
      if (hasActiveAnimation) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopAssetUpdates(): void {
    if (this.assetUpdateSubscription) {
      this.assetUpdateSubscription.unsubscribe();
      this.assetUpdateSubscription = undefined;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.assetAnimationStates = {};
  }

  ngOnDestroy(): void {
    this.stopAssetUpdates();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    if (this.canvasRef && this.canvasRef.nativeElement) {
      this.initCanvas();
      this.setupCanvasListeners();
      // If mapImagePath is already set (from ngOnInit or selectedMap$ subscription),
      // load the image immediately
      if (this.mapImagePath) {
        this.loadImage();
      }
    }
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
    console.log('Loading image from:', this.mapImagePath);
    const img = new Image();
    img.src = this.mapImagePath;
    img.onload = () => {
      console.log('Image loaded successfully');
      this.image = img;
      this.imageLoaded = true;
      this.cdr.detectChanges();
      this.setupScaleAndOffset();
      this.draw();
    };
    img.onerror = () => {
      console.error('Failed to load floor map image from:', this.mapImagePath);
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
    this.drawAssets();
    this.drawZones();
    this.drawDraftPolygon();
  }

  private drawCoordinateSystem(): void {
    const ctx = this.ctx;
    const imgW = this.image.width;
    const imgH = this.image.height;

    const textPad = 5 / this.scale; /* padding for text only, axes start from corner */

    ctx.save();
    ctx.lineWidth = 1 / this.scale;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.font = `${12 / this.scale}px Arial`;

    const step = 5;

    /* X-axis starts at the bottom-left corner (0, imgH) */
    const xAxisY = imgH;

    ctx.beginPath();
    ctx.moveTo(0, xAxisY);
    ctx.lineTo(imgW, xAxisY);
    ctx.stroke();

    for (let m = step; m < this.floorWidthMeters; m += step) {
      const x = m * this.pxPerMeterX;

      ctx.beginPath();
      ctx.moveTo(x, xAxisY);
      ctx.lineTo(x, xAxisY - 6 / this.scale);
      ctx.stroke();

      ctx.fillText(m.toString(), x - 4 / this.scale, xAxisY + 14 / this.scale);
    }

    /* Y-axis starts at the bottom-left corner (0, imgH) and goes to top-left (0, 0) */
    const yAxisX = 0;

    ctx.beginPath();
    ctx.moveTo(yAxisX, imgH);
    ctx.lineTo(yAxisX, 0);
    ctx.stroke();

    for (let m = step; m < this.floorHeightMeters; m += step) {
      const y = imgH - m * this.pxPerMeterY;

      ctx.beginPath();
      ctx.moveTo(yAxisX, y);
      ctx.lineTo(yAxisX + 6 / this.scale, y);
      ctx.stroke();

      ctx.fillText(m.toString(), yAxisX + 10 / this.scale, y + 4 / this.scale);
    }
    ctx.restore();
  }

  private drawAssets(): void {
    if (!this.assets.length) return;

    const ctx = this.ctx;
    ctx.save();

    // Draw each asset as a colored circle with label
    this.assets.forEach(asset => {
      if (asset.x !== null && asset.x !== undefined &&
        asset.y !== null && asset.y !== undefined) {

        // Get interpolated position from animation state
        const animState = this.assetAnimationStates[asset.id];
        const displayX = animState ? animState.currentX : asset.x;
        const displayY = animState ? animState.currentY : asset.y;

        // Convert meters to pixels
        const pixelX = displayX * this.pxPerMeterX;
        const pixelY = this.image.height - (displayY * this.pxPerMeterY); // Flip Y coordinate

        // Draw asset circle
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, 8 / this.scale, 0, 2 * Math.PI);
        ctx.fillStyle = asset.color || '#FF0000';
        ctx.fill();

        // Draw border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2 / this.scale;
        ctx.stroke();

        // Draw asset name
        ctx.fillStyle = '#000000';
        ctx.font = `${12 / this.scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(asset.name, pixelX, pixelY - 12 / this.scale);
      }
    });

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

  private metersToPixels(x: number, y: number): { px: number; py: number } {
    const px = x * this.pxPerMeterX;
    const py = this.image.height - (y * this.pxPerMeterY); // flip Y
    return { px, py };
  }

  private drawZones(): void {
    if (!this.imageLoaded || !this.zones?.length) return;

    const ctx = this.ctx;
    ctx.save();

    ctx.lineWidth = 2 / this.scale;
    ctx.strokeStyle = '#00A3FF';
    ctx.fillStyle = 'rgba(0, 163, 255, 0.15)';

    for (const zone of this.zones) {
      // Draw polygons if they exist
      if (zone.polygons && Array.isArray(zone.polygons)) {
        for (const polygon of zone.polygons) {
          if (!polygon.points || !Array.isArray(polygon.points) || polygon.points.length === 0) continue;
          
          ctx.beginPath();
          polygon.points.forEach((p, idx) => {
            const { px, py } = this.metersToPixels(p.x, p.y);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        continue;
      }
      
      // Fallback: try to use points field (for backward compatibility)
      let points = zone.points;
      if (typeof points === 'string') {
        try {
          points = JSON.parse(points);
        } catch (e) {
          console.error('Failed to parse zone points:', e);
          continue;
        }
      }
      
      if (!Array.isArray(points) || !points.length) continue;

      ctx.beginPath();
      points.forEach((p: any, idx) => {
        const { px, py } = this.metersToPixels(p.x || 0, p.y || 0);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawDraftPolygon(): void {
    if (!this.imageLoaded || !this.draftPoints?.length) return;

    const ctx = this.ctx;
    ctx.save();

    ctx.lineWidth = 2 / this.scale;
    ctx.strokeStyle = '#FF9900';
    ctx.fillStyle = 'rgba(255, 153, 0, 0.12)';

    ctx.beginPath();
    this.draftPoints.forEach((p, idx) => {
      const { px, py } = this.metersToPixels(p.x, p.y);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });

    if (this.draftPoints.length >= 3) {
      ctx.closePath();
      ctx.fill();
    }

    ctx.stroke();

    // vertex dots
    ctx.fillStyle = '#FF9900';
    for (const p of this.draftPoints) {
      const { px, py } = this.metersToPixels(p.x, p.y);
      ctx.beginPath();
      ctx.arc(px, py, 4 / this.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  public screenPointToMeters(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.imageLoaded) return null;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();

    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // invert setTransform(scale, 0, 0, scale, offsetX, offsetY)
    const imgX = (canvasX - this.offsetX) / this.scale;
    const imgY = (canvasY - this.offsetY) / this.scale;

    // ignore clicks outside image bounds
    if (imgX < 0 || imgY < 0 || imgX > this.image.width || imgY > this.image.height) {
      return null;
    }

    const xMeters = imgX / this.pxPerMeterX;
    const yMeters = (this.image.height - imgY) / this.pxPerMeterY;

    return { x: xMeters, y: yMeters };
  }
}