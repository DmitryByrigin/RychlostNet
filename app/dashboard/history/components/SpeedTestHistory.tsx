import React, {useEffect, useState} from 'react';
import {ActionIcon, Center, Loader, ScrollArea, Table} from '@mantine/core';
import {IconSortAscending, IconSortDescending, IconTrash} from '@tabler/icons-react';
import classes from '../SpeedTestHistory.module.css';
import {SpeedTestHistory as SpeedTestHistoryType} from '@prisma/client';

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
            .catch((error) => {
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
                throw new Error('Failed to delete the record');
            }
            setData(data.filter((stat) => stat.id !== id));
        } catch (error) {
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError('An unknown error occurred');
            }
        }
    };

    const sortedData = [...data].sort((a, b) => {
        if (!sortColumn) return 0;
        const aValue = a[sortColumn as keyof SpeedTestHistoryType];
        const bValue = b[sortColumn as keyof SpeedTestHistoryType];
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    if (loading) {
        return (
            <Center style={{height: '100vh'}}>
                <Loader/>
            </Center>
        );
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <ScrollArea>
            <Table>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th onClick={() => handleSort('timestamp')} className={classes.sortableHeader}>
                            Timestamp {sortColumn === 'timestamp' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th onClick={() => handleSort('downloadSpeed')} className={classes.sortableHeader}>
                            Download Speed (Mbps) {sortColumn === 'downloadSpeed' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th onClick={() => handleSort('uploadSpeed')} className={classes.sortableHeader}>
                            Upload Speed (Mbps) {sortColumn === 'uploadSpeed' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th onClick={() => handleSort('ping')} className={classes.sortableHeader}>
                            Ping (ms) {sortColumn === 'ping' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th onClick={() => handleSort('location')} className={classes.sortableHeader}>
                            User Location {sortColumn === 'location' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th onClick={() => handleSort('serverName')} className={classes.sortableHeader}>
                            Server Name {sortColumn === 'serverName' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th onClick={() => handleSort('serverLocation')} className={classes.sortableHeader}>
                            Server Location {sortColumn === 'serverLocation' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th onClick={() => handleSort('isp')} className={classes.sortableHeader}>
                            ISP {sortColumn === 'isp' && (sortDirection === 'asc' ?
                            <IconSortAscending size={16}/> : <IconSortDescending size={16}/>)}
                        </Table.Th>
                        <Table.Th>
                            <Center>
                                Actions
                            </Center>
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
                                        <IconTrash size={16}/>
                                    </ActionIcon>
                                </Center>
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        </ScrollArea>
    );
};

export default SpeedTestHistoryComponent;
