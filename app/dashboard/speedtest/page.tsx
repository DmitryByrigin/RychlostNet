"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { Card, Center, Grid, Group, SimpleGrid, Text } from '@mantine/core';
import { useFetchGeolocation } from './hooks/useFetchGeolocation';
import { useSpeedTest } from './hooks/useSpeedTest';
import { SpeedTestControls } from './components/SpeedTestControls';
import { SpeedTestResult } from './components/SpeedTestResult';
import OperatorService from './components/OperatorService';
import ServerService from './components/ServerService';
import ConnectionsService from './components/ConnectionsService';
import classes from './SpeedTest.module.css';
import { IconArrowsDiff, IconDownload, IconUpload } from "@tabler/icons-react";
import DashboardLayout from "@/app/dashboard/DashboardLayout";
import { useCurrentUser } from "@/hooks/use-current-user";

interface GeoLocationServer {
    name: string;
    location: { city: string; region: string; country: string };
}

const SpeedTest: React.FC = () => {
    const { geolocationData, currentServer, setCurrentServer, currentSponsor, setCurrentSponsor } = useFetchGeolocation();
    const { uploadSpeed, downloadSpeed, pingStats, isTesting, generateAndMeasureSpeed } = useSpeedTest();
    const [loading, setLoading] = useState(true);
    const user = useCurrentUser();
    const [selectedArrow, setSelectedArrow] = useState<'single' | 'multi'>('multi');
    const [filteredServers, setFilteredServers] = useState<GeoLocationServer[]>([]);

    useEffect(() => {
        if (geolocationData) {
            setLoading(false);
        }
    }, [geolocationData]);

    useEffect(() => {
        console.log('Current server:', currentServer);
    }, [currentServer]);

    const networkStats = [
        {
            key: 'Ping',
            value: isTesting
                ? 'Measuring...'
                : (typeof pingStats?.avg === 'number' && pingStats.avg > 0 ? `${pingStats.avg.toFixed(2)} ms` : ''),
            icon: IconArrowsDiff,
        },
        {
            key: 'Download',
            value: isTesting ? 'Measuring...' : downloadSpeed,
            icon: IconDownload,
        },
        {
            key: 'Upload',
            value: isTesting ? 'Measuring...' : uploadSpeed,
            icon: IconUpload,
        },
    ];

    // Memoizing saveTestResult to avoid unnecessary re-renders
    const saveTestResult = useCallback(async () => {
        if (!user || !geolocationData || !geolocationData.servers.length) return;

        const currentServerInfo = geolocationData.servers.find(server => server.name === currentServer);

        if (!currentServerInfo) {
            console.log("Server not found");
            return;
        }

        const result = {
            timestamp: new Date().toISOString(),
            downloadSpeed: parseFloat(downloadSpeed),
            uploadSpeed: parseFloat(uploadSpeed),
            ping: pingStats?.avg ?? null,
            userLocation: `${geolocationData.city}, ${geolocationData.region}, ${geolocationData.country}`,
            isp: currentSponsor,
            userId: user.id,
            serverName: currentServerInfo.name,
            serverLocation: `${currentServerInfo.location.city}, ${currentServerInfo.location.region}, ${currentServerInfo.location.country}`,
        };

        console.log('Test result to be saved:', result);

        await fetch('/api/speedtest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(result),
        });
    }, [user, geolocationData, currentServer, downloadSpeed, uploadSpeed, pingStats, currentSponsor]);

    useEffect(() => {
        if (!isTesting && downloadSpeed && uploadSpeed && pingStats?.avg !== null) {
            saveTestResult().catch(console.error);
        }
    }, [isTesting, downloadSpeed, uploadSpeed, pingStats, saveTestResult]);

    return (
        <DashboardLayout>
            <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Center>
                        <SpeedTestControls
                            isTesting={isTesting}
                            onStartTest={() => generateAndMeasureSpeed()}
                            hasAvailableServers={filteredServers.length > 0}
                        />
                    </Center>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                    <Card withBorder radius="md" className={classes.card}>
                        <Group justify="space-between">
                            <Text className={classes.title}>Services</Text>
                        </Group>
                        <SimpleGrid cols={1} mt="md">
                            {loading ? (
                                <>
                                    <OperatorService
                                        ip=""
                                        org="Loading..."
                                        location=""
                                    />
                                    <ServerService
                                        currentServer="Loading..."
                                        currentSponsor="Loading..."
                                        geolocationData={null}
                                        setCurrentServer={() => {}}
                                        setCurrentSponsor={() => {}}
                                        setFilteredServers={() => {}}
                                    />
                                    <ConnectionsService
                                        selectedArrow={selectedArrow}
                                        setSelectedArrow={setSelectedArrow}
                                    />
                                </>
                            ) : (
                                <>
                                    {geolocationData && (
                                        <>
                                            <OperatorService
                                                ip={geolocationData.ip}
                                                org={geolocationData.org}
                                                location={`${geolocationData.city}, ${geolocationData.region}, ${geolocationData.country}`}
                                            />
                                            <ServerService
                                                currentServer={currentServer}
                                                currentSponsor={currentSponsor}
                                                geolocationData={geolocationData}
                                                setCurrentServer={setCurrentServer}
                                                setCurrentSponsor={setCurrentSponsor}
                                                setFilteredServers={setFilteredServers}
                                            />
                                        </>
                                    )}
                                    <ConnectionsService
                                        selectedArrow={selectedArrow}
                                        setSelectedArrow={setSelectedArrow}
                                    />
                                </>
                            )}
                        </SimpleGrid>
                    </Card>
                </Grid.Col>

                <Grid.Col span={12}>
                    <Card withBorder radius="md" className={classes.card}>
                        <Group justify="space-between">
                            <Text className={classes.title}>Result</Text>
                        </Group>
                        <SpeedTestResult networkStats={networkStats} />
                    </Card>
                </Grid.Col>
            </Grid>
        </DashboardLayout>
    );
};

export default SpeedTest;
