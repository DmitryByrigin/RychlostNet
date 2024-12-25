import { useState, useEffect } from 'react';
import { GeolocationData } from '../types/geolocation';

export const useFetchGeolocation = () => {
    const [geolocationData, setGeolocationData] = useState<GeolocationData | null>(null);
    const [currentServer, setCurrentServer] = useState<string>('');
    const [currentSponsor, setCurrentSponsor] = useState<string>('');

    const fetchGeolocationData = async (): Promise<void> => {
        try {
            const response = await fetch('/api/getgeolocation');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: GeolocationData = await response.json();

            const serversArray = Array.isArray(data.servers) ? data.servers : [data.servers];
            const sortedServers = serversArray.sort((a, b) => a.distance - b.distance);

            setGeolocationData({
                ...data,
                servers: sortedServers,
            });

            setCurrentServer(sortedServers[0].name);
            setCurrentSponsor(sortedServers[0].sponsor as string);
        } catch (error) {
            console.error('Failed to fetch geolocation data', error);
            throw error;
        }
    };

    useEffect(() => {
        fetchGeolocationData().catch((error) => console.error('Error in useEffect:', error));
    }, []);

    return {
        geolocationData,
        currentServer,
        currentSponsor,
        setCurrentServer,
        setCurrentSponsor,
    };
};
