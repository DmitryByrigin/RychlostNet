"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Avatar,
  Button,
  Container,
  Group,
  Menu,
  rem,
  Text,
  UnstyledButton,
} from "@mantine/core";
import classes from "./userButton.module.scss";
import cx from "clsx";
import {
  IconChevronDown,
  IconLogout,
  IconDashboard,
} from "@tabler/icons-react";
import { useState } from "react";
import { LogoutButton } from "../logout-button";
import Link from "next/link";

export const UserButton = () => {
  const [userMenuOpened, setUserMenuOpened] = useState(false);

  const user = useCurrentUser();

  return (
    <Container className={classes.userButtonContainer} mb="sm">
      {" "}
      <Group justify="space-between">
        <Menu
          width={260}
          position="bottom-end"
          transitionProps={{ transition: "pop-top-right" }}
          onClose={() => setUserMenuOpened(false)}
          onOpen={() => setUserMenuOpened(true)}
          withinPortal
        >
          {user ? (
            <Menu.Target>
              <UnstyledButton
                className={cx(classes.user, {
                  [classes.userActive]: userMenuOpened,
                })}
              >
                <Group gap={7}>
                  <Avatar src={user?.image || null} radius="xl" alt="avatar" />
                  {/*{isMediaQueryEvaluated && !isMobile && (*/}
                  <Text
                    className={classes.username}
                    fw={500}
                    size="sm"
                    lh={1}
                    mr={3}
                  >
                    {user.name}
                    {user.role === "ADMIN" && (
                      <span
                        style={{
                          marginLeft: "5px",
                          color: "#228be6",
                          fontWeight: "bold",
                        }}
                      >
                        (Admin)
                      </span>
                    )}
                  </Text>
                  {/*)}*/}
                  <IconChevronDown
                    style={{ width: rem(12), height: rem(12) }}
                    stroke={1.5}
                  />
                </Group>
              </UnstyledButton>
            </Menu.Target>
          ) : (
            <Group grow>
              <Link href="/auth/login">
                <Button>Log in</Button>
              </Link>
            </Group>
          )}

          <Menu.Dropdown>
            {user && user.role === "ADMIN" && (
              <>
                <Link
                  href="/admin/speedtests"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Menu.Item
                    leftSection={
                      <IconDashboard
                        style={{ width: rem(16), height: rem(16) }}
                        stroke={1.5}
                      />
                    }
                  >
                    Speed Test Results
                  </Menu.Item>
                </Link>
                <Menu.Divider />
              </>
            )}
            {user && (
              <LogoutButton>
                <Menu.Item
                  leftSection={
                    <IconLogout
                      style={{ width: rem(16), height: rem(16) }}
                      stroke={1.5}
                    />
                  }
                >
                  Logout
                </Menu.Item>
              </LogoutButton>
            )}
            <Menu.Divider />
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Container>
  );
};
