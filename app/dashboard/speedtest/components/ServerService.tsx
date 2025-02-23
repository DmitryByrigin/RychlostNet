import React, { useState, useEffect } from 'react';
import { Anchor, Select, Text, UnstyledButton } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';
import CustomModal from '@/components/modal/Modal';
import classes from '../SpeedTest.module.css';
import { Server } from '../types/geolocation';
import { useServer } from '../contexts/ServerContext';

interface ServerServiceProps {
    setFilteredServers: React.Dispatch<React.SetStateAction<Server[]>>;
}

const ServerService: React.FC<ServerServiceProps> = ({
    setFilteredServers,
}) => {
    const { setCurrentServer, selectedServer, geolocationData } = useServer();
    const [openModal, setOpenModal] = useState(false);
    const [localFilteredServers, setLocalFilteredServers] = useState<Server[]>([]);

    useEffect(() => {
        if (geolocationData?.servers) {
            const servers = Array.isArray(geolocationData.servers)
                ? geolocationData.servers
                : [geolocationData.servers];

            setLocalFilteredServers(servers);
            setFilteredServers(servers);
        }
    }, [geolocationData, setFilteredServers]);

    const serverDisplayName = (server: Server) => {
        const name = server.name;
        const sponsor = Array.isArray(server.sponsor) ? server.sponsor.join(', ') : server.sponsor;
        return `${name} - ${sponsor}`;
    };

    const handleServerChange = (value: string | null) => {
        console.log('handleServerChange called with value:', value);

        if (!value || !localFilteredServers.length) {
            console.log('No value or no servers available');
            return;
        }

        // Находим сервер по полному значению (имя + спонсор)
        const selectedServer = localFilteredServers.find(server => serverDisplayName(server) === value);

        console.log('Found server:', selectedServer);

        if (selectedServer) {
            console.log('Setting current server:', selectedServer.name);
            setCurrentServer(selectedServer.name);
            setOpenModal(false);
        }
    };

    const serverOptions = localFilteredServers.map((server) => ({
        value: serverDisplayName(server),
        label: serverDisplayName(server),
    }));

    // console.log('Current state:', {
    //     selectedServer,
    //     localFilteredServers,
    //     serverOptions,
    //     currentValue: selectedServer ? serverDisplayName(selectedServer) : null
    // });

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
                            {selectedServer?.sponsor || 'Select Server'}
                        </Anchor>
                        <Text size="xs" mt={7}>
                            {selectedServer?.name || ''}
                        </Text>
                        <Anchor size="xs" mt={7} href="#" underline="hover" onClick={(e) => {
                            e.preventDefault();
                            setOpenModal(true);
                        }}>
                            Change
                        </Anchor>
                    </>
                )}
                {geolocationData && localFilteredServers.length > 0 && (
                    <CustomModal 
                        isOpen={openModal} 
                        onClose={() => setOpenModal(false)}
                        title="Select Test Server"
                    >
                        <Select
                            label="Servers close to you:"
                            placeholder="Choose a server"
                            value={selectedServer ? serverDisplayName(selectedServer) : null}
                            data={serverOptions}
                            searchable
                            className={classes.selectMargin}
                            onChange={handleServerChange}
                        />
                        {selectedServer && (
                            <>
                                <Text size="sm" mt="md">
                                    Location: {selectedServer.location.city}, {selectedServer.location.region}, {selectedServer.location.country}
                                </Text>
                                {/*<Text size="sm">*/}
                                {/*    Distance: {selectedServer.distance.toFixed(2)} km*/}
                                {/*</Text>*/}
                                {/*<Text size="sm">*/}
                                {/*    Host: {selectedServer.host}*/}
                                {/*</Text>*/}
                            </>
                        )}
                    </CustomModal>
                )}
            </div>
        </UnstyledButton>
    );
};

export default ServerService;
