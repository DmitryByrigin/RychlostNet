"use client"

import React, { useEffect, useState, useCallback } from 'react';
import { Button, Card, Center, Grid, Group, SimpleGrid, Text } from '@mantine/core';
import { IconArrowsDiff, IconClock, IconDownload, IconUpload, IconServer, IconWifi2 } from "@tabler/icons-react";
import { useServer, ServerProvider } from './contexts/ServerContext';
import { useSpeedTest } from './hooks/useSpeedTest';
import { useLibreSpeedTest } from './hooks/useLibreSpeedTest';
import { SpeedTestControls } from './components/SpeedTestControls';
import { SpeedTestResult } from './components/SpeedTestResult';
import classes from './SpeedTest.module.css';
import OperatorService from './components/OperatorService';
import ServerService from './components/ServerService';
import ConnectionsService from './components/ConnectionsService';
import { Server } from './types/geolocation';

const SpeedTestContent: React.FC = () => {
    const { geolocationData, selectedServer } = useServer();
    const { 
        uploadSpeed, 
        downloadSpeed, 
        pingStats, 
        isTesting: isOriginalTesting, 
        progress: originalProgress,
        generateAndMeasureSpeed, 
        libreSpeedResult: originalLibreSpeedResult,
        servers,
        selectedServer: testServer,
        setSelectedServer
    } = useSpeedTest();
    
    // Добавляем хук LibreSpeed
    const { 
        uploadSpeed: libreUploadSpeed, 
        downloadSpeed: libreDownloadSpeed, 
        pingStats: librePingStats, 
        isTesting: isLibreTesting, 
        progress: libreProgress,
        runSpeedTest: runLibreSpeedTest,
        libreSpeedResult,
    } = useLibreSpeedTest();
    
    const [loading, setLoading] = useState(true);
    const [selectedArrow, setSelectedArrow] = useState<'single' | 'multi'>('multi');
    const [filteredServers, setFilteredServers] = useState<Server[]>([]);
    
    // Объединенное состояние тестирования
    const isTesting = isOriginalTesting || isLibreTesting;
    
    // Объединенный прогресс (в среднем между двумя тестами)
    const progress = (originalProgress + libreProgress) / 2;
    
    // Скорректированные результаты
    const [correctedResults, setCorrectedResults] = useState({
        download: downloadSpeed,
        upload: uploadSpeed,
        ping: pingStats
    });

    useEffect(() => {
        if (geolocationData) {
            setLoading(false);
        }
    }, [geolocationData]);
    
    // Корректировка результатов на основе LibreSpeed
    useEffect(() => {
        if (libreSpeedResult && downloadSpeed && uploadSpeed && pingStats.avg > 0) {
            // Извлекаем числовые значения из строк с "Mbps"
            const extractNumber = (str: string) => {
                const match = str.match(/^([\d.]+)/);
                return match ? parseFloat(match[1]) : 0;
            };
            
            const originalDownload = extractNumber(downloadSpeed);
            const originalUpload = extractNumber(uploadSpeed);
            
            const libreDownload = libreSpeedResult.download;
            const libreUpload = libreSpeedResult.upload;
            
            // Получаем пинг из LibreSpeed (учитываем, что это может быть объект или число)
            const librePing = typeof libreSpeedResult.ping === 'object' 
                ? libreSpeedResult.ping.avg 
                : libreSpeedResult.ping;
            
            // Калибровочные факторы
            const downloadFactor = 1.15;
            const uploadFactor = 1.08;
            const pingFactor = 0.95;
            
            // Рассчитываем корректированные значения
            const correctedDownload = originalDownload * (1 + ((libreDownload / originalDownload - 1) * downloadFactor));
            const correctedUpload = originalUpload * (1 + ((libreUpload / originalUpload - 1) * uploadFactor));
            const correctedPingValue = pingStats.avg * (1 + ((librePing / pingStats.avg - 1) * pingFactor));
            
            setCorrectedResults({
                download: `${correctedDownload.toFixed(2)} Mbps`,
                upload: `${correctedUpload.toFixed(2)} Mbps`,
                ping: {
                    min: pingStats.min,
                    max: pingStats.max,
                    avg: correctedPingValue,
                    jitter: pingStats.jitter
                }
            });
        }
    }, [libreSpeedResult, downloadSpeed, uploadSpeed, pingStats]);

    // Запускаем оба теста последовательно
    const runBothTests = async () => {
        try {
            // Сначала запускаем LibreSpeed тест с помощью Promise
            const libreTestPromise = runLibreSpeedTest();
            
            // Затем запускаем основной тест, но только после завершения первого
            // Используем setTimeout для небольшой задержки между тестами
            await libreTestPromise;
            
            // Небольшая задержка для стабилизации
            setTimeout(() => {
                generateAndMeasureSpeed();
            }, 1000);
        } catch (error) {
            console.error('Error running tests:', error);
        }
    };

    const networkStats = [
        {
            key: 'Ping',
            value: isTesting
                ? 'Measuring...'
                : (typeof libreSpeedResult?.ping?.avg === 'number' && libreSpeedResult.ping.avg > 0 
                   ? `${libreSpeedResult.ping.avg.toFixed(2)} ms` 
                   : ''),
            icon: IconArrowsDiff,
        },
        {
            key: 'Download',
            value: isTesting ? 'Measuring...' : (libreSpeedResult?.download ? `${libreSpeedResult.download.toFixed(2)} Mbps` : ''),
            icon: IconDownload,
        },
        {
            key: 'Upload',
            value: isTesting ? 'Measuring...' : (libreSpeedResult?.upload ? `${libreSpeedResult.upload.toFixed(2)} Mbps` : ''),
            icon: IconUpload,
        },
    ];

    // Массив статистики для собственного теста скорости
// Массив статистики для собственного теста скорости
const customSpeedStats = [
    {
        key: 'Ping',
        value: isTesting
            ? 'Measuring...'
            : (typeof pingStats?.avg === 'number' && pingStats.avg > 0 
               ? `${pingStats.avg.toFixed(2)} ms` 
               : ''),
        icon: IconArrowsDiff,
    },
    {
        key: 'Download',
        value: isTesting 
            ? 'Measuring...' 
            : (downloadSpeed ? `${parseFloat(downloadSpeed).toFixed(2)} Mbps` : ''),
        icon: IconDownload,
    },
    {
        key: 'Upload',
        value: isTesting 
            ? 'Measuring...' 
            : (uploadSpeed ? `${parseFloat(uploadSpeed).toFixed(2)} Mbps` : ''),
        icon: IconUpload,
    },
];

    return (
        <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Center>
                    <SpeedTestControls
                        isTesting={isTesting}
                        onStartTest={runBothTests}
                        hasAvailableServers={filteredServers.length > 0}
                    />
                </Center>
                
                {/* Информация о калибровке */}
                {libreSpeedResult && (
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
                                <OperatorService
                                    ip={geolocationData?.ip || ""}
                                    org={geolocationData?.org || "Unknown ISP"}
                                    location={`${geolocationData?.city || ""}, ${geolocationData?.country || ""}`}
                                />
                                <ServerService
                                    setFilteredServers={setFilteredServers}
                                />
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
                        <div>
                        <Text size="sm" c="dimmed">LibreSpeed Test Results</Text>
                        {libreSpeedResult && libreSpeedResult.server && (
                            <Text size="sm" mt={5} fw={500}>
                            </Text>
                        )}
                        {!libreSpeedResult && selectedServer && (
                            <Text size="sm" mt={5} fw={500}>
                                Сервер: {selectedServer.name} 
                                {selectedServer.location?.city && `, ${selectedServer.location.city}`}
                                {selectedServer.location?.country && `, ${selectedServer.location.country}`}
                            </Text>
                        )}
                        </div>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="md">
                        {networkStats.map((stat) => (
                            <Group key={stat.key} className={classes.stat}>
                                <div className={classes.statIcon} style={{ 
                                    backgroundColor: 
                                        stat.key === 'Ping' ? '#FF9C00' : 
                                        stat.key === 'Download' ? '#2EA12E' : '#1F66E5' 
                                }}>
                                    <stat.icon size={24} className={classes.statIconSvg} stroke={1.5} />
                                </div>
                                <div>
                                    <Text className={classes.statName}>{stat.key}</Text>
                                    <Text className={classes.statValue} style={{ 
                                        color: 
                                            stat.key === 'Ping' ? '#FF9C00' : 
                                            stat.key === 'Download' ? '#2EA12E' : '#1F66E5',
                                        fontSize: '1.5rem',
                                        fontWeight: 700
                                    }}>{stat.value}</Text>
                                </div>
                            </Group>
                        ))}
                    </SimpleGrid>
                    
                    {libreSpeedResult && libreSpeedResult.server && (
                        <Text size="xs" mt="md" c="dimmed">
                            Тест выполнен с использованием внешнего сервера LibreSpeed
                        </Text>
                    )}
                </Card>
            </Grid.Col>

            <Grid.Col span={12}>
                <Card withBorder radius="md" className={classes.card}>
                    <Group justify="space-between">
                        <div>
                            <Text className={classes.title} mt="md">
                                Speed Test Results
                            </Text>
                        </div>
                    </Group>

                    <SpeedTestResult networkStats={customSpeedStats} />

                </Card>
            </Grid.Col>
        </Grid>
    );
};

const SpeedTest: React.FC = () => {
    return (
        <ServerProvider>
            <SpeedTestContent />
        </ServerProvider>
    );
};

export default SpeedTest;