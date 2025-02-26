import { RTCStates } from '../types/webrtc.types';

export const createPeerConnection = () => {
    const configuration: RTCConfiguration = {
        iceServers: [
            // Google STUN servers
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            
            // ExpressTURN server
            {
                urls: [
                    'turn:relay1.expressturn.com:3478',
                    'turn:relay1.expressturn.com:3478?transport=tcp',
                    'turn:relay1.expressturn.com:3478?transport=udp'
                ],
                username: 'efKFYPOIFE0G1M4WS9',
                credential: 'MYVmxBn931nuOmR3'
            }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle' as RTCBundlePolicy,
        rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy
    };

    const pc = new RTCPeerConnection(configuration);
    
    // Улучшаем обработку состояний ICE
    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('ICE Connection State:', state);
        
        if (state === 'connected' || state === 'completed') {
            console.log('ICE Connection established successfully');
        } else if (state === 'failed') {
            console.log('ICE Connection failed, attempting restart...');
            pc.restartIce();
        } else if (state === 'disconnected') {
            console.log('ICE Connection disconnected, waiting for reconnection...');
        }
    };

    // Улучшаем обработку состояний соединения
    pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('Connection State:', state);
        
        if (state === 'connected') {
            console.log('Connection established successfully');
        } else if (state === 'failed') {
            console.log('Connection failed, checking data channel state...');
            // Проверяем состояние data channel если он существует
            const dataChannels = (pc as any).dataChannels;
            if (dataChannels) {
                Object.values(dataChannels).forEach((dc: RTCDataChannel) => {
                    console.log('Data Channel State:', dc.readyState);
                });
            }
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
                foundation: candidate.foundation
            });

            // Добавляем дополнительную информацию для диагностики
            if (candidate.type === 'relay') {
                console.log('TURN server is being used:', candidate.relatedAddress);
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
