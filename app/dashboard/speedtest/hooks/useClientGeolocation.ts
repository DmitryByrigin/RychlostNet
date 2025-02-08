import { useState, useEffect } from 'react';
import { GeolocationData } from '../types/geolocation';

export const useClientGeolocation = () => {
    const [clientLocation, setClientLocation] = useState<GeolocationData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const getClientLocation = async () => {
        try {
            // Сначала получаем геолокацию через браузерный API
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation is not supported by your browser'));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            // Теперь делаем запрос к ipdata.co с координатами
            console.log('Trying primary service (ipdata.co)...');
            const response = await fetch(
                `https://api.ipdata.co/?api-key=63c4dfaccc7a5385fa75956c7d58ae869791a2a2a204c7f21f5034f8`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                console.log('Successfully received data from ipdata.co');

                if (data && data.city && data.region && data.country_name) {
                    setClientLocation({
                        ip: data.ip,
                        city: data.city,
                        region: data.region,
                        country: data.country_name,
                        org: data.asn?.name || 'Unknown Organization',
                        lat: position.coords.latitude, // Используем координаты из браузера
                        lon: position.coords.longitude, // Используем координаты из браузера
                        servers: []
                    });
                    return;
                }
            }

            // Если первичный сервис не сработал, используем резервный
            console.log('Using fallback service (ipapi.co)...');
            const fallbackResponse = await fetch('https://ipapi.co/json/', {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!fallbackResponse.ok) {
                throw new Error(`ipapi.co returned status ${fallbackResponse.status}`);
            }

            const fallbackData = await fallbackResponse.json();
            
            if (!fallbackData.ip || !fallbackData.city || !fallbackData.region || !fallbackData.country_name) {
                throw new Error('Incomplete data received from ipapi.co');
            }

            setClientLocation({
                ip: fallbackData.ip,
                city: fallbackData.city,
                region: fallbackData.region,
                country: fallbackData.country_name,
                org: fallbackData.org || 'Unknown Organization',
                lat: position.coords.latitude, // Используем координаты из браузера
                lon: position.coords.longitude, // Используем координаты из браузера
                servers: []
            });
        } catch (err) {
            // Если не удалось получить геолокацию через браузер, пробуем получить через IP
            try {
                const response = await fetch('https://ipapi.co/json/', {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                setClientLocation({
                    ip: data.ip,
                    city: data.city,
                    region: data.region,
                    country: data.country_name,
                    org: data.org || 'Unknown Organization',
                    lat: data.latitude,
                    lon: data.longitude,
                    servers: []
                });
            } catch (fallbackErr) {
                setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to get location');
                console.error('Error getting client location:', fallbackErr);
            }
        }
    };

    useEffect(() => {
        getClientLocation();
    }, []);

    return { clientLocation, error };
};
