import { RTCStates } from '../types/webrtc.types';

export const createPeerConnection = () => {
    const configuration: RTCConfiguration = {
        iceServers: [
            // Google STUN servers
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            
            // Primary ExpressTURN server
            {
                urls: [
                    'turn:relay1.expressturn.com:3478',
                    'turn:relay1.expressturn.com:3478?transport=tcp',
                    'turn:relay1.expressturn.com:3478?transport=udp'
                ],
                username: 'efKFYPOIFE0G1M4WS9',
                credential: 'MYVmxBn931nuOmR3'
            },
            
            // Backup ExpressTURN server
            {
                urls: [
                    'turn:relay1.expressturn.com:3478',
                    'turn:relay1.expressturn.com:3478?transport=tcp',
                    'turn:relay1.expressturn.com:3478?transport=udp'
                ],
                username: 'ef1KCA6XLYJUWBFTOV',
                credential: 'YBQRD773mviRe9ld'
            },
            
            // Additional backup TURN servers
            {
                urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
                username: 'webrtc',
                credential: 'webrtc'
            },
            {
                urls: 'turn:numb.viagenie.ca',
                username: 'webrtc@live.com',
                credential: 'muazkh'
            }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle' as RTCBundlePolicy,
        rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
    };

    const pc = new RTCPeerConnection(configuration);
    
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const attemptReconnect = () => {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Attempting reconnection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            pc.restartIce();
            
            // Устанавливаем таймаут для следующей попытки
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
            reconnectTimeout = setTimeout(() => {
                if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
                    attemptReconnect();
                }
            }, 5000);
        } else {
            console.error('Max reconnection attempts reached');
            // Здесь можно добавить callback для уведомления о неудачной попытке переподключения
        }
    };

    // Улучшаем обработку состояний ICE
    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('ICE Connection State:', state);
        
        switch (state) {
            case 'connected':
            case 'completed':
                console.log('ICE Connection established successfully');
                reconnectAttempts = 0;
                if (reconnectTimeout) {
                    clearTimeout(reconnectTimeout);
                    reconnectTimeout = null;
                }
                break;
                
            case 'failed':
                console.log('ICE Connection failed, attempting restart...');
                attemptReconnect();
                break;
                
            case 'disconnected':
                console.log('ICE Connection disconnected, waiting for reconnection...');
                setTimeout(() => {
                    if (pc.iceConnectionState === 'disconnected') {
                        attemptReconnect();
                    }
                }, 2000);
                break;
                
            case 'closed':
                console.log('ICE Connection closed');
                if (reconnectTimeout) {
                    clearTimeout(reconnectTimeout);
                    reconnectTimeout = null;
                }
                break;
        }
    };

    // Улучшаем обработку состояний соединения
    pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('Connection State:', state);
        
        switch (state) {
            case 'connected':
                console.log('Connection established successfully');
                break;
                
            case 'failed':
                console.log('Connection failed, checking data channel state...');
                const dataChannels = (pc as any).dataChannels;
                if (dataChannels) {
                    Object.values(dataChannels).forEach((dc) => {
                        if (dc && typeof dc === 'object' && 'readyState' in dc) {
                            const dataChannel = dc as RTCDataChannel;
                            console.log('Data Channel State:', dataChannel.readyState);
                            console.log('Data Channel Stats:', {
                                bufferedAmount: dataChannel.bufferedAmount,
                                maxRetransmits: dataChannel.maxRetransmits,
                                ordered: dataChannel.ordered,
                                protocol: dataChannel.protocol
                            });
                        }
                    });
                }
                break;
                
            case 'disconnected':
                console.log('Connection disconnected');
                break;
                
            case 'closed':
                console.log('Connection closed');
                break;
        }
    };

    // Добавляем обработчик для gathering состояния
    pc.onicegatheringstatechange = () => {
        console.log('ICE Gathering State:', pc.iceGatheringState);
        if (pc.iceGatheringState === 'complete') {
            console.log('ICE gathering completed');
        }
    };

    // Улучшаем логирование ICE кандидатов
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            const candidate = event.candidate;
            console.log('New ICE candidate:', {
                type: candidate.type,
                protocol: candidate.protocol,
                address: candidate.address,
                port: candidate.port,
                priority: candidate.priority,
                foundation: candidate.foundation,
                relatedAddress: candidate.relatedAddress,
                relatedPort: candidate.relatedPort,
                usernameFragment: candidate.usernameFragment,
                tcpType: candidate.tcpType
            });

            // Добавляем дополнительную информацию для диагностики
            if (candidate.type === 'relay') {
                console.log('TURN server is being used:', {
                    relatedAddress: candidate.relatedAddress,
                    relatedPort: candidate.relatedPort
                });
            }
        } else {
            console.log('ICE Candidate gathering completed');
        }
    };

    return pc;
};

export const logRTCState = (
    peerConnection: RTCPeerConnection | null,
    dataChannel: RTCDataChannel | null,
    socket: any | null,
    pendingCandidates: RTCIceCandidateInit[],
    isInitiator: boolean
) => {
    if (!peerConnection) return null;

    const state = {
        iceConnectionState: peerConnection.iceConnectionState,
        iceGatheringState: peerConnection.iceGatheringState,
        signalingState: peerConnection.signalingState,
        connectionState: peerConnection.connectionState,
        dataChannelState: dataChannel?.readyState,
        remoteDescription: peerConnection.remoteDescription?.type,
        localDescription: peerConnection.localDescription?.type,
        pendingRemoteICECandidates: pendingCandidates.length,
        socketConnected: socket?.connected,
        socketId: socket?.id,
        isInitiator
    };

    console.log('WebRTC State:', state);
    return state;
};

export const handleIceCandidate = (
    event: RTCPeerConnectionIceEvent,
    socket: any
) => {
    if (event.candidate) {
        console.log('New ICE candidate:', {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            foundation: event.candidate.foundation,
            priority: event.candidate.priority,
            tcpType: event.candidate.tcpType,
            relatedAddress: event.candidate.relatedAddress,
            relatedPort: event.candidate.relatedPort
        });

        socket?.emit('ice-candidate', {
            candidate: event.candidate.toJSON()
        });
    }
};
