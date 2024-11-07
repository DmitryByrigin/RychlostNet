import React from 'react';
import { UnstyledButton, Text, Anchor } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import classes from '../SpeedTest.module.css';

interface OperatorServiceProps {
    ip: string;
    org: string;
    location: string;
}

const OperatorService: React.FC<OperatorServiceProps> = ({ ip, org, location }) => {
    return (
        <UnstyledButton className={classes.item}>
            <IconUser color="indigo" size="1.5rem" />
            <div className={classes.itemText}>
                <Anchor className={`${classes.iconTitle} ${classes.boldText}`} size="sm" mt={7} href="#" underline="hover">
                    {org}
                </Anchor>
                <Text size="xs" mt={7}>
                    {ip}
                </Text>
                <Text size="xs" mt={7}>
                    {location}
                </Text>
            </div>
        </UnstyledButton>
    );
};

export default OperatorService;
