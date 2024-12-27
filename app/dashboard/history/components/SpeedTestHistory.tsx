import React, { useEffect, useState } from 'react';
import { ActionIcon, Button, Center, Loader, ScrollArea, Table, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconSortAscending, IconSortDescending, IconTrash, IconHistory } from '@tabler/icons-react';
import classes from '../SpeedTestHistory.module.css';
import { SpeedTestHistory as SpeedTestHistoryType } from '@prisma/client';

const SpeedTestHistoryComponent: React.FC = () => {
    const [data, setData] = useState<SpeedTestHistoryType[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        fetch('/api/speedtest')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then((data) => {
                console.log('API response:', data);
                setData(data);
                setLoading(false);
            })
            .catch((error: unknown) => {
                if (error instanceof Error) {
                    setError(error.message);
                } else {
                    setError('An unknown error occurred');
                }
                setLoading(false);
            });
    }, []);

    const handleSort = (column: string) => {
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

    const sortedData = [...data].sort((a, b) => {
        if (!sortColumn) return 0;

        const aValue = a[sortColumn as keyof SpeedTestHistoryType];
        const bValue = b[sortColumn as keyof SpeedTestHistoryType];

        if (aValue === null || bValue === null) return 0;

        if (sortColumn === 'timestamp') {
            return sortDirection === 'asc'
                ? new Date(aValue as string).getTime() - new Date(bValue as string).getTime()
                : new Date(bValue as string).getTime() - new Date(aValue as string).getTime();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

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
                <Text color="red">{error}</Text>
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
                    <Text size="lg" style={{  fontWeight: "bold" }}>
                        No Test History
                    </Text>
                    <Text size="sm" style={{  textAlign: "center" }}>
                        Your speed test history will appear here after you complete your first test.
                    </Text>
                </Stack>
            </Center>
        );
    }

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
                            <Table.Th onClick={() => handleSort('location')} className={classes.sortableHeader}>
                                User Location {sortColumn === 'location' && (sortDirection === 'asc' ?
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
                        {sortedData.map((stat) => (
                            <Table.Tr key={stat.id}>
                                <Table.Td>{new Date(stat.timestamp).toLocaleString()}</Table.Td>
                                <Table.Td>{stat.downloadSpeed.toFixed(2)}</Table.Td>
                                <Table.Td>{stat.uploadSpeed.toFixed(2)}</Table.Td>
                                <Table.Td>{stat.ping.toFixed(2)}</Table.Td>
                                <Table.Td>{stat.userLocation}</Table.Td>
                                <Table.Td>{stat.serverName}</Table.Td>
                                <Table.Td>{stat.serverLocation}</Table.Td>
                                <Table.Td>{stat.isp}</Table.Td>
                                <Table.Td>
                                    <Center>
                                        <ActionIcon color="red" onClick={() => handleDelete(stat.id)}>
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
