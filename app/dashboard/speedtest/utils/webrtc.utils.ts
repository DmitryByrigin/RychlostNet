import { RTCStates } from '../types/webrtc.types';

export const createPeerConnection = () => {
    return new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
    });
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
