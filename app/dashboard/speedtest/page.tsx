"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { Button, Card, Center, Grid, Group, SimpleGrid, Text } from '@mantine/core';
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
import { ServerProvider, useServer } from './contexts/ServerContext';
import { Server } from './types/geolocation';

interface GeoLocationServer {
    name: string;
    location: { city: string; region: string; country: string };
}

const SpeedTestContent: React.FC = () => {
    const { geolocationData, selectedServer } = useServer();
    const { uploadSpeed, downloadSpeed, pingStats, isTesting, generateAndMeasureSpeed } = useSpeedTest();
    const [loading, setLoading] = useState(true);
    const [selectedArrow, setSelectedArrow] = useState<'single' | 'multi'>('multi');
    const [filteredServers, setFilteredServers] = useState<Server[]>([]);

    useEffect(() => {
        if (geolocationData) {
            setLoading(false);
        }
    }, [geolocationData]);

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


    const testCLI = async () => {
        await fetch(`${process.env.NEXT_PUBLIC_API_SERVERS}/speedtest/cli`, { method: 'GET' }).then(response => response.json()).then(data => console.log(data)).catch(error => console.error(error));
    }

    return (
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
                                    setFilteredServers={setFilteredServers}
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
    );
};

const SpeedTest: React.FC = () => {
    return (
        <DashboardLayout>
            <ServerProvider>
                <SpeedTestContent />
            </ServerProvider>
        </DashboardLayout>
    );
};

export default SpeedTest;
