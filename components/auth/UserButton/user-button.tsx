'use client'


import {useCurrentUser} from "@/hooks/use-current-user";
import {Avatar, Button, Container, Group, Menu, rem, Text, UnstyledButton, useMatches,} from "@mantine/core";
import classes from "./UserButton.module.css";
import cx from "clsx";
import {IconChevronDown, IconLogout, IconSettings} from "@tabler/icons-react";
import {useEffect, useState} from "react";
import {LogoutButton} from "../logout-button";
import Link from "next/link";
import {useMediaQuery} from "@mantine/hooks";


export const UserButton = () => {
    const [userMenuOpened, setUserMenuOpened] = useState(false);

    const user = useCurrentUser();
    // const [isMediaQueryEvaluated, setIsMediaQueryEvaluated] = useState(false);
    // const isMobile = useMediaQuery('(max-width: 768px)');
    //
    // useEffect(() => {
    //     setIsMediaQueryEvaluated(true);
    // }, [isMobile]);

    return (
        <Container className={classes.userButtonContainer} mb="sm"> <Group
            justify="space-between">


            {/*<Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm"/>*/}

            <Menu
                width={260}
                position="bottom-end"
                transitionProps={{transition: 'pop-top-right'}}
                onClose={() => setUserMenuOpened(false)}
                onOpen={() => setUserMenuOpened(true)}
                withinPortal
            >

                {user ? (
                    <Menu.Target>
                        <UnstyledButton
                            className={cx(classes.user, {[classes.userActive]: userMenuOpened})}
                        >
                            <Group gap={7}>
                                <Avatar src={user?.image || null} radius="xl" alt="avatar"/>
                                {/*{isMediaQueryEvaluated && !isMobile && (*/}
                                    <Text className={classes.username} fw={500} size="sm" lh={1} mr={3}>
                                        {user!.name}
                                    </Text>
                                {/*)}*/}
                                <IconChevronDown style={{width: rem(12), height: rem(12)}} stroke={1.5}/>
                            </Group>
                        </UnstyledButton>
                    </Menu.Target>
                ) : (
                    <Group grow>
                        <Link href="/auth/login">
                            <Button>
                                Log in
                            </Button>
                        </Link>
                    </Group>
                )}

                <Menu.Dropdown>
                    {/*    <Menu.Item*/}
                    {/*        leftSection={*/}
                    {/*            <IconHeart*/}
                    {/*                style={{width: rem(16), height: rem(16)}}*/}
                    {/*                color={theme.colors.red[6]}*/}
                    {/*                stroke={1.5}*/}
                    {/*            />*/}
                    {/*        }*/}
                    {/*    >*/}
                    {/*        Liked posts*/}
                    {/*    </Menu.Item>*/}
                    {/*    <Menu.Item*/}
                    {/*        leftSection={*/}
                    {/*            <IconStar*/}
                    {/*                style={{width: rem(16), height: rem(16)}}*/}
                    {/*                color={theme.colors.yellow[6]}*/}
                    {/*                stroke={1.5}*/}
                    {/*            />*/}
                    {/*        }*/}
                    {/*    >*/}
                    {/*        Saved posts*/}
                    {/*    </Menu.Item>*/}
                    {/*    <Menu.Item*/}
                    {/*        leftSection={*/}
                    {/*            <IconMessage*/}
                    {/*                style={{width: rem(16), height: rem(16)}}*/}
                    {/*                color={theme.colors.blue[6]}*/}
                    {/*                stroke={1.5}*/}
                    {/*            />*/}
                    {/*        }*/}
                    {/*    >*/}
                    {/*        Your comments*/}
                    {/*    </Menu.Item>*/}

                    <Menu.Label>Settings</Menu.Label>
                    <Menu.Item
                        component={Link}
                        href="/dashboard/user"
                        leftSection={
                            <IconSettings style={{width: rem(16), height: rem(16)}} stroke={1.5}/>
                        }
                    >
                        Account settings
                    </Menu.Item>
                    {/*<Menu.Item*/}
                    {/*    leftSection={*/}
                    {/*        <IconSwitchHorizontal style={{width: rem(16), height: rem(16)}} stroke={1.5}/>*/}
                    {/*    }*/}
                    {/*>*/}
                    {/*    Change account*/}
                    {/*</Menu.Item>*/}
                    <LogoutButton>
                        <Menu.Item
                            leftSection={
                                <IconLogout style={{width: rem(16), height: rem(16)}} stroke={1.5}/>
                            }
                        >
                            Logout
                        </Menu.Item>
                    </LogoutButton>
                    <Menu.Divider/>

                    {/*<Menu.Label>Danger zone</Menu.Label>*/}
                    {/*<Menu.Item*/}
                    {/*    leftSection={*/}
                    {/*        <IconPlayerPause style={{width: rem(16), height: rem(16)}} stroke={1.5}/>*/}
                    {/*    }*/}
                    {/*>*/}
                    {/*    Pause subscription*/}
                    {/*</Menu.Item>*/}

                    {/*    <Menu.Item*/}
                    {/*        color="red"*/}
                    {/*        leftSection={<IconTrash style={{width: rem(16), height: rem(16)}} stroke={1.5}/>}*/}
                    {/*    >*/}
                    {/*        Logout*/}
                    {/*    </Menu.Item>*/}

                </Menu.Dropdown>
            </Menu>
        </Group>
        </Container>
    )
};
