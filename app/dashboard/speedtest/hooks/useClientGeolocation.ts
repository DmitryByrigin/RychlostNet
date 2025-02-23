import { useState, useEffect } from 'react';
import { GeolocationData } from '../types/geolocation';
import { GeolocationService } from '../services/geolocation.service';

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

    const getClientLocation = async () => {
        try {
            const locationData = await GeolocationService.getClientLocation();
            
            // Кэшируем результат
            localStorage.setItem('cachedLocation', JSON.stringify(locationData));
            localStorage.setItem('locationCacheTimestamp', Date.now().toString());
            
            setClientLocation(locationData);
            setError(null);
        } catch (error) {
            console.error('Ошибка при получении геолокации:', error);
            setError(error instanceof Error ? error.message : 'Неизвестная ошибка');
            
            // В случае ошибки используем кэшированные данные, если они есть
            const cachedLocation = localStorage.getItem('cachedLocation');
            if (cachedLocation) {
                setClientLocation(JSON.parse(cachedLocation));
            }
        }
    };

    return {
        clientLocation,
        error,
        locationConsent,
        setLocationConsent,
        refreshLocation: getClientLocation
    };
};
