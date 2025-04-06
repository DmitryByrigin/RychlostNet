// Определение типов для LibreSpeed client v5.x
declare global {
  interface Window {
    Speedtest: new () => SpeedtestInstance;
  }
}

export interface SpeedtestInstance {
  // Методы для установки параметров и серверов
  setParameter(name: string, value: string | number | boolean): void;
  setSelectedServer(server: SpeedtestServer): void;
  getSelectedServer(): SpeedtestServer;
  
  // Методы запуска и остановки теста
  start(): void;
  abort(): void;
  
  // Обработчики событий
  onupdate: (data: SpeedtestData) => void;
  onend: (aborted: boolean) => void;
  
  // Методы для получения результатов
  getIp(): string;
  getMbps(): { dl: number; ul: number };
  getPing(): { avg: number; min: number; max: number };
  getJitter(): number;
}

export interface SpeedtestServer {
  name: string;
  server: string;
  url: string;
  provider?: string;
  location: string;
  country: string;
}

export interface SpeedtestData {
  testState?: number;
  dlProgress?: number;
  pingProgress?: number;
  ulProgress?: number;
  dlStatus?: number | string;
  ulStatus?: number | string;
  pingStatus?: number | string;
  jitterStatus?: number | string;
  clientIp?: string;
}

export {};
