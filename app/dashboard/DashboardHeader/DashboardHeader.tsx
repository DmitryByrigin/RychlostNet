'use client';

import cx from 'clsx';
import {useState} from 'react';
import {Avatar, Burger, Container, Group, Menu, rem, Tabs, Text, UnstyledButton, useMantineTheme,} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {
    IconChevronDown,
    IconHeart,
    IconLogout,
    IconMessage,
    IconPlayerPause,
    IconSettings,
    IconStar,
    IconSwitchHorizontal,
    IconTrash,
} from '@tabler/icons-react';

import classes from './DashboardHeader.module.css';

const user = {
    name: 'Jane Spoonfighter',
    email: 'janspoon@fighter.dev',
    image: 'https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-5.png',
};

const tabs = [
    'Home',
    'Orders',
    'Education',

];

export function DashboardHeader() {
    const theme = useMantineTheme();
    const [opened, {toggle}] = useDisclosure(false);
    const [userMenuOpened, setUserMenuOpened] = useState(false);

    const items = tabs.map((tab) => (
        <Tabs.Tab value={tab} key={tab}>
            {tab}
        </Tabs.Tab>
    ));

    return (
        <div className={classes.header}>
            <Container className={classes.logoSection} size="md">
                <img src="/images/logo.png" alt="Logo" width={28}/>
                <Text size="xl" style={{ marginLeft: rem(10), fontWeight: 700, fontStyle: 'italic' }}>
                    RýchlosťNet
                </Text>
            </Container>

            <Container size="md">

                <Tabs
                    defaultValue="Home"
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
            </Container>

            <Container className={classes.mainSection} size="md">
                <Group justify="space-between">


                    <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm"/>

                    <Menu
                        width={260}
                        position="bottom-end"
                        transitionProps={{transition: 'pop-top-right'}}
                        onClose={() => setUserMenuOpened(false)}
                        onOpen={() => setUserMenuOpened(true)}
                        withinPortal
                    >
                        <Menu.Target>
                            <UnstyledButton
                                className={cx(classes.user, {[classes.userActive]: userMenuOpened})}
                            >
                                <Group gap={7}>
                                    <Avatar src={user.image} alt={user.name} radius="xl" size={20}/>
                                    <Text fw={500} size="sm" lh={1} mr={3}>
                                        {user.name}
                                    </Text>
                                    <IconChevronDown style={{width: rem(12), height: rem(12)}} stroke={1.5}/>
                                </Group>
                            </UnstyledButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item
                                leftSection={
                                    <IconHeart
                                        style={{width: rem(16), height: rem(16)}}
                                        color={theme.colors.red[6]}
                                        stroke={1.5}
                                    />
                                }
                            >
                                Liked posts
                            </Menu.Item>
                            <Menu.Item
                                leftSection={
                                    <IconStar
                                        style={{width: rem(16), height: rem(16)}}
                                        color={theme.colors.yellow[6]}
                                        stroke={1.5}
                                    />
                                }
                            >
                                Saved posts
                            </Menu.Item>
                            <Menu.Item
                                leftSection={
                                    <IconMessage
                                        style={{width: rem(16), height: rem(16)}}
                                        color={theme.colors.blue[6]}
                                        stroke={1.5}
                                    />
                                }
                            >
                                Your comments
                            </Menu.Item>

                            <Menu.Label>Settings</Menu.Label>
                            <Menu.Item
                                leftSection={
                                    <IconSettings style={{width: rem(16), height: rem(16)}} stroke={1.5}/>
                                }
                            >
                                Account settings
                            </Menu.Item>
                            <Menu.Item
                                leftSection={
                                    <IconSwitchHorizontal style={{width: rem(16), height: rem(16)}} stroke={1.5}/>
                                }
                            >
                                Change account
                            </Menu.Item>
                            <Menu.Item
                                leftSection={
                                    <IconLogout style={{width: rem(16), height: rem(16)}} stroke={1.5}/>
                                }
                            >
                                Logout
                            </Menu.Item>

                            <Menu.Divider/>

                            <Menu.Label>Danger zone</Menu.Label>
                            <Menu.Item
                                leftSection={
                                    <IconPlayerPause style={{width: rem(16), height: rem(16)}} stroke={1.5}/>
                                }
                            >
                                Pause subscription
                            </Menu.Item>
                            <Menu.Item
                                color="red"
                                leftSection={<IconTrash style={{width: rem(16), height: rem(16)}} stroke={1.5}/>}
                            >
                                Delete account
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Container>

        </div>
    );
}
