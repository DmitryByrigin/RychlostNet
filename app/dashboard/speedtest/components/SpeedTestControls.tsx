import React, { useState } from 'react';
import { Button } from '@mantine/core';
import classes from '../SpeedTest.module.css';

interface SpeedTestControlsProps {
    isTesting: boolean;
    onStartTest: () => void;
}

export const SpeedTestControls: React.FC<SpeedTestControlsProps> = ({ isTesting, onStartTest }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        await onStartTest();
        setIsLoading(false);
    };

    return (
        <Button
            mb="lg"
            className={`${classes.speedTestButton} ${isLoading ? classes.gradientBackground + ' ' + classes.testingAnimation : ''}`}
            size="lg"
            radius="xl"
            onClick={handleClick}
            disabled={isLoading}
        >
            {isLoading ? '' : 'Check'}
        </Button>
    );
};
