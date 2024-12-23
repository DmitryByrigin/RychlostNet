import React, { useState, useEffect } from 'react';
import { Anchor, Select, Text, UnstyledButton } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';
import CustomModal from '@/components/modal/Modal';
import classes from '../SpeedTest.module.css';
import { GeolocationData } from '../types/geolocation';

interface Server {
    name: string;
    sponsor: string | string[];
    url: string;
}

interface GeoLocationServer {
    name: string;
    location: { city: string; region: string; country: string };
    sponsor: string | string[];  // Спонсор добавлен в GeoLocationServer
}

interface ServerServiceProps {
    currentServer: string;
    currentSponsor: string;
    geolocationData: GeolocationData | null;
    setCurrentServer: (server: string) => void;
    setCurrentSponsor: (sponsor: string) => void;
    setFilteredServers: (servers: GeoLocationServer[]) => void;
}

const ServerService: React.FC<ServerServiceProps> = ({
                                                         currentServer,
                                                         currentSponsor,
                                                         geolocationData,
                                                         setCurrentServer,
                                                         setCurrentSponsor,
                                                         setFilteredServers,
                                                     }) => {
    const [openModal, setOpenModal] = useState(false);
    const [localFilteredServers, setLocalFilteredServers] = useState<GeoLocationServer[]>([]);

    useEffect(() => {
        const checkServerAvailability = async (server: Server) => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // Таймаут 5 секунд

                const response = await fetch(`${server.url}/speedtest/server-info`, {
                    method: 'HEAD',
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                return response.ok;
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.log(`Error checking server ${server.url}: ${error.message}`);
                }
                return false;
            }
        };

        const filterServers = async () => {
            if (geolocationData) {
                const availableServers = await Promise.all(
                    geolocationData.servers.map(async (server) => {
                        const isAvailable = await checkServerAvailability(server);
                        return isAvailable ? server : null;
                    })
                );

                // Убираем серверы, которые недоступны
                const filteredServers = availableServers.filter((server) => server !== null) as Server[];

                // Маппируем Server в GeoLocationServer, добавляем location и sponsor
                const geoLocationServers: GeoLocationServer[] = filteredServers.map((server) => ({
                    name: server.name,
                    location: { city: '', region: '', country: '' }, // Используйте данные из geolocationData, если они есть
                    sponsor: server.sponsor,
                }));

                setLocalFilteredServers(geoLocationServers);
                setFilteredServers(geoLocationServers); // Обновляем родительский стейт
            }
        };

        filterServers();
    }, [geolocationData, setFilteredServers]);

    const serverDisplayName = (server: GeoLocationServer) => {
        return `${server.name} - ${server.sponsor}`;
    };

    return (
        <UnstyledButton className={classes.item} disabled={localFilteredServers.length === 0}>
            <IconWorld color="indigo" size="1.5rem" />
            <div className={classes.itemText}>
                {localFilteredServers.length === 0 ? (
                    <Text className={`${classes.iconTitle} ${classes.boldText}`} size="sm">
                        No available servers
                    </Text>
                ) : (
                    <>
                        <Anchor className={`${classes.iconTitle} ${classes.boldText}`} size="sm" mt={7} href="#" underline="hover">
                            {currentSponsor}
                        </Anchor>
                        <Text size="xs" mt={7}>
                            {currentServer}
                        </Text>
                        <Anchor size="xs" mt={7} href="#" underline="hover" onClick={() => setOpenModal(true)}>
                            Change
                        </Anchor>
                    </>
                )}
                {geolocationData && localFilteredServers.length > 0 && (
                    <CustomModal isOpen={openModal} onClose={() => setOpenModal(false)}>
                        <Select
                            label="Servers close to you:"
                            placeholder={serverDisplayName({ name: currentServer, location: { city: '', region: '', country: '' }, sponsor: currentSponsor })}
                            value={serverDisplayName({ name: currentServer, location: { city: '', region: '', country: '' }, sponsor: currentSponsor })}
                            data={localFilteredServers.map((server) => ({
                                value: serverDisplayName(server),
                                label: serverDisplayName(server),
                            }))}
                            searchable
                            className={classes.selectMargin}
                            onChange={(value: string | null) => {
                                if (value) {
                                    const selectedServer = localFilteredServers.find((server) => serverDisplayName(server) === value);
                                    if (selectedServer) {
                                        setCurrentServer(selectedServer.name);
                                        setCurrentSponsor(Array.isArray(selectedServer.sponsor) ? selectedServer.sponsor.join(', ') : selectedServer.sponsor);
                                    }
                                }
                                setOpenModal(false);
                            }}
                        />
                    </CustomModal>
                )}
            </div>
        </UnstyledButton>
    );
};

export default ServerService;
