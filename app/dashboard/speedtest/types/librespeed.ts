import { PingStats } from './speedTest';

// Типы для LibreSpeed API
// Основаны на документации LibreSpeed v5.x

/**
 * Интерфейс для объекта Speedtest
 */
export interface Speedtest {
  // Методы для установки параметров
  setParameter: (parameter: string, value: any) => void;
  
  // Методы для работы с серверами
  setSelectedServer: (server: any) => void;
  getSelectedServer: () => any;
  selectServer: (callback: (server: any) => void) => void;
  
  // Методы для получения информации о состоянии
  getState: () => number;
  
  // Методы для управления тестом
  start: () => void;
  abort: () => void;
  
  // Методы для получения результатов
  getMbps: () => { dl: number; ul: number };
  getPing: () => { avg: number; min: number; max: number };
  getJitter: () => number;
  getIp: () => string;
  
  // События
  onupdate: (data: SpeedTestData) => void;
  onend: (aborted: boolean) => void;
}

/**
 * Интерфейс для информации о сервере LibreSpeed
 */
export interface LibreSpeedServer {
  name: string;
  server: string;
  dlURL?: string;
  ulURL?: string;
  pingURL?: string;
  getIpURL?: string;
  country?: string;
  sponsorName?: string;
  sponsorURL?: string;
  distance?: number;
  location?: {
    city: string;
    region: string;
    country: string;
    org: string;
  };
}

/**
 * Интерфейс для данных, получаемых в процессе тестирования
 */
export interface SpeedTestData {
  testState: number; // 1 - download, 2 - ping, 3 - upload, 4 - finished
  dlStatus?: number;
  ulStatus?: number;
  pingStatus?: string;
  jitterStatus?: string;
  dlProgress?: number;
  ulProgress?: number;
  pingProgress?: number;
  ip?: string;
  isp?: string;
}

/**
 * Интерфейс для результатов тестирования
 */
export interface SpeedTestResult {
  download: number;
  upload: number;
  ping: PingStats;
  jitter: number;
  ip: string;
  isp?: string;
  server?: LibreSpeedServer;
  timestamp: string;
}

// Объявление для глобального объекта window с Speedtest
declare global {
  interface Window {
    Speedtest: new () => Speedtest;
  }
}
