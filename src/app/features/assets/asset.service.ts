import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Asset,
  CreateAssetRequest,
  UpdateAssetRequest,
} from './asset.model';

@Injectable({
  providedIn: 'root',
})

export class AssetService {
  private readonly baseUrl = '/api/Asset';

  constructor(private http: HttpClient) { }

  getAssets(): Observable<Asset[]> {
    return this.http
      .get<Asset[]>(this.baseUrl)
      .pipe(catchError(error => this.handleError(error)));
  }

  getAssetById(id: number): Observable<Asset> {
    return this.http
      .get<Asset>(`${this.baseUrl}/${id}`)
      .pipe(catchError(error => this.handleError(error)));
  }

  createAsset(payload: CreateAssetRequest): Observable<Asset> {
    return this.http
      .post<Asset>(this.baseUrl, payload)
      .pipe(catchError(error => this.handleError(error)));
  }

  updateAsset(id: number, payload: UpdateAssetRequest): Observable<Asset> {
    return this.http
      .put<Asset>(`${this.baseUrl}/${id}`, payload)
      .pipe(catchError(error => this.handleError(error)));
  }

  updateAssetNameColor(id: number, payload: { name: string; color: string }): Promise<any> {
    return this.http
      .put(`${this.baseUrl}/${id}`, payload)
      .toPromise()
      .catch(error => this.handleError(error as HttpErrorResponse).toPromise());
  }

  updateAssetCoordinates(id: number, payload: { x: number; y: number }): Promise<any> {
    return this.http
      .put(`${this.baseUrl}/${id}/coordinates`, payload)
      .toPromise()
      .catch(error => this.handleError(error as HttpErrorResponse).toPromise());
  }

  updateAssetStatus(id: number, payload: { active: boolean }): Promise<any> {
    return this.http
      .put(`${this.baseUrl}/${id}/status`, payload)
      .toPromise()
      .catch(error => this.handleError(error as HttpErrorResponse).toPromise());
  }

  updateAssetFloorMap(id: number, payload: { floorMapId: number }): Promise<any> {
    return this.http
      .put(`${this.baseUrl}/${id}/floormap`, payload)
      .toPromise()
      .catch(error => this.handleError(error as HttpErrorResponse).toPromise());
  }

  deleteAsset(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .pipe(catchError(error => this.handleError(error)));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    if (error.status === 0) {
      console.error('Network error:', error);
      return throwError(() => new Error('Network error'));
    }

    switch (error.status) {
      case 400:
        return throwError(() => new Error(error.error || 'Validation error'));
      case 401:
        return throwError(() => new Error('Unauthorized'));
      case 404:
        return throwError(() => new Error('Asset not found'));
      default:
        return throwError(() => new Error('Unexpected server error'));
    }
  }
}