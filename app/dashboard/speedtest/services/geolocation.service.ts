import { GeolocationData, Server } from '../types/geolocation';

const EARTH_RADIUS = 6371; // Радиус Земли в километрах

export class GeolocationService {
    private static toRad(value: number): number {
        return (value * Math.PI) / 180;
    }

    static calculateDistance(point1: { lat: number; lon: number }, point2: { lat: number; lon: number }): number {
        const dLat = this.toRad(point2.lat - point1.lat);
        const dLon = this.toRad(point2.lon - point1.lon);
        const lat1 = this.toRad(point1.lat);
        const lat2 = this.toRad(point2.lat);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS * c;
    }

    static async getClientLocation(): Promise<GeolocationData> {
        try {
            // Сначала пробуем получить геолокацию через браузер
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Геолокация не поддерживается браузером'));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            const { latitude, longitude } = position.coords;

            // Получаем детали местоположения через OpenStreetMap
            const osmResponse = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                {
                    headers: {
                        'Accept-Language': 'sk',
                        'User-Agent': 'RychlostNet Speed Test'
                    }
                }
            );

            if (!osmResponse.ok) {
                throw new Error(`Ошибка получения данных о местоположении: ${osmResponse.status}`);
            }

            const osmData = await osmResponse.json();

            // Получаем информацию о провайдере через ipapi.co
            const ipapiResponse = await fetch('https://ipapi.co/json/');
            if (!ipapiResponse.ok) {
                throw new Error(`Ошибка получения данных о провайдере: ${ipapiResponse.status}`);
            }

            const ipapiData = await ipapiResponse.json();

            // Формируем объект с данными о местоположении
            const locationData: GeolocationData = {
                ip: ipapiData.ip,
                city: osmData.address.city || osmData.address.town || osmData.address.village || 'Unknown',
                region: osmData.address.state || osmData.address.county || 'Unknown',
                country: osmData.address.country || 'Unknown',
                org: ipapiData.org || 'Unknown',
                lat: latitude,
                lon: longitude,
                servers: []
            };

            return locationData;
        } catch (error) {
            console.error('Ошибка при получении геолокации:', error);
            throw error;
        }
    }

    static async getServerList(): Promise<Server[]> {
        try {
            const response = await fetch('/api/getgeolocation', {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return Array.isArray(data.servers) ? data.servers : [data.servers];
        } catch (error) {
            console.error('Ошибка при получении списка серверов:', error);
            throw error;
        }
    }

    static async getServersWithDistance(clientLocation: GeolocationData): Promise<Server[]> {
        try {
            const servers = await this.getServerList();
            
            // Рассчитываем расстояния для серверов
            const serversWithDistance = servers.map(server => ({
                ...server,
                distance: this.calculateDistance(
                    { lat: server.lat, lon: server.lon },
                    { lat: clientLocation.lat, lon: clientLocation.lon }
                )
            }));

            // Сортируем серверы по расстоянию
            return serversWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
        } catch (error) {
            console.error('Ошибка при получении серверов с расстояниями:', error);
            throw error;
        }
    }
}
