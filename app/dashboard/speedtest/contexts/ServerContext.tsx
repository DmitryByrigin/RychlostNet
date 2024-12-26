import React, { createContext, useContext, useState, useEffect } from 'react';
import { GeolocationData, Server } from '../types/geolocation';

interface ServerContextType {
    geolocationData: GeolocationData | null;
    selectedServer: Server | null;
    setCurrentServer: (serverName: string) => void;
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

    const fetchGeolocationData = async (): Promise<void> => {
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
            const data: GeolocationData = await response.json();
            console.log('Fetched geolocation data:', data);

            const serversArray = Array.isArray(data.servers) ? data.servers : [data.servers];
            const sortedServers = serversArray.sort((a, b) => a.distance - b.distance);

            // Убедимся, что у каждого сервера есть правильный URL для тестирования
            const processedServers = sortedServers.map(server => ({
                ...server,
                url: server.url.includes('/speedtest/test') ? server.url : `${server.url}/speedtest/test`
            }));

            const newData = {
                ...data,
                servers: processedServers,
            };

            setGeolocationData(newData);
            console.log('Updated geolocation data:', newData);

            // Set initial server only if no server is currently selected
            if (!selectedServer) {
                const initialServer = processedServers[0];
                if (initialServer) {
                    console.log('Setting initial server:', initialServer);
                    setSelectedServer(initialServer);
                }
            }
        } catch (error) {
            console.error('Failed to fetch geolocation data', error);
            throw error;
        }
    };

    useEffect(() => {
        fetchGeolocationData().catch((error) => console.error('Error in useEffect:', error));
    }, []);

    useEffect(() => {
        if (selectedServer) {
            console.log('Selected server changed:', {
                name: selectedServer.name,
                url: selectedServer.url,
                sponsor: selectedServer.sponsor
            });
        }
    }, [selectedServer]);

    const setCurrentServer = (serverName: string) => {
        if (geolocationData) {
            const server = geolocationData.servers.find(s => s.name === serverName);
            console.log('Setting current server:', { 
                serverName, 
                foundServer: server ? {
                    name: server.name,
                    url: server.url,
                    sponsor: server.sponsor
                } : null,
                allServers: geolocationData.servers.map(s => ({
                    name: s.name,
                    url: s.url
                }))
            });
            if (server) {
                setSelectedServer(server);
            }
        }
    };

    return (
        <ServerContext.Provider value={{ geolocationData, selectedServer, setCurrentServer }}>
            {children}
        </ServerContext.Provider>
    );
};
