import React, { useEffect, useState } from 'react';
import { ActionIcon, Button, Center, Loader, ScrollArea, Table, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconSortAscending, IconSortDescending, IconTrash, IconHistory } from '@tabler/icons-react';
import classes from '../SpeedTestHistory.module.css';

interface SpeedTestHistoryType {
    id: string;
    timestamp: Date;
    downloadSpeed: number;
    uploadSpeed: number;
    ping: number;
    jitter: number;
    userLocation: string | null;
    isp: string | null;
    serverName: string | null;
    serverLocation: string | null;
    userId: string | null;
}

const SpeedTestHistoryComponent: React.FC = () => {
    const [data, setData] = useState<SpeedTestHistoryType[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [sortColumn, setSortColumn] = useState<keyof SpeedTestHistoryType | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/speedtest');
                
                if (!response.ok) {
                    if (response.status === 401) {
                        setError('Please log in to view your test history');
                    } else {
                        throw new Error('Failed to fetch history');
                    }
                    return;
                }

                const data = await response.json();
                const formattedData = data.map((item: SpeedTestHistoryType) => ({
                    ...item,
                    timestamp: new Date(item.timestamp)
                }));
                console.log('History data:', formattedData);
                setData(formattedData);
            } catch (error) {
                console.error('Error fetching history:', error);
                setError(error instanceof Error ? error.message : 'Failed to load history');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const handleSort = (column: keyof SpeedTestHistoryType) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/speedtest/${id}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error('Failed to delete test');
            }
            setData(data.filter(test => test.id !== id));
        } catch (error) {
            console.error('Error deleting test:', error);
        }
    };

    const handleDeleteAll = async () => {
        try {
            const response = await fetch('/api/speedtest', {
                method: "DELETE",
            });
            if (!response.ok) {
                throw new Error('Failed to delete all tests');
            }
            setData([]);
        } catch (error) {
            console.error('Error deleting all tests:', error);
        }
    };

    const formatSpeed = (speed: number) => `${speed.toFixed(2)} Mbps`;
    const formatPing = (ping: number) => `${ping.toFixed(2)} ms`;
    const formatDate = (date: Date) => date.toLocaleString();

    if (loading) {
        return (
            <Center style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
                <Loader color="indigo" />
            </Center>
        );
    }

    if (error) {
        return (
            <Center style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
                <Stack align="center">
                    <ThemeIcon size={48} radius="xl" color="gray.3">
                        <IconHistory size={24} stroke={1.5} />
                    </ThemeIcon>
                    <Text size="lg" style={{ fontWeight: "bold" }}>
                        Error Loading History
                    </Text>
                    <Text size="sm" style={{ textAlign: "center" }}>
                        {error}
                    </Text>
                </Stack>
            </Center>
        );
    }

    if (data.length === 0) {
        return (
            <Center style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
                <Stack align="center">
                    <ThemeIcon size={48} radius="xl" color="gray.3">
                        <IconHistory size={24} stroke={1.5} />
                    </ThemeIcon>
                    <Text size="lg" style={{ fontWeight: "bold" }}>
                        No Test History
                    </Text>
                    <Text size="sm" style={{ textAlign: "center" }}>
                        Your speed test history will appear here after you complete your first test.
                    </Text>
                </Stack>
            </Center>
        );
    }

    const sortedData = [...data].sort((a, b) => {
        if (!sortColumn) return 0;

        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (aValue === null || bValue === null) return 0;

        if (sortColumn === 'timestamp') {
            return sortDirection === 'asc'
                ? a.timestamp.getTime() - b.timestamp.getTime()
                : b.timestamp.getTime() - a.timestamp.getTime();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <>
            {data.length > 1 && (
                <Button color="red" onClick={handleDeleteAll} mb="md">
                    Delete All
                </Button>
            )}
            <ScrollArea>
                <Table>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th onClick={() => handleSort('timestamp')} className={classes.sortableHeader}>
                                Timestamp {sortColumn === 'timestamp' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th onClick={() => handleSort('downloadSpeed')} className={classes.sortableHeader}>
                                Download Speed (Mbps) {sortColumn === 'downloadSpeed' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th onClick={() => handleSort('uploadSpeed')} className={classes.sortableHeader}>
                                Upload Speed (Mbps) {sortColumn === 'uploadSpeed' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th onClick={() => handleSort('ping')} className={classes.sortableHeader}>
                                Ping (ms) {sortColumn === 'ping' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th onClick={() => handleSort('userLocation')} className={classes.sortableHeader}>
                                User Location {sortColumn === 'userLocation' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th onClick={() => handleSort('serverName')} className={classes.sortableHeader}>
                                Server Name {sortColumn === 'serverName' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th onClick={() => handleSort('serverLocation')} className={classes.sortableHeader}>
                                Server Location {sortColumn === 'serverLocation' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th onClick={() => handleSort('isp')} className={classes.sortableHeader}>
                                ISP {sortColumn === 'isp' && (sortDirection === 'asc' ?
                                <IconSortAscending size={16} /> : <IconSortDescending size={16} />)}
                            </Table.Th>
                            <Table.Th>
                                <Center>Actions</Center>
                            </Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {sortedData.map((test) => (
                            <Table.Tr key={test.id}>
                                <Table.Td>{formatDate(test.timestamp)}</Table.Td>
                                <Table.Td>{formatSpeed(test.downloadSpeed)}</Table.Td>
                                <Table.Td>{formatSpeed(test.uploadSpeed)}</Table.Td>
                                <Table.Td>{formatPing(test.ping)}</Table.Td>
                                <Table.Td>{test.userLocation || 'Unknown'}</Table.Td>
                                <Table.Td>{test.serverName || 'Unknown'}</Table.Td>
                                <Table.Td>{test.serverLocation || 'Unknown'}</Table.Td>
                                <Table.Td>{test.isp || 'Unknown'}</Table.Td>
                                <Table.Td>
                                    <Center>
                                        <ActionIcon color="red" onClick={() => handleDelete(test.id)}>
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Center>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </ScrollArea>
        </>
    );
};

export default SpeedTestHistoryComponent;
