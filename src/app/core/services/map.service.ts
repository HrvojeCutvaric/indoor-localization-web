import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';


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

  constructor() {
    this.loadMaps();
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
   
      errorMessage = error.error?.message || `Error Code: ${error.status}`;
    }
    
    console.error('MapService error:', errorMessage);
    return throwError(() => ({ message: errorMessage, code: error.status.toString() } as MapError));
  }


  loadMaps(): void {
    this.loadingSubject.next(true);
    
    this.http.get<FloorMapResponse[]>(this.apiUrl)
      .pipe(
        map(responses => responses.map(r => this.mapResponseToMap(r))),
        catchError(error => {
          console.error('Failed to load maps from backend:', error);
          // Return empty array instead of demo data - user should upload real maps
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
    return this.http.get<FloorMapResponse>(`${this.apiUrl}/${id}`)
      .pipe(
        map(response => this.mapResponseToMap(response)),
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
    
    return this.http.post<FloorMapResponse>(this.apiUrl, formData)
      .pipe(
        map(response => this.mapResponseToMap(response)),
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
    
    return this.http.put<FloorMapResponse>(`${this.apiUrl}/${id}`, formData)
      .pipe(
        map(response => this.mapResponseToMap(response)),
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
    
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`)
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

  setSelectedMap(map: Map): void {
    this.selectedMapSubject.next(map);
  }

  getSelectedMap(): Map | null {
    return this.selectedMapSubject.value;
  }

  getFullImageUrl(imageUrl: string | undefined): string {
    if (!imageUrl) {
      return '/floormaps/demo-floormap.png'; 
    }
    

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    

    if (imageUrl.startsWith('/images/')) {

      const baseUrl = environment.apiUrl.replace('/api', '');
      return `${baseUrl}${imageUrl}`;
    }
    

    return imageUrl;
  }
}