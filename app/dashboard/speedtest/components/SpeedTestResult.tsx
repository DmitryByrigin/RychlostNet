import React from 'react';
import { SimpleGrid } from '@mantine/core';
import { NetworkStat } from '../types/speedTest';
import { StatItem } from './StatItem';
import classes from '../SpeedTest.module.css';

interface SpeedTestResultProps {
    networkStats: NetworkStat[];
}

export const SpeedTestResult: React.FC<SpeedTestResultProps> = ({ networkStats }) => {
    return (
        <SimpleGrid className={classes.resultCols} mt="md">
            {networkStats.map((stat) => {
                const { key, ...rest } = stat;
                return <StatItem key={key} statKey={key} {...rest} />;
            })}
        </SimpleGrid>
    );
};
