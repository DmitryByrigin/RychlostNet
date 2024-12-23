"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { newVerification } from "@/actions/new-verification";
import { IconCheck, IconX } from "@tabler/icons-react";
import {Button, Center, Container, Group, List, rem, ThemeIcon} from "@mantine/core";
import Link from "next/link";
import { BeatLoader } from "react-spinners";
import styles from "./newVerification.module.scss";
import classes from "@/components/auth/newVerification/newVerification.module.scss";

export const NewVerificationForm = () => {
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const handleVerification = useCallback(() => {
        if (!token) {
            setError("Missing token!");
            return;
        }

        newVerification(token)
            .then((data) => {
                if (data.success) setSuccess(data.success);
                if (data.error) setError(data.error);
            })
            .catch(() => setError("Something went wrong!"));
    }, [token]);

    useEffect(() => {
        handleVerification();
    }, [handleVerification]);

    const renderMessage = () => {
        if (success) {
            return (
                <List
                    mt={30}
                    spacing="sm"
                    size="sm"
                    className={classes.title}
                    icon={
                        <ThemeIcon color="green" size={50} radius="xl" mr={20}>
                            <IconCheck size={30} stroke={1.5} />
                        </ThemeIcon>
                    }
                >
                    <List.Item>
                        <b>Mail verification was successful.</b> You can now authorize yourself.
                    </List.Item>
                </List>
            );
        }

        if (error) {
            return (
                <List
                    mt={30}
                    spacing="sm"
                    size="sm"
                    className={classes.title}
                    icon={
                        <ThemeIcon color="red" size={50} radius="xl" mr={20}>
                            <IconX size={30} stroke={1.5} />
                        </ThemeIcon>
                    }
                >
                    <List.Item>
                        <b>Mail verification failed.</b> You can try to authorize again.
                    </List.Item>
                </List>
            );
        }

        return <Center><BeatLoader /></Center>;
    };

    return (
        <Container size="md">
            <div className={styles.inner}>
                <div className={styles.content}>
                    {renderMessage()}
                    <Group mt={30}>
                        <Link href="/auth/login">
                            <Button radius="xl" size="md" className={styles.control}>
                                Back to login
                            </Button>
                        </Link>
                    </Group>
                </div>
            </div>
        </Container>
    );
};
