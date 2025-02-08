import React, { createContext, useContext, useState, useEffect } from 'react';
import { GeolocationData, Server } from '../types/geolocation';
import { useClientGeolocation } from '../hooks/useClientGeolocation';

interface ServerContextType {
    geolocationData: GeolocationData | null;
    selectedServer: Server | null;
    setCurrentServer: (serverName: string) => void;
    isLoading: boolean;
}

const ServerContext = createContext<ServerContextType | null>(null);

export const useServer = () => {
    const context = useContext(ServerContext);
    if (!context) {
        throw new Error('useServer must be used within a ServerProvider');
    }
    return context;
};

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [geolocationData, setGeolocationData] = useState<GeolocationData | null>(null);
    const [selectedServer, setSelectedServer] = useState<Server | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { clientLocation } = useClientGeolocation();

    const fetchGeolocationData = async (): Promise<void> => {
        try {
            setIsLoading(true);
            console.log('Fetching geolocation data...');
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
            console.log('Raw geolocation data:', data);

            // Initialize empty servers array if not present
            if (!data.servers) {
                console.warn('No servers array in response, initializing empty array');
                data.servers = [];
            }

            const serversArray = Array.isArray(data.servers) ? data.servers : [data.servers];
            console.log('Servers array:', serversArray);
            
            // Если есть данные о местоположении клиента, используем их для расчета расстояния
            if (clientLocation) {
                const serversWithDistance = serversArray.map((server: Server) => {
                    const distance = calculateDistance(
                        { lat: server.lat, lon: server.lon },
                        { lat: clientLocation.lat, lon: clientLocation.lon }
                    );
                    return { ...server, distance };
                });

                const sortedServers = serversWithDistance.sort((a: Server & { distance: number }, b: Server & { distance: number }) => 
                    (a.distance || 0) - (b.distance || 0)
                );
                console.log('Sorted servers:', sortedServers);

                setGeolocationData({
                    ...clientLocation,
                    servers: sortedServers
                });
            }
        } catch (error) {
            console.error('Error in geolocation API:', error);
            setGeolocationData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGeolocationData().catch(console.error);
    }, [clientLocation]);

    useEffect(() => {
        // Устанавливаем сервер по умолчанию, когда получаем данные о геолокации
        if (geolocationData && geolocationData.servers && geolocationData.servers.length > 0) {
            const defaultServer = geolocationData.servers[0];
            console.log('Setting default server:', defaultServer);
            setSelectedServer(defaultServer);
        }
    }, [geolocationData]);

    const setCurrentServer = (serverName: string) => {
        if (geolocationData && geolocationData.servers) {
            const server = geolocationData.servers.find(s => s.name === serverName);
            if (server) {
                setSelectedServer(server);
            }
        }
    };

    return (
        <ServerContext.Provider value={{ geolocationData, selectedServer, setCurrentServer, isLoading }}>
            {children}
        </ServerContext.Provider>
    );
};

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
