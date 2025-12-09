import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Asset } from '../../asset.model';
import { MapService, Map } from '../../../../core/services/map.service';

@Component({
  selector: 'app-asset-upload-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './asset-upload-form.html',
  styleUrl: './asset-upload-form.scss',
})
export class AssetUploadForm implements OnInit, OnDestroy {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() asset: Asset | null = null;

  @Output() submitted = new EventEmitter<Asset | null>();
  @Output() cancelled = new EventEmitter<void>();

  private fb = new FormBuilder();
  private destroy$ = new Subject<void>();
  private mapService = inject(MapService);

  isLoading = false;
  errorMessage: string | null = null;
  maps: Map[] = [];
  mapsLoading = false;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    x: [0, [Validators.required]],
    y: [0, [Validators.required]],
    floorMapId: [0, [Validators.required]],
    active: [true, [Validators.required]],
    color: ['#000000', [Validators.required]],
  });

  get f() {
    return this.form.controls;
  }

  get isEditMode(): boolean {
    return this.mode === 'edit';
  }

  constructor(fb: FormBuilder) {
    this.fb = fb;
  }

  ngOnInit(): void {
    // Load available maps
    this.mapsLoading = true;
    this.mapService.getMaps()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (maps: Map[]) => {
          this.maps = maps;
          this.mapsLoading = false;
          // If editing, populate form with asset values
          if (this.isEditMode && this.asset) {
            this.form.patchValue({
              name: this.asset.name,
              x: this.asset.x ?? 0,
              y: this.asset.y ?? 0,
              floorMapId: this.asset.floorMapId,
              active: this.asset.active ?? true,
              color: this.asset.color ?? '#000000',
            });
          } else if (this.maps.length > 0) {
            // For create mode, set first available map as default
            this.form.patchValue({
              floorMapId: Number(this.maps[0].id),
            });
          }
        },
        error: (err: any) => {
          console.error('Failed to load maps', err);
          this.mapsLoading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Helper method for template to convert map ID to number
  getMapIdAsNumber(id: string): number {
    return Number(id);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const asset: Asset = {
      id: Number(this.asset?.id ?? Date.now()),
      name: this.form.get('name')?.value || '',
      x: Number(this.form.get('x')?.value ?? 0),
      y: Number(this.form.get('y')?.value ?? 0),
      floorMapId: Number(this.form.get('floorMapId')?.value ?? 0),
      active: !!this.form.get('active')?.value,
      color: this.form.get('color')?.value || '#000000',
    } as Asset;

    // Emit asset to parent; parent (AssetManagement) will call backend/service
    this.isLoading = false;
    this.submitted.emit(asset);
  }

  onCancel(): void {
    this.form.reset();
    this.errorMessage = null;
    this.cancelled.emit();
  }
}

