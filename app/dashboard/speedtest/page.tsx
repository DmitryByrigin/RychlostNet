"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { Button, Card, Center, Grid, Group, SimpleGrid, Text } from '@mantine/core';
import { IconArrowsDiff, IconClock, IconDownload, IconUpload, IconServer, IconWifi2 } from "@tabler/icons-react";
import { useFetchGeolocation } from './hooks/useFetchGeolocation';
import { useSpeedTest } from './hooks/useSpeedTest';   
import { SpeedTestControls } from './components/SpeedTestControls';
import { SpeedTestResult } from './components/SpeedTestResult';
import OperatorService from './components/OperatorService';
import ServerService from './components/ServerService';
import ConnectionsService from './components/ConnectionsService';
import classes from './SpeedTest.module.css';
import DashboardLayout from "@/app/dashboard/DashboardLayout";
import { ServerProvider, useServer } from './contexts/ServerContext';
import { Server } from './types/geolocation';

interface GeoLocationServer {
    name: string;
    location: { city: string; region: string; country: string };
}

const SpeedTestContent: React.FC = () => {
    const { geolocationData, selectedServer } = useServer();
    const { 
        uploadSpeed, 
        downloadSpeed, 
        pingStats, 
        isTesting, 
        generateAndMeasureSpeed, 
        calibrationFactors,
        libreSpeedMeasurement,
        libreSpeedServer
    } = useSpeedTest();
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
                
                {/* Информация о калибровке */}
                {calibrationFactors && (calibrationFactors.download !== 1.0 || calibrationFactors.upload !== 1.0) && (
                    <Center>
                        <Text size="xs" color="dimmed" mt="xs">
                            Результаты калиброваны с использованием LibreSpeed
                        </Text>
                    </Center>
                )}
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
                        {calibrationFactors && (calibrationFactors.download !== 1.0 || calibrationFactors.upload !== 1.0) && (
                            <Text size="xs" color="dimmed">
                                Calibrated with LibreSpeed
                            </Text>
                        )}
                    </Group>
                    <SpeedTestResult networkStats={networkStats} />
                </Card>
            </Grid.Col>

            <Grid.Col span={12}>
                {libreSpeedMeasurement && (
                    <Card withBorder radius="md" className={classes.card} mt="md">
                        <Group justify="space-between">
                            <Text className={classes.title}>Последнее измерение LibreSpeed</Text>
                        </Group>
                        <SimpleGrid cols={{ base: 3, md: 3 }} spacing="xs" mt="md">
                            <div>
                                <Group>
                                    <IconDownload className={classes.icon} />
                                    <Text size="sm" fw={500}>Download</Text>
                                </Group>
                                <Text size="md" fw={700} className={classes.value}>
                                    {libreSpeedMeasurement.downloadSpeed}
                                </Text>
                            </div>
                            <div>
                                <Group>
                                    <IconUpload className={classes.icon} />
                                    <Text size="sm" fw={500}>Upload</Text>
                                </Group>
                                <Text size="md" fw={700} className={classes.value}>
                                    {libreSpeedMeasurement.uploadSpeed}
                                </Text>
                            </div>
                            <div>
                                <Group>
                                    <IconArrowsDiff className={classes.icon} />
                                    <Text size="sm" fw={500}>Ping</Text>
                                </Group>
                                <Text size="md" fw={700} className={classes.value}>
                                    {libreSpeedMeasurement.ping}
                                </Text>
                            </div>
                        </SimpleGrid>
                        <Text size="xs" color="dimmed" mt="xs" ta="center">
                            Измерено: {new Date(libreSpeedMeasurement.measuredAt).toLocaleString()}
                        </Text>
                        {libreSpeedServer && (
                            <Text size="xs" color="dimmed" mt="xs" ta="center">
                                Сервер: {libreSpeedServer.name} | Локация: {libreSpeedServer.location} | Провайдер: {libreSpeedServer.provider}
                            </Text>
                        )}
                    </Card>
                )}
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
