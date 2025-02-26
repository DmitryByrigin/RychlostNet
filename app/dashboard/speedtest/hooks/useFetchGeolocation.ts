import { useState, useEffect, useCallback } from 'react';
import { GeolocationData, Server } from '../types/geolocation';
import { useClientGeolocation } from './useClientGeolocation';

export const useFetchGeolocation = (): {
    geolocationData: GeolocationData | null;
    error: string | null;
    refetch: () => Promise<void>;
} => {
    const [geolocationData, setGeolocationData] = useState<GeolocationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { clientLocation } = useClientGeolocation();

    const fetchGeolocationData = useCallback(async (): Promise<void> => {
        try {
            const response = await fetch('/api/getgeolocation');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Server data:', data);

            if (!data.servers) {
                console.warn('No servers array in response');
                return;
            }

            // Создаем базовые данные о местоположении
            const baseLocation: GeolocationData = {
                ip: clientLocation?.ip || 'Unknown',
                city: clientLocation?.city || 'Unknown',
                region: clientLocation?.region || 'Unknown',
                country: clientLocation?.country || 'Unknown',
                org: clientLocation?.org || 'Unknown',
                lat: clientLocation?.lat || 0,
                lon: clientLocation?.lon || 0,
                servers: []
            };

            // Рассчитываем расстояния для серверов
            const serversWithDistance = data.servers.map((server: Server) => {
                const distance = calculateDistance(
                    { lat: server.lat, lon: server.lon },
                    { lat: baseLocation.lat, lon: baseLocation.lon }
                );
                return { ...server, distance };
            });

            // Сортируем серверы по расстоянию
            const sortedServers = serversWithDistance.sort((a: Server, b: Server) => 
                (a.distance || 0) - (b.distance || 0)
            );

            setGeolocationData({
                ...baseLocation,
                servers: sortedServers
            });
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to fetch geolocation data');
            console.error('Failed to fetch geolocation data', error);
        }
    }, [clientLocation]); // Добавляем clientLocation как зависимость для useCallback

    useEffect(() => {
        // Запускаем fetchGeolocationData даже если clientLocation еще не получен
        fetchGeolocationData().catch((error) => console.error('Error in useEffect:', error));
    }, [clientLocation, fetchGeolocationData]); // Теперь все зависимости указаны правильно

    return {
        geolocationData,
        error,
        refetch: fetchGeolocationData
    };
};

// Функция для расчета расстояния между двумя точками
function calculateDistance(point1: { lat: number; lon: number }, point2: { lat: number; lon: number }): number {
    const R = 6371; // Радиус Земли в километрах
    const dLat = toRad(point2.lat - point1.lat);
    const dLon = toRad(point2.lon - point1.lon);
    const lat1 = toRad(point1.lat);
    const lat2 = toRad(point2.lat);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(value: number): number {
    return value * Math.PI / 180;
}
