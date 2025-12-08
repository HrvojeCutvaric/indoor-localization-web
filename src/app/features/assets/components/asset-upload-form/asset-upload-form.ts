import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject } from 'rxjs';

export interface Asset {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

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

  isLoading = false;
  errorMessage: string | null = null;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(1)]],
    description: [''],
    status: [''],
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
    if (this.isEditMode && this.asset) {
      this.form.patchValue({
        name: this.asset.name,
        description: this.asset.description || '',
        status: this.asset.status || '',
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const asset: Asset = {
      id: this.asset?.id || new Date().getTime().toString(),
      name: this.form.get('name')?.value || '',
      description: this.form.get('description')?.value || undefined,
      status: this.form.get('status')?.value || undefined,
    };

    // TODO: In SCRUM-36, replace this with actual assetService.createAsset() or updateAsset() call
    // For now, just emit the asset and let the parent handle it
    setTimeout(() => {
      this.isLoading = false;
      this.submitted.emit(asset);
    }, 300);
  }

  onCancel(): void {
    this.form.reset();
    this.errorMessage = null;
    this.cancelled.emit();
  }
}
