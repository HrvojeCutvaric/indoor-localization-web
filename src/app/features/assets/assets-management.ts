import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { AssetService } from './asset.service';
import { CreateAssetRequest, UpdateAssetRequest } from './asset.model';
import { takeUntil } from 'rxjs/operators';
import { AssetListSidebar } from './components/asset-list-sidebar/asset-list-sidebar';
import { AssetDetailsPanel } from './components/asset-details-panel/asset-details-panel';
import { AssetUploadForm } from './components/asset-upload-form/asset-upload-form';
import { Asset } from './asset.model';

@Component({
  selector: 'app-asset-management',
  standalone: true,
  imports: [CommonModule, AssetListSidebar, AssetDetailsPanel, AssetUploadForm],
  templateUrl: './assets-management.html',
  styleUrl: './assets-management.scss',
})
export class AssetManagement implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private assetService = inject(AssetService);

  assets: Asset[] = [];
  selectedAsset: Asset | null = null;
  loading = false;

  showForm = false;
  formMode: 'create' | 'edit' = 'create';
  editingAsset: Asset | null = null;

  showDeleteConfirm = false;
  assetToDelete: Asset | null = null;
  deleteLoading = false;
  deleteError: string | null = null;

  ngOnInit(): void {
    // Load list of assets from backend via AssetService
    this.loading = true;
    this.assetService.getAssets()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (assets) => {
          this.assets = assets;
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load assets', err);
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onAssetSelected(asset: Asset): void {
    // fetch latest details from backend and set selected
    this.loading = true;
    this.assetService.getAssetById(Number(asset.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (a) => {
          this.selectedAsset = a;
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to fetch asset details', err);
          this.loading = false;
        }
      });
  }

  onAddAsset(): void {
    this.formMode = 'create';
    this.editingAsset = null;
    this.showForm = true;
  }

  onEditAsset(): void {
    if (this.selectedAsset) {
      this.formMode = 'edit';
      this.editingAsset = this.selectedAsset;
      this.showForm = true;
    }
  }

  onDeleteAsset(): void {
    if (this.selectedAsset) {
      this.assetToDelete = this.selectedAsset;
      this.showDeleteConfirm = true;
      this.deleteError = null;
    }
  }

  confirmDelete(): void {
    if (!this.assetToDelete) return;

    this.deleteLoading = true;
    this.deleteError = null;

    // call feature service delete
    this.assetService.deleteAsset(Number(this.assetToDelete.id)).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.deleteLoading = false;
        this.showDeleteConfirm = false;
        this.assets = this.assets.filter(a => a.id !== this.assetToDelete?.id);
        this.selectedAsset = null;
        this.assetToDelete = null;
      },
      error: (err) => {
        this.deleteLoading = false;
        this.deleteError = err?.message || 'Failed to delete asset';
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.assetToDelete = null;
    this.deleteError = null;
  }

  onFormSubmitted(asset: Asset | null): void {
    if (asset) {
      if (this.formMode === 'create') {
        this.loading = true;
        const payload: CreateAssetRequest = {
          name: asset.name,
          x: asset.x,
          y: asset.y,
          floorMapId: asset.floorMapId,
          active: asset.active ?? true,
          color: asset.color ?? '#000000',
        };

        this.assetService.createAsset(payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: (created) => {
            this.assets.push(created);
            this.selectedAsset = created;
            this.loading = false;
          },
          error: (err) => {
            console.error('Failed to create asset', err);
            this.loading = false;
          }
        });
      } else {
        // update - backend UpdateAssetRequest only updates name and color
        this.loading = true;
        const payload: UpdateAssetRequest = {
          name: asset.name,
          color: asset.color ?? '#000000',
        };

        this.assetService.updateAsset(Number(asset.id), payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: (updated) => {
            const idx = this.assets.findIndex(a => a.id === updated.id);
            if (idx !== -1) this.assets[idx] = updated;
            this.selectedAsset = updated;
            this.loading = false;
          },
          error: (err) => {
            console.error('Failed to update asset', err);
            this.loading = false;
          }
        });
      }
    }
    this.showForm = false;
    this.editingAsset = null;
  }

  onFormCancelled(): void {
    this.showForm = false;
    this.editingAsset = null;
  }
}
