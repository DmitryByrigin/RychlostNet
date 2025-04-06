import React from 'react';
import { Button, Center } from '@mantine/core';
import classes from '../SpeedTest.module.css';

interface SpeedTestControlsProps {
    isTesting: boolean;
    onStartTest: () => void;
    hasAvailableServers: boolean; // Add this prop
}

export const SpeedTestControls: React.FC<SpeedTestControlsProps> = ({ isTesting, onStartTest, hasAvailableServers }) => {
    const handleClick = async () => {
        if (!isTesting) {
            await onStartTest();
        }
    };

    return (
        <Center style={{ overflow: 'hidden', width: '100%' }}>
            <Button
                mb="lg"
                className={`${classes.speedTestButton} ${isTesting ? classes.gradientBackground + ' ' + classes.testingAnimation : ''}`}
                size="lg"
                radius="xl"
                onClick={handleClick}
                disabled={isTesting || !hasAvailableServers} // Disable if no available servers
                fullWidth
            >
                {isTesting ? '' : 'Check'}
            </Button>
        </Center>
    );
};
