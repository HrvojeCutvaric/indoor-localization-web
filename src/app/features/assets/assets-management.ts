import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { AssetListSidebar } from './components/asset-list-sidebar/asset-list-sidebar';
import { AssetDetailsPanel } from './components/asset-details-panel/asset-details-panel';
import { AssetUploadForm } from './components/asset-upload-form/asset-upload-form';

export interface Asset {
  id: string;
  name: string;
  description?: string;
  status?: string;
}

@Component({
  selector: 'app-asset-management',
  standalone: true,
  imports: [CommonModule, AssetListSidebar, AssetDetailsPanel, AssetUploadForm],
  templateUrl: './assets-management.html',
  styleUrl: './assets-management.scss',
})
export class AssetManagement implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

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
    // TODO: In SCRUM-36, inject AssetService and subscribe to assets$, selectedAsset$, loading$
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onAssetSelected(asset: Asset): void {
    this.selectedAsset = asset;
    // TODO: In SCRUM-36, call assetService.setSelectedAsset(asset);
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

    // TODO: In SCRUM-36, call assetService.deleteAsset(this.assetToDelete.id)
    // and handle response in subscribe callbacks
    setTimeout(() => {
      this.deleteLoading = false;
      this.showDeleteConfirm = false;
      this.assets = this.assets.filter(a => a.id !== this.assetToDelete?.id);
      this.selectedAsset = null;
      this.assetToDelete = null;
    }, 500);
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.assetToDelete = null;
    this.deleteError = null;
  }

  onFormSubmitted(asset: Asset | null): void {
    if (asset) {
      if (this.formMode === 'create') {
        this.assets.push(asset);
      } else {
        const idx = this.assets.findIndex(a => a.id === asset.id);
        if (idx !== -1) {
          this.assets[idx] = asset;
        }
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
