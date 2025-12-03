import {
  AfterViewInit,
  Component,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-canvas.html',
  styleUrls: ['./map-canvas.scss'],
})

export class MapCanvasComponent implements AfterViewInit {
  @ViewChild('mapCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private image!: HTMLImageElement;
  private imageLoaded = false;

  private scale = 1;
  private baseScale = 1;
  private offsetX = 0;
  private offsetY = 0;

  private floorWidthMeters = 40;
  private floorHeightMeters = 40;

  private pxPerMeterX = 1;
  private pxPerMeterY = 1;

  @HostListener('window:resize')
  onResize() {
    if (!this.imageLoaded) return;
    this.initCanvas();
    this.setupScaleAndOffset();
    this.draw();
  }

  ngAfterViewInit(): void {
    this.initCanvas();
    this.loadImage();
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
    img.src = '/floormaps/demo-floormap.png';
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

    this.offsetX = (canvas.width - this.image.width * this.scale) / 2;
    this.offsetY = (canvas.height - this.image.height * this.scale) / 2;

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
}