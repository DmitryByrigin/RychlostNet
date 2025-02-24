import { useState, useEffect, useCallback, useRef } from 'react';
import { Manager, Socket } from 'socket.io-client';
import { 
    WebRTCSpeedTestResult, 
    WebRTCError, 
    ConnectionEstablishedData,
    RTCStates 
} from '../types/webrtc.types';
import { 
    createPeerConnection,
    logRTCState,
    handleIceCandidate 
} from '../utils/webrtc.utils';
import { 
    runDownloadTest,
    measureLatency 
} from '../utils/speedtest.utils';
import { uploadData, runParallelUpload, runUploadTest } from '../utils/upload.utils';

// Используем переменную окружения для URL сервера
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVERS;

export const useWebRTCSpeedTest = () => {
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDataChannelReady, setIsDataChannelReady] = useState(false);
    const [connectionState, setConnectionState] = useState<RTCStates>(RTCStates.NEW);
    
    const socketRef = useRef<Socket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const isInitiatorRef = useRef(false);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 3;
    const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

    // Добавляем методы для проверки состояния
    const isConnected = useCallback(() => {
        return connectionState === RTCStates.CONNECTED;
    }, [connectionState]);

    const isDataChannelReadyState = useCallback(() => {
        const dataChannel = dataChannelRef.current;
        return dataChannel !== null && dataChannel.readyState === 'open';
    }, []);

    const logState = useCallback(() => {
        return logRTCState(
            peerConnectionRef.current,
            dataChannelRef.current,
            socketRef.current,
            pendingIceCandidatesRef.current,
            isInitiatorRef.current
        );
    }, []);

    const setupDataChannel = useCallback((dataChannel: RTCDataChannel) => {
        console.log('Setting up data channel:', dataChannel.label);
        
        dataChannel.onopen = () => {
            console.log('Data channel opened:', {
                label: dataChannel.label,
                id: dataChannel.id,
                state: dataChannel.readyState,
                bufferedAmount: dataChannel.bufferedAmount,
                maxRetransmits: dataChannel.maxRetransmits,
                ordered: dataChannel.ordered,
                protocol: dataChannel.protocol
            });
            setIsDataChannelReady(true);
            setConnectionState(RTCStates.CONNECTED);
            logState();
        };

        dataChannel.onclose = () => {
            console.log('Data channel closed:', {
                label: dataChannel.label,
                id: dataChannel.id,
                state: dataChannel.readyState
            });
            setIsDataChannelReady(false);
            setConnectionState(RTCStates.CLOSED);
            logState();
        };

        dataChannel.onerror = (error) => {
            console.error('Data channel error:', {
                label: dataChannel.label,
                id: dataChannel.id,
                state: dataChannel.readyState,
                error
            });
            setError('Data channel error');
            setConnectionState(RTCStates.ERROR);
            logState();
        };

        dataChannelRef.current = dataChannel;
    }, [logState]);

    const waitForDataChannel = useCallback(async (timeout = 10000) => {
        if (isDataChannelReadyState()) {
            return true;
        }

        return new Promise<boolean>((resolve) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (isDataChannelReadyState()) {
                    clearInterval(checkInterval);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    resolve(false);
                }
            }, 100);
        });
    }, [isDataChannelReadyState]);

    const measureLatencyWithRetry = useCallback(async (samples: number = 20): Promise<number> => {
        if (!dataChannelRef.current) {
            throw new Error('Data channel not initialized');
        }

        const isReady = await waitForDataChannel();
        if (!isReady) {
            throw new Error('Data channel not ready after timeout');
        }

        return measureLatency(dataChannelRef.current, samples);
    }, [waitForDataChannel]);

    const initializeWebRTC = useCallback(async () => {
        try {
            console.log('Initializing WebRTC with server:', SOCKET_SERVER_URL);
            setIsConnecting(true);
            setError(null);

            // Create Socket.IO connection
            const manager = new Manager(SOCKET_SERVER_URL, {
                path: '/socket.io',
                transports: ['polling', 'websocket'],
                reconnection: true,
                reconnectionAttempts: maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 45000,
                autoConnect: true,
                withCredentials: true,
                forceNew: true
            });

            const socket = manager.socket('/speedtest', {
                auth: {
                    origin: window.location.origin
                }
            });

            socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
                setError('Connection error: ' + error.message);
            });

            socket.on('connect_timeout', () => {
                console.error('Socket connection timeout');
                setError('Connection timeout');
            });

            socketRef.current = socket;

            // Create WebRTC connection with timeout
            const peerConnection = createPeerConnection();
            peerConnectionRef.current = peerConnection;

            // Set up data channel with specific options
            const dataChannel = peerConnection.createDataChannel('speedtest', {
                ordered: true,
                maxRetransmits: 3
            });
            
            setupDataChannel(dataChannel);

            // Socket.IO event handlers
            socket.on('connect', async () => {
                console.log('Socket.io connected:', socket.id);
                setError(null);
                setIsConnecting(false);
                reconnectAttempts.current = 0;

                try {
                    console.log('Creating offer');
                    const offer = await peerConnection.createOffer({
                        offerToReceiveAudio: false,
                        offerToReceiveVideo: false
                    });

                    console.log('Setting local description:', offer.type);
                    await peerConnection.setLocalDescription(offer);

                    console.log('Sending offer to peer');
                    socket.emit('offer', offer);
                } catch (error) {
                    console.error('Error creating data channel or offer:', error);
                    setError('Failed to create WebRTC connection');
                    setConnectionState(RTCStates.FAILED);
                }
                logState();
            });

            socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
                try {
                    console.log('Received answer:', answer.type);
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                    console.log('Set remote description successfully');
                } catch (error) {
                    console.error('Error setting remote description:', error);
                    setError('Failed to establish WebRTC connection');
                    setConnectionState(RTCStates.FAILED);
                }
                logState();
            });

            socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
                try {
                    if (data.candidate) {
                        console.log('Received ICE candidate from server');
                        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                        console.log('Added ICE candidate successfully');
                    }
                } catch (error) {
                    console.error('Error adding received ICE candidate:', error);
                }
                logState();
            });

            socket.on('disconnect', (reason: string) => {
                console.log('Socket.io disconnected:', reason);
                setIsConnecting(false);
                setIsDataChannelReady(false);
                setConnectionState(RTCStates.DISCONNECTED);
                logState();
            });

            // WebRTC event handlers
            peerConnection.onicecandidate = (event) => handleIceCandidate(event, socket);
            
            peerConnection.onconnectionstatechange = () => {
                console.log('Connection state changed:', peerConnection.connectionState);
                setConnectionState(peerConnection.connectionState as RTCStates);
                logState();
            };

            // Connect socket
            socket.connect();

        } catch (error) {
            console.error('Error initializing WebRTC:', error);
            setError('Failed to initialize WebRTC');
            setConnectionState(RTCStates.FAILED);
            setIsConnecting(false);
            throw error;
        }
    }, [setupDataChannel, logState]);

    const resetConnection = useCallback(async () => {
        console.log('Resetting WebRTC connection...');
        
        // Clean up existing data channel
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }

        // Clean up existing peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Clean up socket connection
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        // Reset states
        setIsConnecting(false);
        setIsDataChannelReady(false);
        setConnectionState(RTCStates.NEW);
        setError(null);
        
        // Wait a bit before reconnecting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reinitialize connection
        await initializeWebRTC();
    }, [initializeWebRTC]);

    const runSpeedTest = useCallback(async (type: 'download' | 'upload', size?: number): Promise<number> => {
        const dataChannel = dataChannelRef.current;
        if (!dataChannel || dataChannel.readyState !== 'open') {
            throw new Error('Data channel not ready');
        }

        switch (type) {
            case 'download':
                return runDownloadTest(dataChannel, size);
            case 'upload':
                return runUploadTest(dataChannel, size);
            default:
                throw new Error('Invalid test type');
        }
    }, []);

    const measureSpeed = useCallback(async (): Promise<WebRTCSpeedTestResult> => {
        try {
            if (!isDataChannelReadyState()) {
                console.log('Data channel not ready, attempting reset...');
                await resetConnection();
                
                const isReady = await waitForDataChannel();
                if (!isReady) {
                    throw new Error('Failed to establish WebRTC connection');
                }
            }

            if (!dataChannelRef.current) {
                throw new Error('Data channel not initialized');
            }

            const ping = await measureLatencyWithRetry();
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const download = await runDownloadTest(dataChannelRef.current!, undefined);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const upload = await runUploadTest(dataChannelRef.current!, undefined);

            return { ping, download, upload };
        } catch (error) {
            console.error('Error during speed measurement:', error);
            resetConnection().catch(console.error);
            throw error;
        }
    }, [isDataChannelReadyState, resetConnection, waitForDataChannel, measureLatencyWithRetry]);

    // Initialize WebRTC connection
    useEffect(() => {
        initializeWebRTC().catch(console.error);

        return () => {
            // Cleanup on unmount
            if (dataChannelRef.current) {
                dataChannelRef.current.close();
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, [initializeWebRTC]);

    return {
        isConnecting,
        isDataChannelReady,
        connectionState,
        error,
        measureLatency: measureLatencyWithRetry,
        isConnected: () => connectionState === RTCStates.CONNECTED,
        isDataChannelReadyState: () => isDataChannelReady,
        measureSpeed,
        runDownloadTest: (size?: number) => runSpeedTest('download', size),
        runUploadTest: (size?: number) => runSpeedTest('upload', size)
    };
};