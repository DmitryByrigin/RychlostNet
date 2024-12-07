// ServerService.tsx
import React, { useState, useEffect } from 'react';
import { Anchor, Select, Text, UnstyledButton } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';
import CustomModal from '@/components/modal/Modal';
import classes from '../SpeedTest.module.css';

interface Server {
    name: string;
    sponsor: string | string[];
    url: string;
}

interface GeolocationData {
    servers: Server[];
}

interface ServerServiceProps {
    currentServer: string;
    currentSponsor: string;
    geolocationData: GeolocationData | null;
    setCurrentServer: (server: string) => void;
    setCurrentSponsor: (sponsor: string) => void;
    setFilteredServers: (servers: Server[]) => void; // Add this prop
}

const ServerService: React.FC<ServerServiceProps> = ({
    currentServer,
    currentSponsor,
    geolocationData,
    setCurrentServer,
    setCurrentSponsor,
    setFilteredServers // Add this prop
}) => {
    const [openModal, setOpenModal] = useState(false);
    const [localFilteredServers, setLocalFilteredServers] = useState<Server[]>([]);

    useEffect(() => {
        const checkServerAvailability = async (server: Server) => {
            try {
                const response = await fetch(`${server.url}/speedtest/server-info`, { method: 'HEAD', timeout: 5000 });
                return response.ok;
            } catch (error) {
                console.log(`Error checking server ${server.url}: ${error.message}`);
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
                const filtered = availableServers.filter((server) => server !== null) as Server[];
                setLocalFilteredServers(filtered);
                setFilteredServers(filtered); // Update parent state
            }
        };

        filterServers();
    }, [geolocationData, setFilteredServers]);

    const serverDisplayName = (server: Server) => {
        if (Array.isArray(server.sponsor)) {
            return server.sponsor.map((s: string) => `${server.name} - ${s}`).join(', ');
        }
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
                            placeholder={serverDisplayName({ name: currentServer, sponsor: currentSponsor })}
                            value={serverDisplayName({ name: currentServer, sponsor: currentSponsor })}
                            data={localFilteredServers.flatMap((server: Server) => {
                                if (Array.isArray(server.sponsor)) {
                                    return server.sponsor.map((s: string) => ({
                                        value: `${server.name} - ${s}`,
                                        label: `${server.name} - ${s}`
                                    }));
                                }
                                return {
                                    value: `${server.name} - ${server.sponsor}`,
                                    label: `${server.name} - ${server.sponsor}`
                                };
                            })}
                            searchable
                            className={classes.selectMargin}
                            onChange={(value: string | null) => {
                                if (value) {
                                    const selectedServer = localFilteredServers.find((server: Server) => {
                                        const fullName = `${server.name} - ${server.sponsor}`;
                                        return fullName === value;
                                    });
                                    if (selectedServer) {
                                        const [, selectedSponsor] = value.split(' - ');
                                        setCurrentServer(selectedServer.name);
                                        setCurrentSponsor(selectedSponsor);
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
