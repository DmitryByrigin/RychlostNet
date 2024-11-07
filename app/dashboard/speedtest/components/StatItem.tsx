import React from 'react';
import { UnstyledButton, Text } from '@mantine/core';
import { NetworkStat } from '../types/speedTest';
import classes from '../SpeedTest.module.css';

interface StatItemProps extends Omit<NetworkStat, 'key'> {
    statKey: string;
}

export const StatItem: React.FC<StatItemProps> = ({ statKey, value, icon }) => {
    return (
        <UnstyledButton className={`${classes.item}`}>
            {React.createElement(icon, { color: "#1C7ED6", size: "1.5rem" })}
            <div className={classes.itemText}>
                <Text className={classes.boldText} size="sm" mt={7}>
                    {statKey}
                </Text>
                <Text className={classes.itemPointer} size="xs" mt={7}>
                    {value || ''}
                </Text>
            </div>
        </UnstyledButton>
    );
};
