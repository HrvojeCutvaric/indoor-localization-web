import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Map {
  id: string;
  name: string;
  image?: string;
}

export interface MapError {
  message: string;
  code: string;
}

@Injectable({
  providedIn: 'root',
})
export class MapService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/maps`;

  private mapsSubject = new BehaviorSubject<Map[]>([]);
  public maps$ = this.mapsSubject.asObservable();

  private blobUrls = new Set<string>();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.loadMaps();
  }

  loadMaps(): void {
    this.loadingSubject.next(true);
    const mockMaps: Map[] = [
      {
        id: '1',
        name: 'Ground Floor',
        image: '/floormaps/ground-floor.png',
      },
      {
        id: '2',
        name: 'First Floor',
        image: '/floormaps/first-floor.png',
      },
      {
        id: '3',
        name: 'Basement',
        image: '/floormaps/basement.png',
      },
    ];

    setTimeout(() => {
      this.mapsSubject.next(mockMaps);
      this.loadingSubject.next(false);
    }, 500);
  }

  getMaps(): Observable<Map[]> {
    return this.maps$;
  }

  getMapById(id: string): Observable<Map> {
    return this.http.get<Map>(`${this.apiUrl}/${id}`);
  }

  createMap(formData: FormData): Observable<Map> {
    this.loadingSubject.next(true);
    return new Observable((observer) => {
      setTimeout(() => {
        const fileEntry = formData.get('image');
        let imageUrl = '/floormaps/new-map.png';
        if (fileEntry && typeof (fileEntry as any).name === 'string') {
          try {
            const file = fileEntry as File;
            imageUrl = URL.createObjectURL(file);
            this.blobUrls.add(imageUrl);
          } catch (e) {
            imageUrl = '/floormaps/new-map.png';
          }
        }

        const mockMap: Map = {
          id: Date.now().toString(),
          name: (formData.get('name') as string) || 'Untitled Map',
          image: imageUrl,
        };

        const currentMaps = this.mapsSubject.value;
        this.mapsSubject.next([...currentMaps, mockMap]);
        this.loadingSubject.next(false);
        observer.next(mockMap);
        observer.complete();
      }, 1000);
    });
  }

  updateMap(id: string, formData: FormData): Observable<Map> {
    this.loadingSubject.next(true);
    return new Observable((observer) => {
      setTimeout(() => {
        const currentMaps = this.mapsSubject.value;
        const index = currentMaps.findIndex(m => m.id === id);
        if (index !== -1) {
          const fileEntry = formData.get('image');
          let image = currentMaps[index].image;
          if (fileEntry && typeof (fileEntry as any).name === 'string') {
            try {
              if (image && image.startsWith('blob:')) {
                this.revokeIfBlob(image);
              }
              const file = fileEntry as File;
              image = URL.createObjectURL(file);
              this.blobUrls.add(image);
            } catch (e) {
            }
          }

          currentMaps[index] = {
            ...currentMaps[index],
            name: (formData.get('name') as string) || currentMaps[index].name,
            image,
          };
          this.mapsSubject.next([...currentMaps]);
          this.loadingSubject.next(false);
          observer.next(currentMaps[index]);
          observer.complete();
        } else {
          observer.error({ message: 'Map not found', code: '404' });
        }
      }, 800);
    });
  }

  deleteMap(id: string): Observable<void> {
    this.loadingSubject.next(true);
    return new Observable((observer) => {
      setTimeout(() => {
        const currentMaps = this.mapsSubject.value;
        const mapToDelete = currentMaps.find(m => m.id === id);
        if (mapToDelete && mapToDelete.image && mapToDelete.image.startsWith('blob:')) {
          this.revokeIfBlob(mapToDelete.image);
        }
        const filtered = currentMaps.filter(m => m.id !== id);
        this.mapsSubject.next(filtered);
        this.loadingSubject.next(false);
        observer.next();
        observer.complete();
      }, 500);
    });
  }

  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  private revokeIfBlob(url?: string) {
    if (!url) return;
    try {
      if (this.blobUrls.has(url)) {
        URL.revokeObjectURL(url);
        this.blobUrls.delete(url);
      }
    } catch (e) {
    }
  }
}