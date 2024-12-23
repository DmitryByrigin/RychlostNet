'use client';

import {
    Burger,
    Container,
    Divider,
    Drawer,
    Group,
    rem,
    ScrollArea,
    Tabs,
    Text,
    ThemeIcon,
    UnstyledButton,
    useMantineTheme,
} from '@mantine/core';
import {useDisclosure, useMediaQuery} from '@mantine/hooks';
import {IconBook, IconChartPie3, IconCode, IconCoin, IconFingerprint, IconNotification,} from '@tabler/icons-react';
import classes from './DashboardHeader.module.css';
import {UserButton} from "@/components/auth/userButton/user-button";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useCurrentUser} from "@/hooks/use-current-user";
import {useEffect, useState} from "react";
import Image from 'next/image';


const mockdata = [
    {
        icon: IconCode,
        title: 'Open source',
        description: 'This Pokémon’s cry is very loud and distracting',
    },
    {
        icon: IconCoin,
        title: 'Free for everyone',
        description: 'The fluid of Smeargle’s tail secretions changes',
    },
    {
        icon: IconBook,
        title: 'Documentation',
        description: 'Yanma is capable of seeing 360 degrees without',
    },
    {
        icon: IconFingerprint,
        title: 'Security',
        description: 'The shell’s rounded shape and the grooves on its.',
    },
    {
        icon: IconChartPie3,
        title: 'Analytics',
        description: 'This Pokémon uses its flying ability to quickly chase',
    },
    {
        icon: IconNotification,
        title: 'Notifications',
        description: 'Combusken battles with the intensely hot flames it spews',
    },
];


export function DashboardHeader() {
    const pathname = usePathname();
    const user = useCurrentUser();
    // const isMobile = useMediaQuery('(max-width: 768px)');
    // const [userMenuOpened, setUserMenuOpened] = useState(false);
    const [isMediaQueryEvaluated, setIsMediaQueryEvaluated] = useState(false);

    // useEffect(() => {
    //     setIsMediaQueryEvaluated(true);
    // }, [isMobile]);
    const tabs = [
        {name: 'Home', href: '/dashboard/speedtest'},
        ...(user ? [{name: 'History', href: '/dashboard/history'}] : []),
    ];

    const items = tabs.map((tab) => (
        // @ts-ignore
        <Tabs.Tab value={tab.name} key={tab.name} component={Link} href={tab.href}>
            {tab.name}
        </Tabs.Tab>
    ));

    // useEffect(() => {
    //     setIsMediaQueryEvaluated(true);
    // }, [isMobile]);

    const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
    const [linksOpened, { toggle: toggleLinks }] = useDisclosure(false);
    const theme = useMantineTheme();

    const links = mockdata.map((item) => (
        <UnstyledButton className={classes.subLink} key={item.title}>
            <Group wrap="nowrap" align="flex-start">
                <ThemeIcon size={34} variant="default" radius="md">
                    <item.icon style={{ width: rem(22), height: rem(22) }} color={theme.colors.blue[6]} />
                </ThemeIcon>
                <div>
                    <Text size="sm" fw={500}>
                        {item.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                        {item.description}
                    </Text>
                </div>
            </Group>
        </UnstyledButton>
    ));

    return (
        <div className={classes.header}>
            <Burger opened={drawerOpened} onClick={toggleDrawer} hiddenFrom="sm" style={{ display: "flex" }} p={0} ml={"xs"} />
            {/*{isMediaQueryEvaluated && !isMobile && (*/}
                <Container className={classes.logoSection} size="md" >
                    <Link href="/dashboard/speedtest">
                        <div>
                            <Image src="/images/logo.png" alt="Logo" width={40} height={35} />
                        </div>
                    </Link>

                    <Text component={Link} href="/dashboard/speedtest" size="xl" style={{ marginLeft: rem(10), fontWeight: 700, fontStyle: 'italic' }}>
                        RýchlosťNet
                    </Text>
                </Container>
            {/*)}*/}


            <Group h="100%" gap={0} visibleFrom="sm">
                <Tabs
                    value={tabs.find(tab => pathname.startsWith(tab.href))?.name || 'Home'}
                    variant="outline"
                    visibleFrom="sm"
                    classNames={{
                        root: classes.tabs,
                        list: classes.tabsList,
                        tab: classes.tab,
                    }}
                >
                    <Tabs.List>{items}</Tabs.List>
                </Tabs>
            </Group>

            <UserButton />

            <Drawer
                opened={drawerOpened}
                onClose={closeDrawer}
                size="100%"
                padding="md"
                title="Navigation"
                hiddenFrom="sm"
                zIndex={1000000}
            >
                <ScrollArea h={`calc(100vh - ${rem(80)})`} mx="-md">
                    <Divider my="sm" />
                    <Tabs
                        value={tabs.find(tab => pathname.startsWith(tab.href))?.name || 'Home'}
                        variant="outline"
                        classNames={{
                            root: classes.tabs,
                            list: classes.tabsList,
                            tab: classes.tab,
                        }}
                    >
                        <Tabs.List>{items}</Tabs.List>
                    </Tabs>
                    <Divider my="sm" />
                </ScrollArea>
            </Drawer>
        </div>
    );
}
