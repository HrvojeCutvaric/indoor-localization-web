// NOTE: Temporary test UI for CRUD logic.
// Final UI will be implemented in the task: "Web | Implement Asset CRUD Forms".

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AssetService } from '../asset.service';
import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest,
} from '../asset.model';

@Component({
  selector: 'app-assets-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assets-page.html',
  styleUrl: './assets-page.scss',
})

export class AssetsPage implements OnInit {
  assets: Asset[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  createForm: FormGroup;
  editForm: FormGroup | null = null;
  editingAssetId: number | null = null;

  constructor(
    private assetService: AssetService,
    private fb: FormBuilder,
  ) {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      x: [0, Validators.required],
      y: [0, Validators.required],
      floorMapId: [0, Validators.required],
      active: [true, Validators.required],
      color: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadAssets();
  }

  loadAssets(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.assetService.getAssets().subscribe({
      next: assets => {
        this.assets = assets;
        this.isLoading = false;
      },
      error: err => {
        this.setError(err);
        this.isLoading = false;
      },
    });
  }

  onCreate(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const payload: CreateAssetRequest = this.createForm.value;

    this.assetService.createAsset(payload).subscribe({
      next: asset => {
        this.assets = [...this.assets, asset];
        this.createForm.reset({
          name: '',
          x: 0,
          y: 0,
          floorMapId: 0,
          active: true,
          color: '',
        });
        this.setSuccess('Asset created successfully.');
      },
      error: err => this.setError(err),
    });
  }

  startEdit(asset: Asset): void {
    this.editingAssetId = asset.id;
    this.editForm = this.fb.group({
      name: [asset.name, Validators.required],
      x: [asset.x, Validators.required],
      y: [asset.y, Validators.required],
      floorMapId: [asset.floorMapId, Validators.required],
      active: [asset.active, Validators.required],
      color: [asset.color, Validators.required],
    });
  }

  cancelEdit(): void {
    this.editingAssetId = null;
    this.editForm = null;
  }

  onUpdate(): void {
    if (!this.editForm || this.editingAssetId === null) {
      return;
    }

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const payload: UpdateAssetRequest = this.editForm.value;

    const id = this.editingAssetId;

    this.assetService.updateAsset(id, payload).subscribe({
      next: updated => {
        this.assets = this.assets.map(a =>
          a.id === id ? { ...a, ...updated } : a,
        );
        this.setSuccess('Asset updated successfully.');
        this.cancelEdit();
      },
      error: err => this.setError(err),
    });
  }

  deleteAsset(asset: Asset): void {
    const confirmed = confirm(`Delete asset "${asset.name}"?`);
    if (!confirmed) {
      return;
    }

    this.assetService.deleteAsset(asset.id).subscribe({
      next: () => {
        this.assets = this.assets.filter(a => a.id !== asset.id);
        this.setSuccess('Asset deleted successfully.');
      },
      error: err => this.setError(err),
    });
  }

  private setSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = null;

    setTimeout(() => {
      this.successMessage = null;
    }, 4000);
  }

  private setError(error: any): void {
    console.error(error);
    this.errorMessage =
      error?.message || 'Unexpected error while processing request.';
    this.successMessage = null;
  }
}