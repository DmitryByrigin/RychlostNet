import { useState, useEffect } from 'react';
import { GeolocationData } from '../types/geolocation';

export const useClientGeolocation = () => {
    const [clientLocation, setClientLocation] = useState<GeolocationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [locationConsent, setLocationConsent] = useState<boolean | null>(null);

    useEffect(() => {
        const cachedLocation = localStorage.getItem('cachedLocation');
        const cacheTimestamp = localStorage.getItem('locationCacheTimestamp');
        const CACHE_DURATION = 30 * 60 * 1000; // 30 минут

        if (cachedLocation && cacheTimestamp) {
            const isValidCache = Date.now() - Number(cacheTimestamp) < CACHE_DURATION;
            if (isValidCache) {
                setClientLocation(JSON.parse(cachedLocation));
                return;
            }
        }

        getClientLocation();
    }, []);

    const getLocationDetails = async (latitude: number, longitude: number): Promise<any> => {
        try {
            // Получаем информацию о местоположении через OpenStreetMap
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

            return {
                city: osmData.address.city || osmData.address.town || osmData.address.village || 'Неизвестно',
                region: osmData.address.state || osmData.address.region || 'Неизвестно',
                country: osmData.address.country || 'Неизвестно',
                ip: ipapiData.ip,
                org: ipapiData.org || 'Неизвестный провайдер'
            };
        } catch (error) {
            console.warn('Ошибка получения деталей местоположения:', error);
            return null;
        }
    };

    const getClientLocation = async () => {
        try {
            if (!navigator.geolocation) {
                throw new Error('Геолокация не поддерживается вашим браузером');
            }

            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setLocationConsent(true);
                        resolve(pos);
                    },
                    (err) => {
                        setLocationConsent(false);
                        reject(err);
                    },
                    { 
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 300000 // 5 минут
                    }
                );
            });

            const locationDetails = await getLocationDetails(
                position.coords.latitude,
                position.coords.longitude
            );

            if (locationDetails) {
                const locationData = {
                    ip: locationDetails.ip,
                    city: locationDetails.city,
                    region: locationDetails.region,
                    country: locationDetails.country,
                    org: locationDetails.org,
                    lat: position.coords.latitude,
                    lon: position.coords.longitude,
                    servers: []
                };

                localStorage.setItem('cachedLocation', JSON.stringify(locationData));
                localStorage.setItem('locationCacheTimestamp', Date.now().toString());

                setClientLocation(locationData);
                return;
            }

            throw new Error('Не удалось получить детали местоположения');
        } catch (err) {
            console.warn('Ошибка геолокации браузера, используем резервный метод:', err);
            
            try {
                const response = await fetch('https://ipapi.co/json/');
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP: ${response.status}`);
                }

                const data = await response.json();
                const locationData = {
                    ip: data.ip,
                    city: data.city,
                    region: data.region,
                    country: data.country_name,
                    org: data.org || 'Неизвестный провайдер',
                    lat: data.latitude,
                    lon: data.longitude,
                    servers: []
                };

                localStorage.setItem('cachedLocation', JSON.stringify(locationData));
                localStorage.setItem('locationCacheTimestamp', Date.now().toString());

                setClientLocation(locationData);
            } catch (fallbackErr) {
                setError(fallbackErr instanceof Error ? fallbackErr.message : 'Не удалось получить местоположение');
                console.error('Ошибка получения местоположения:', fallbackErr);
            }
        }
    };

    return { 
        clientLocation, 
        error,
        locationConsent,
        refreshLocation: getClientLocation 
    };
};
