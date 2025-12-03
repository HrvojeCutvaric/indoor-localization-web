import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MapService, type Map } from '../../../../core/services/map.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-map-upload-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './map-upload-form.html',
  styleUrl: './map-upload-form.scss',
})
export class MapUploadForm implements OnInit, OnDestroy {
  @Input() mapId: string | null = null;
  @Output() uploaded = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private mapService = inject(MapService);
  private destroy$ = new Subject<void>();

  isLoading = false;
  errorMessage: string | null = null;
  selectedFile: File | null = null;
  filePreview: string | null = null;

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
  });

  get f() {
    return this.form.controls;
  }

  ngOnInit(): void {
    if (this.mapId) {
      
      this.mapService.maps$
        .pipe(takeUntil(this.destroy$))
        .subscribe((maps: Map[]) => {
          const map = maps.find((m: Map) => m.id === this.mapId);
          if (map) {
            this.form.patchValue({
              name: map.name,
            });
            this.filePreview = map.image || null;
          }
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      
      
      
      if (!this.selectedFile.type.startsWith('image/')) {
        this.errorMessage = 'Please select a valid image file';
        this.selectedFile = null;
        return;
      }
      
      
      if (this.selectedFile.size > 5 * 1024 * 1024) {
        this.errorMessage = 'File size must be less than 5MB';
        this.selectedFile = null;
        return;
      }
      this.errorMessage = null;

      
      
      
      const reader = new FileReader();
      reader.onload = (e) => {
        this.filePreview = (e.target as FileReader).result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  submit(): void {
    if (this.form.invalid || !this.selectedFile) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const formData = new FormData();
    formData.append('name', this.form.get('name')?.value || '');
    formData.append('image', this.selectedFile);

    const request = this.mapId
      ? this.mapService.updateMap(this.mapId, formData)
      : this.mapService.createMap(formData);

    request
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.uploaded.emit();
        },
        error: (error: any) => {
          this.isLoading = false;
          this.errorMessage = error.message || 'Failed to upload map';
        },
      });
  }

  onCancel(): void {
    this.form.reset();
    this.selectedFile = null;
    this.filePreview = null;
    this.errorMessage = null;
    this.cancelled.emit();
  }
}
