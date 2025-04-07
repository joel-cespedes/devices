import { Component, signal } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, JsonPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  isConnected = signal(false);
  deviceName = signal('');
  rawData = signal<number[]>([]);

  private MOVESENSE_SERVICE_UUID = '34802252-7185-4d5d-b431-630e7050e8f0';
  private MOVESENSE_COMMAND_CHAR_UUID = '34800001-7185-4d5d-b431-630e7050e8f0';
  private MOVESENSE_NOTIFY_CHAR_UUID = '34800002-7185-4d5d-b431-630e7050e8f0';

  private commandChar!: BluetoothRemoteGATTCharacteristic;
  private notifyChar!: BluetoothRemoteGATTCharacteristic;

  // Tus comandos oficiales en formato binario directo
  private wTemp = [0x01, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x54, 0x65, 0x6d, 0x70]; // Temperatura
  private wAcc = [0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x31, 0x30, 0x34]; // Acelerómetro 104 Hz
  private wHR = [0x0c, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x48, 0x52]; // Frecuencia cardíaca

  async connectToDevice(): Promise<void> {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Movesense' }],
        optionalServices: [this.MOVESENSE_SERVICE_UUID],
      });

      this.deviceName.set(device.name || 'Movesense Device');
      const server = await device.gatt!.connect();

      const service = await server.getPrimaryService(this.MOVESENSE_SERVICE_UUID);
      this.commandChar = await service.getCharacteristic(this.MOVESENSE_COMMAND_CHAR_UUID);
      this.notifyChar = await service.getCharacteristic(this.MOVESENSE_NOTIFY_CHAR_UUID);

      await this.notifyChar.startNotifications();
      this.notifyChar.addEventListener('characteristicvaluechanged', event => this.handleNotification(event));

      this.isConnected.set(true);

      // Envía comandos binarios oficiales directamente
      await this.enviarComando(this.wTemp, "Temperatura");
      await this.enviarComando(this.wAcc, "Acelerómetro");
      await this.enviarComando(this.wHR, "Frecuencia Cardíaca");

    } catch (error) {
      console.error('❌ Error al conectar:', error);
      this.isConnected.set(false);
    }
  }

  private async enviarComando(comando: number[], descripcion: string): Promise<void> {
    const buffer = new Uint8Array(comando);
    try {
      await this.commandChar.writeValue(buffer);
      console.log(`✅ Comando "${descripcion}" enviado correctamente:`, comando);
    } catch (error) {
      console.error(`❌ Error enviando comando "${descripcion}":`, error);
    }
  }

  fall: any = 0;
  heartRate: any = 0;
  bpm: any = 0;
  temperature: any = 0;
  ecg: any  = 0;
  fallProcessed: any = 0;
  heartRateProcessed: any = 0;
  bpmProcessed: any = 0;
  temperatureProcessed: any = 0;
  ecgProcessed: any  = 0;
  steps: any = 0;
  arrhythmia: any = 0;

  target : any  = 0;

  private handleNotification(event: Event): void {
    const target = event.target as BluetoothRemoteGATTCharacteristic | null;
    if (!target?.value) {
      console.warn('⚠️ Notificación vacía recibida.');
      return;
    }
    this.target = target;

    const dataView = target.value;
    const rawBytes = Array.from(new Uint8Array(dataView.buffer));
    this.rawData.set(rawBytes);

    console.log('📥 Datos recibidos:', rawBytes);

    switch (rawBytes.length) {
      
      case 5:
        console.log('🛑 Detección de caída:', rawBytes);
        this.fall = rawBytes;
        this.fallProcessed = dataView.getUint8(2);
        this.steps = dataView.getUint8(3);
    
        break;
      case 8:
        const hr = dataView.getFloat32(2, true);
        this.heartRate = hr;
        this.bpm = rawBytes;
        this.heartRateProcessed = Math.round(dataView.getFloat32(2, true));
        this.arrhythmia =  dataView.getUint16(6, true)
        this.bpmProcessed = dataView.getUint8(3);      
        console.log('❤️ Frecuencia Cardíaca (HR):', hr, 'BPM', rawBytes);
        break;
      case 10:
        const temp = Math.round(dataView.getFloat32(2, true) - 273.15)
        this.temperature = rawBytes;
        this.arrhythmia =  dataView.getUint16(6, true)
        this.temperatureProcessed = temp;
        this.arrhythmia =  dataView.getUint16(6, true)
        console.log('🌡️ Temperatura:', temp, '°C', rawBytes);
        break;
      case 70:
        this.ecg = rawBytes;
        var ecg = [];
        for (var i = 0; i < 17; i++) {
          ecg[i] = dataView.getInt32(i * 4 + 2, true);
        }

        var tmpecg = [];
        for (var i = 0; i < 17; i++) {
          tmpecg[i] = ecg[i];
        }
        this.ecgProcessed =  tmpecg;
        break;
      default:
        console.warn('❓ Datos no identificados:', rawBytes);
    }
  }
}
