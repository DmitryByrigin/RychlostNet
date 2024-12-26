import { useDisclosure } from '@mantine/hooks';
import { Modal as MantineModal, Button } from '@mantine/core';
import React from "react";

interface CustomModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

export default function CustomModal({ isOpen, onClose, children, title = "Select Server" }: CustomModalProps) {
    return (
        <MantineModal opened={isOpen} onClose={onClose} title={title} centered>
            <div>{children}</div>
        </MantineModal>
    );
}
