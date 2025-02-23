import React, { createContext, useContext, useState, useEffect } from 'react';
import { GeolocationData, Server } from '../types/geolocation';
import { useClientGeolocation } from '../hooks/useClientGeolocation';
import { GeolocationService } from '../services/geolocation.service';

interface ServerContextType {
    geolocationData: GeolocationData | null;
    selectedServer: Server | null;
    setCurrentServer: (serverName: string) => void;
    isLoading: boolean;
    error: string | null;
    refreshServers: () => Promise<void>;
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
    const [error, setError] = useState<string | null>(null);
    const { clientLocation } = useClientGeolocation();

    const fetchGeolocationData = async (): Promise<void> => {
        if (!clientLocation) {
            setError('Местоположение клиента недоступно');
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            
            // Получаем список серверов с расстояниями
            const serversWithDistance = await GeolocationService.getServersWithDistance(clientLocation);
            
            // Обновляем геолокационные данные
            setGeolocationData({
                ...clientLocation,
                servers: serversWithDistance
            });

            // Если еще нет выбранного сервера, выбираем ближайший
            if (!selectedServer && serversWithDistance.length > 0) {
                setSelectedServer(serversWithDistance[0]);
            }
        } catch (error) {
            console.error('Error fetching server data:', error);
            setError(error instanceof Error ? error.message : 'Ошибка при получении данных о серверах');
            setGeolocationData(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGeolocationData();
    }, [clientLocation]);

    const setCurrentServer = (serverName: string) => {
        if (geolocationData?.servers) {
            const server = geolocationData.servers.find(s => s.name === serverName);
            if (server) {
                setSelectedServer(server);
            }
        }
    };

    return (
        <ServerContext.Provider
            value={{
                geolocationData,
                selectedServer,
                setCurrentServer,
                isLoading,
                error,
                refreshServers: fetchGeolocationData
            }}
        >
            {children}
        </ServerContext.Provider>
    );
};
