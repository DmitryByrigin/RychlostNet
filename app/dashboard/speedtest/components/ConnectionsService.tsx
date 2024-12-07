import React from 'react';
import { UnstyledButton, Text } from '@mantine/core';
import { IconArrowRight, IconArrowsRight } from '@tabler/icons-react';
import classes from '../SpeedTest.module.css';

interface ConnectionsServiceProps {
    selectedArrow: 'single' | 'multi';
    setSelectedArrow: (arrow: 'single' | 'multi') => void;
}

const ConnectionsService: React.FC<ConnectionsServiceProps> = ({ selectedArrow, setSelectedArrow }) => {
    return (
        <></>
    );
    // return (
    //     <UnstyledButton className={classes.item}>
    //         {selectedArrow === 'single' ? (
    //             <IconArrowRight color="blue" size="1.5rem" />
    //         ) : (
    //             <IconArrowsRight color="blue" size="1.5rem" />
    //         )}
    //         <div className={classes.itemText}>
    //             <Text className={classes.iconTitle} size="sm" mt={7} onClick={() => setSelectedArrow('multi')}>
    //                 Transfers
    //             </Text>
    //             <Text className={`${selectedArrow === 'single' ? classes.boldText : classes.itemPointer}`} size="xs" mt={7} onClick={() => setSelectedArrow('single')}>
    //                 Single
    //             </Text>
    //             <Text className={`${selectedArrow === 'multi' ? classes.boldText : classes.itemPointer}`} size="xs" mt={7} onClick={() => setSelectedArrow('multi')}>
    //                 Multi
    //             </Text>
    //         </div>
    //     </UnstyledButton>
    // );
};

export default ConnectionsService;
