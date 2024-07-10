"use client";

import {useCallback, useEffect, useState} from "react";
import {useSearchParams} from "next/navigation";
import {newVerification} from "@/actions/new-verification";
import {IconCheck, IconSquareRoundedX, IconX} from "@tabler/icons-react";
import {Button, Container, Group, List, rem, ThemeIcon} from "@mantine/core";
import Link from "next/link";
import classes from "./NewVerification.module.css";
import {BeatLoader} from "react-spinners";

export const NewVerificationForm = () => {
    const xIcon = <IconX style={{width: rem(20), height: rem(20)}}/>;
    const checkIcon = <IconCheck style={{width: rem(20), height: rem(20)}}/>;

    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();

    const searchParams = useSearchParams();

    const token = searchParams.get("token");
    console.log("Token: ", token)

    const onSubmit = useCallback(() => {
        if (success || error) return;

        if (!token) {
            setError("Missing token!");
            return;
        }

        newVerification(token)
            .then((data) => {
                setSuccess(data.success);
                setError(data.error);
            })
            .catch(() => {
                setError("Something went wrong!");
            })
    }, [token, success, error]);

    useEffect(() => {
        onSubmit();
    }, [onSubmit]);

    return (
        // <Container size="md">
        //     <div className="flex items-center w-full justify-center">
        //         {!success && !error && (
        //             <BeatLoader/>
        //         )}
        //         {success && (
        //             <Notification icon={checkIcon} color="teal" title="All good!" mt="md">
        //                 Everything is fine
        //             </Notification>
        //         )}
        //         {error && (
        //             <Notification icon={xIcon} color="red" title="Bummer!">
        //                 Something went wrong
        //             </Notification>
        //         )}
        //     </div>
        //     <Link href="/auth/login">
        //         <Button>
        //             Back to login
        //         </Button>
        //     </Link>
        // </Container>


        <Container size="md">
            <div className={classes.inner}>
                <div className={classes.content}>

                    {!success && !error && (
                        <BeatLoader/>
                    )}
                    {success && (
                        <List
                            mt={30}
                            spacing="sm"
                            size="sm"
                            className={classes.title}
                            icon={
                                <ThemeIcon color="green" size={50} radius="xl" mr={20}>
                                    <IconCheck style={{width: rem(30), height: rem(30)}} stroke={1.5}/>
                                </ThemeIcon>
                            }
                        >
                            <List.Item>
                                <b>Mail verification was successful</b> now you can authorize yourself
                            </List.Item>
                        </List>

                    )}
                    {error && (
                        <List
                            mt={30}
                            spacing="sm"
                            size="sm"
                            className={classes.title}
                            icon={
                                <ThemeIcon color="red" size={50} radius="xl" mr={20}>
                                    <IconX style={{width: rem(30), height: rem(30)}} stroke={1.5}/>
                                </ThemeIcon>
                            }
                        >
                            <List.Item>
                                <b>Mail verification failed</b> you can try to authorize again
                            </List.Item>
                        </List>

                    )}

                    <Group mt={30}>
                        <Link href="/auth/login">
                            <Button radius="xl" size="md" className={classes.control}>
                                Back to login
                            </Button>
                        </Link>
                    </Group>
                </div>
                {/*<Image src={image.src} className={classes.image} />*/}
            </div>
        </Container>
    )
}
