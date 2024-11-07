import React, { useState } from 'react';
import { UnstyledButton, Text, Anchor, Select } from '@mantine/core';
import { IconWorld } from '@tabler/icons-react';
import CustomModal from '@/components/modal/Modal';
import classes from '../SpeedTest.module.css';

interface Server {
    name: string;
    sponsor: string | string[];
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
}

const ServerService: React.FC<ServerServiceProps> = ({ currentServer, currentSponsor, geolocationData, setCurrentServer, setCurrentSponsor }) => {
    const [openModal, setOpenModal] = useState(false);

    const serverDisplayName = (server: Server) => {
        if (Array.isArray(server.sponsor)) {
            return server.sponsor.map((s: string) => `${server.name} - ${s}`).join(', ');
        }
        return `${server.name} - ${server.sponsor}`;
    };

    return (
        <UnstyledButton className={classes.item}>
            <IconWorld color="indigo" size="1.5rem" />
            <div className={classes.itemText}>
                <Anchor className={`${classes.iconTitle} ${classes.boldText}`} size="sm" mt={7} href="#" underline="hover">
                    {currentSponsor}
                </Anchor>
                <Text size="xs" mt={7}>
                    {currentServer}
                </Text>
                <Anchor size="xs" mt={7} href="#" underline="hover" onClick={() => setOpenModal(true)}>
                    Change
                </Anchor>
                {geolocationData && (
                    <CustomModal isOpen={openModal} onClose={() => setOpenModal(false)}>
                        <Select
                            label="Servers close to you:"
                            placeholder={serverDisplayName({ name: currentServer, sponsor: currentSponsor })}
                            value={serverDisplayName({ name: currentServer, sponsor: currentSponsor })}
                            data={geolocationData.servers.flatMap((server: Server) => {
                                if (Array.isArray(server.sponsor)) {
                                    return server.sponsor.map((s: string) => `${server.name} - ${s}`);
                                }
                                return `${server.name} - ${server.sponsor}`;
                            })}
                            searchable
                            className={classes.selectMargin}
                            onChange={(value: string | null) => {
                                if (value) {
                                    const selectedServer = geolocationData.servers.find((server: Server) => {
                                        if (Array.isArray(server.sponsor)) {
                                            return server.sponsor.some((s: string) => `${server.name} - ${s}` === value);
                                        }
                                        return `${server.name} - ${server.sponsor}` === value;
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
