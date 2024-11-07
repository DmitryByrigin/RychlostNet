"use client"

import React, {useEffect, useState} from 'react';
import {Card, Grid, Group, SimpleGrid, Text} from '@mantine/core';
import {useFetchGeolocation} from './hooks/useFetchGeolocation';
import {useSpeedTest} from './hooks/useSpeedTest';
import {SpeedTestControls} from './components/SpeedTestControls';
import {SpeedTestResult} from './components/SpeedTestResult';
import OperatorService from './components/OperatorService';
import ServerService from './components/ServerService';
import ConnectionsService from './components/ConnectionsService';
import classes from './SpeedTest.module.css';
import {IconArrowsDiff, IconDownload, IconUpload} from "@tabler/icons-react";
import DashboardLayout from "@/app/dashboard/DashboardLayout";
import {useCurrentUser} from "@/hooks/use-current-user"; // Импортируем хук для проверки аутентификации

const SpeedTest: React.FC = () => {
    const {geolocationData, currentServer, currentSponsor, setCurrentServer, setCurrentSponsor} = useFetchGeolocation();
    const {uploadSpeed, downloadSpeed, pingStats, isTesting, generateAndMeasureSpeed} = useSpeedTest();
    const [selectedArrow, setSelectedArrow] = useState<'single' | 'multi'>('multi');
    const [loading, setLoading] = useState(true);
    const user = useCurrentUser(); // Получаем текущего пользователя

    useEffect(() => {
        if (geolocationData) {
            setLoading(false);
        }
    }, [geolocationData]);

    const networkStats = [
        {
            key: 'Ping',
            value: isTesting ? 'Measuring...' : (pingStats.avg !== null ? `${pingStats.avg.toFixed(2)} ms` : ''),
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

    const saveTestResult = async () => {
        if (!user) return; // Если пользователь не авторизован, не сохраняем результат

        const result = {
            timestamp: new Date().toISOString(),
            downloadSpeed,
            uploadSpeed,
            ping: pingStats.avg,
            location: currentServer,
            isp: currentSponsor,
        };

        // await fetch('/api/speedtest', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify(result),
        // });
    };

    useEffect(() => {
        if (!isTesting && downloadSpeed && uploadSpeed && pingStats.avg !== null) {
            saveTestResult();
        }
    }, [isTesting]);

    return (
        <DashboardLayout>
            <SimpleGrid cols={{base: 1, sm: 3}} spacing="md">
                <Group justify="center">
                    <Grid gutter="md">
                        <Grid.Col span={4}>
                            <SpeedTestControls
                                isTesting={isTesting}
                                onStartTest={() => generateAndMeasureSpeed()}
                            />
                        </Grid.Col>
                    </Grid>
                </Group>

                <Grid gutter="md">
                    <Grid.Col  span={{base: 12, sm: 6, md: 4, lg: 24}}>
                        <Card withBorder radius="md" className={classes.card}>
                            <Group justify="space-between">
                                <Text className={classes.title}>Services</Text>
                            </Group>
                            <SimpleGrid cols={1} mt="md">
                                {loading ? (
                                    <>
                                        <OperatorService
                                            ip="Loading..."
                                            org="Loading..."
                                            location="Loading..."
                                        />
                                        <ServerService
                                            currentServer="Loading..."
                                            currentSponsor="Loading..."
                                            geolocationData={null}
                                            setCurrentServer={() => {
                                            }}
                                            setCurrentSponsor={() => {
                                            }}
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

                    <Grid.Col span={{base: 12, sm: 6, md: 4, lg: 24}}>
                        <Card withBorder radius="md" className={classes.card}>
                            <Group justify="space-between" >
                                <Text className={classes.title}>Result</Text>
                            </Group>
                            <SpeedTestResult networkStats={networkStats}/>
                        </Card>
                    </Grid.Col>
                </Grid>
            </SimpleGrid>
        </DashboardLayout>
    );
};

export default SpeedTest;
