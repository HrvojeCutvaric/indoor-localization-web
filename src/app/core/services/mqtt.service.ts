import { Injectable, OnInit } from '@angular/core';
import { IMqttServiceOptions, MqttService } from 'ngx-mqtt';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MqttAssetUpdate {
  id: number;
  name: string;
  x: number;
  y: number;
  floorMapId: number;
  active: boolean;
  color: string;
  timestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppMqttService {
  private assetUpdates$ = new BehaviorSubject<MqttAssetUpdate[]>([]);
  private isConnected$ = new BehaviorSubject<boolean>(false);

  private readonly assetTopic = 'air/assets/updates';
  private subscriptionActive = false;

  constructor(private mqttService: MqttService) {
    console.log('AppMqttService constructor - setting up listeners');
    this.setupConnectionListeners();
  }

  private setupConnectionListeners(): void {
    this.mqttService.onConnect.subscribe(
      () => {
        console.log('MQTT connected to HiveMQ');
        this.isConnected$.next(true);
        if (!this.subscriptionActive) {
          this.subscribeToAssetUpdates();
        }
      },
      (err: any) => console.error('onConnect error:', err)
    );

    this.mqttService.onError.subscribe((error: any) => {
      console.error('MQTT error:', error);
      this.isConnected$.next(false);
    });

    this.mqttService.onReconnect.subscribe(() => {
      console.log('MQTT reconnecting...');
      if (!this.subscriptionActive) {
        this.subscribeToAssetUpdates();
      }
    });

    this.mqttService.onClose.subscribe(() => {
      console.log('MQTT connection closed');
      this.isConnected$.next(false);
      this.subscriptionActive = false;
    });

    console.log('Connection listeners set up. Waiting for auto-connection from app config...');
  }

  private subscribeToAssetUpdates(): void {
    if (this.subscriptionActive) {
      console.log('Already subscribed to asset updates');
      return;
    }

    this.subscriptionActive = true;
    console.log('Subscribing to topic: air/assets/updates');
    
    this.mqttService.observe(this.assetTopic).subscribe(
      (message: any) => {
        try {
          const payload = message.payload.toString();
          console.log(' Raw MQTT payload:', payload);
          const data = JSON.parse(payload);
          const transformAsset = (asset: any): MqttAssetUpdate => ({
            id: asset.id,
            name: asset.name,
            x: asset.x,
            y: asset.y,
            floorMapId: asset.floorMapId,
            active: asset.active,
            color: asset.color || asset.colorHex || '#FF0000',
            timestamp: asset.timestamp || asset.lastSync,
          });


          const assets: MqttAssetUpdate[] = Array.isArray(data) 
            ? data.map(transformAsset)
            : [transformAsset(data)];
          
          const currentAssets = this.assetUpdates$.value;


          const updated = currentAssets.map(a => {
            const match = assets.find(u => u.id === a.id);
            return match ? { ...a, ...match } : a;
          });

          const newAssets = assets.filter(u => !currentAssets.find(a => a.id === u.id));
          const finalAssets = [...updated, ...newAssets];
          this.assetUpdates$.next(finalAssets);
          
          console.log('Assets transformed and updated:', finalAssets);
        } catch (err) {
          console.error('Error parsing MQTT asset update:', err);
        }
      },
      (err: any) => {
        console.error('Error observing asset updates:', err);
        this.subscriptionActive = false;
      }
    );
  }

 
  getAssetUpdates(): Observable<MqttAssetUpdate[]> {
    return this.assetUpdates$.asObservable();
  }


  getConnectionStatus(): Observable<boolean> {
    return this.isConnected$.asObservable();
  }

  disconnect(): void {
    this.mqttService.disconnect();
    console.log('MQTT disconnected');
    this.isConnected$.next(false);
  }


  reconnect(): void {
    this.subscribeToAssetUpdates();
    console.log('MQTT reconnecting...');
  }
}
