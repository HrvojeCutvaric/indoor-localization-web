import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, tap, catchError, finalize, filter, take, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/services/api-response.model';

export interface FloorMapResponse {
  id: number;
  name: string;
  imageUrl: string | null;
  imageWidthPx: number | null;
  imageHeightPx: number | null;
  widthInMeters: number;
  heightInMeters: number;
}

export interface Map {
  id: string;
  name: string;
  image?: string;
  imageWidthPx?: number;
  imageHeightPx?: number;
  widthInMeters?: number;
  heightInMeters?: number;
}

export interface MapError {
  message: string;
  code: string;
}

export interface FloorMapCreateRequest {
  name: string;
  imageFile?: File;
  imageWidthPx?: number;
  imageHeightPx?: number;
  widthInMeters: number;
  heightInMeters: number;
}

export interface FloorMapUpdateRequest {
  name?: string;
  imageFile?: File;
  imageWidthPx?: number;
  imageHeightPx?: number;
  widthInMeters?: number;
  heightInMeters?: number;
}

@Injectable({
  providedIn: 'root',
})
export class MapService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/FloorMaps`;

  private mapsSubject = new BehaviorSubject<Map[]>([]);
  public maps$ = this.mapsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private selectedMapSubject = new BehaviorSubject<Map | null>(null);
  public selectedMap$ = this.selectedMapSubject.asObservable();

  private readonly SELECTED_MAP_KEY = 'selectedMapId';

  constructor() {
    this.loadMaps();
    this.restoreSelectedMap();
  }

  private restoreSelectedMap(): void {
    const savedMapId = localStorage.getItem(this.SELECTED_MAP_KEY);
    if (savedMapId) {
      this.maps$.pipe(
        filter((mapList: Map[]) => mapList.length > 0),
        take(1),
        switchMap((mapList: Map[]) => {
          const foundMap = mapList.find(m => m.id === savedMapId);
          if (foundMap) {
            return of(foundMap);
          } else {
            return this.http.get<ApiResponse<FloorMapResponse>>(`${this.apiUrl}/${savedMapId}`).pipe(
              map(res => this.mapResponseToMap(res.data)),
              catchError(() => {
                localStorage.removeItem(this.SELECTED_MAP_KEY);
                return of(null);
              })
            );
          }
        }),
        filter((result: Map | null) => result !== null)
      ).subscribe((mapValue: Map | null) => {
        if (mapValue) {
          this.selectedMapSubject.next(mapValue);
        }
      });
    }
  }

  private mapResponseToMap(response: FloorMapResponse): Map {
    return {
      id: response.id.toString(),
      name: response.name,
      image: response.imageUrl || undefined,
      imageWidthPx: response.imageWidthPx || undefined,
      imageHeightPx: response.imageHeightPx || undefined,
      widthInMeters: response.widthInMeters,
      heightInMeters: response.heightInMeters,
    };
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';

    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      // Try various response formats
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.title) {
        errorMessage = error.error.title;
      } else if (error.error?.detail) {
        errorMessage = error.error.detail;
      } else if (typeof error.error === 'string') {
        errorMessage = error.error;
      } else {
        errorMessage = `Error Code: ${error.status}`;
      }
    }

    console.error('MapService error:', errorMessage);
    console.error('Full error response:', error.error);
    return throwError(() => ({ message: errorMessage, code: error.status.toString() } as MapError));
  }

  loadMaps(): void {
    this.loadingSubject.next(true);

    this.http.get<ApiResponse<FloorMapResponse[]>>(this.apiUrl)
      .pipe(
        map(res => res.data),
        map(responses => responses.map(r => this.mapResponseToMap(r))),
        catchError(error => {
          console.error('Failed to load maps from backend:', error);
          return of([]);
        }),
        finalize(() => this.loadingSubject.next(false))
      )
      .subscribe({
        next: (maps) => {
          this.mapsSubject.next(maps);
        },
        error: (err) => {
          console.error('Error loading maps:', err);
          if (this.mapsSubject.value.length === 0) {
            this.mapsSubject.next([]);
          }
        }
      });
  }

  getMaps(): Observable<Map[]> {
    return this.maps$;
  }

  getMapById(id: string): Observable<Map> {
    return this.http.get<ApiResponse<FloorMapResponse>>(`${this.apiUrl}/${id}`)
      .pipe(
        map(res => this.mapResponseToMap(res.data)),
        catchError(this.handleError)
      );
  }

  createMap(formData: FormData): Observable<Map> {
    this.loadingSubject.next(true);

    if (!formData.has('widthInMeters')) {
      formData.append('widthInMeters', '40');
    }
    if (!formData.has('heightInMeters')) {
      formData.append('heightInMeters', '40');
    }

    const imageFile = formData.get('image');
    if (imageFile && imageFile instanceof File) {
      formData.delete('image');
      formData.append('imageFile', imageFile);
    }

    return this.http.post<ApiResponse<FloorMapResponse>>(this.apiUrl, formData)
      .pipe(
        map(res => this.mapResponseToMap(res.data)),
        tap(newMap => {
          const currentMaps = this.mapsSubject.value;
          this.mapsSubject.next([...currentMaps, newMap]);
        }),
        catchError(this.handleError),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  updateMap(id: string, formData: FormData): Observable<Map> {
    this.loadingSubject.next(true);

    const imageFile = formData.get('image');
    if (imageFile && imageFile instanceof File) {
      formData.delete('image');
      formData.append('imageFile', imageFile);
    }

    return this.http.put<ApiResponse<FloorMapResponse>>(`${this.apiUrl}/${id}`, formData)
      .pipe(
        map(res => this.mapResponseToMap(res.data)),
        tap(updatedMap => {
          const currentMaps = this.mapsSubject.value;
          const index = currentMaps.findIndex(m => m.id === id);
          if (index !== -1) {
            currentMaps[index] = updatedMap;
            this.mapsSubject.next([...currentMaps]);
          }
        }),
        catchError(this.handleError),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  deleteMap(id: string): Observable<void> {
    this.loadingSubject.next(true);

    return this.http.delete<ApiResponse<unknown>>(`${this.apiUrl}/${id}`)
      .pipe(
        map(() => void 0),
        tap(() => {
          const currentMaps = this.mapsSubject.value;
          const filtered = currentMaps.filter(m => m.id !== id);
          this.mapsSubject.next(filtered);

          if (this.selectedMapSubject.value?.id === id) {
            this.selectedMapSubject.next(null);
          }
        }),
        catchError(this.handleError),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  setSelectedMap(mapValue: Map): void {
    this.selectedMapSubject.next(mapValue);
    localStorage.setItem(this.SELECTED_MAP_KEY, mapValue.id.toString());
  }

  getSelectedMap(): Map | null {
    return this.selectedMapSubject.value;
  }

  clearSelectedMap(): void {
    this.selectedMapSubject.next(null);
    localStorage.removeItem(this.SELECTED_MAP_KEY);
  }

  getFullImageUrl(imageUrl: string | undefined): string {
    if (!imageUrl) {
      console.log('No image URL provided, using demo');
      return '/floormaps/demo-floormap.png';
    }

    console.log('Image URL from backend:', imageUrl);

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      console.log('Using absolute URL:', imageUrl);
      return imageUrl;
    }

    if (imageUrl.startsWith('/images/')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      const fullUrl = `${baseUrl}${imageUrl}`;
      console.log('Constructed image URL:', fullUrl);
      return fullUrl;
    }

    if (!imageUrl.startsWith('/')) {
      const baseUrl = environment.apiUrl.replace('/api', '');
      const fullUrl = `${baseUrl}/images/${imageUrl}`;
      console.log('Constructed relative image URL:', fullUrl);
      return fullUrl;
    }

    console.log('Returning image URL as-is:', imageUrl);
    return imageUrl;
  }
}