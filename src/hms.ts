import {
	HMSNotificationTypes,
	HMSReactiveStore,
	selectAudioTrackByPeerID,
	selectIsConnectedToRoom,
	selectLocalAudioTrackID,
	selectLocalPeer,
	selectPeerByID,
	selectPeers,
	selectScreenShareAudioByPeerID,
	selectScreenShareByPeerID,
	selectTrackByID,
	selectTracksMap,
	selectVideoTrackByPeerID,
	HMSPeer,
	HMSTrack,
} from '@100mslive/hms-video-store';
import { UPDATE_TYPE, CUSTOM_TRACK_NAME } from '../types/hmsType';

const isCameraTrack = (room:HMSReactiveStore , participant:HMSPeer, track:HMSTrack) => room.getStore().getState(selectVideoTrackByPeerID(participant.id))?.id === track.id;

const isScreenTrack = (room:HMSReactiveStore , participant:HMSPeer, track:HMSTrack) => room.getStore().getState(selectScreenShareByPeerID(participant.id))?.id === track.id;

const isCustomTrack = (participant:HMSPeer, track:HMSTrack) => participant.auxiliaryTracks.includes(track.id);

const isAudioTrack = (room:HMSReactiveStore , participant:HMSPeer, track:HMSTrack) => room.getStore().getState(selectAudioTrackByPeerID(participant.id))?.id === track.id;

const isScreenAudioTrack = (room:HMSReactiveStore , participant:HMSPeer, track:HMSTrack) => room.getStore().getState(selectScreenShareAudioByPeerID(participant.id))?.id === track.id;

const addAttachDetachToTrack = (room:HMSReactiveStore , track:HMSTrack) => {
	return {
		...track,
		identity: track.id,
		attach: (element:any) => room.getActions().attachVideo(track.id, element),
		detach: (element:any) => room.getActions().detachVideo(track.id, element),
	};
};

export const init = (isPrimaryChannel: boolean) =>
	new Promise((resolve) => {
		let clients = [];
		const hms = new HMSReactiveStore();
		hms.triggerOnSubscribe();
		clients.push(hms);
		if (isPrimaryChannel) {
			const primaryChannelHMS = new HMSReactiveStore();
			primaryChannelHMS.triggerOnSubscribe();
			clients.push(primaryChannelHMS);
		}

		resolve(clients);
	});

const addIdentityToParticipant = (participant:HMSPeer) => {
	return {
		...participant,
		identity: participant.customerUserId,
	};
};

export const connect = async (token :string, options:any, constraints:any) => {
	const hms = new HMSReactiveStore();
	hms.triggerOnSubscribe();

	// DOUBT: userName?
	hms.getActions().join({
		authToken: token,
		userName: options.userName,
		settings: {
			audioInputDeviceId: constraints.audio ? constraints.audio.deviceId : null,
			videoDeviceId: constraints.video ? constraints.video.deviceId : null,
			isVideoMuted: !constraints.video,
		},
	});
	await Promise.all([
		new Promise((resolve) => {
			const unsub = hms.getStore().subscribe((isConnected) => {
				if (isConnected) {
					resolve(null);
					unsub();
				}
			}, selectIsConnectedToRoom);
		}),
		new Promise((resolve) => {
			const unsub = hms.getStore().subscribe((trackId) => {
				if (trackId) {
					resolve(null);
					unsub();
				}
			}, selectLocalAudioTrackID);
		}),
	]);
	return hms;
};

export const disconnect = (room:HMSReactiveStore) => {
	return room.getActions().leave();
};

const getVideoTrackCount = (room:HMSReactiveStore , participant:HMSPeer) => {
	const tracksMap = room.getStore().getState(selectTracksMap);
	const tracks = Object.values(tracksMap);
	return tracks.filter((track) => track.peerId === participant.id && track.type === 'video').length;
};

export const onChange = function (room:HMSReactiveStore , callback:any) {
	const getState = room.getStore().getState;
	const callbackParticipantStatus = (participant:HMSPeer) => {
		participant = addIdentityToParticipant(participant);
		const hmsWebcam = getState(selectTrackByID(participant.videoTrack));
		const webcam = hmsWebcam ? addAttachDetachToTrack(room, hmsWebcam) : null;

		const hmsCustomID = participant.auxiliaryTracks.find((trackID) => {
			const track = getState(selectTrackByID(trackID));
			return track?.type === 'video' && track.source === CUSTOM_TRACK_NAME;
		});
		const hmsCustom = getState(selectTrackByID(hmsCustomID));
		const custom = hmsCustom ? addAttachDetachToTrack(room, hmsCustom) : null;

		const hmsScreen = getState(selectScreenShareByPeerID(participant.id)) || null;
		const screen = hmsScreen ? addAttachDetachToTrack(room, hmsScreen) : null;

		const hmsScreenAudio = getState(selectScreenShareAudioByPeerID(participant.id)) || null;
		const screenAudio = hmsScreenAudio ? addAttachDetachToTrack(room, hmsScreenAudio) : null;

		const hmsAudio = getState(selectTrackByID(participant.audioTrack));
		const audio = hmsAudio ? addAttachDetachToTrack(room, hmsAudio) : null;

		const videoTrackCount = getVideoTrackCount(room, participant);

		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.CAMERA_TRACK, value: webcam ? webcam : null });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.CAMERA_STATUS, value: webcam ? webcam.enabled : false });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.SCREEN_TRACK, value: screen ? screen : null });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.SCREEN_STATUS, value: screen ? screen.enabled : false });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.AUDIO_TRACK, value: audio ? audio : null });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.AUDIO_STATUS, value: audio ? audio.enabled : false });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.SCREEN_AUDIO_TRACK, value: screenAudio ? screenAudio : null });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.SCREEN_AUDIO_STATUS, value: screenAudio ? screenAudio.enabled : false });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.CUSTOM_TRACK, value: custom ? custom : null });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.CUSTOM_STATUS, value: custom ? custom.enabled : false });

		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.PARTICIPANT_ADD, value: participant });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.VIDEO_COUNT, value: videoTrackCount });
	};

	getState(selectPeers).forEach(callbackParticipantStatus);

	const onLocalTrackPublished = (track :any) => {
		const localParticipant:any =  getState(selectLocalPeer) ;
		const identity = localParticipant?.customerUserId;
		const videoTrackCount = getVideoTrackCount(room, localParticipant);
		track = addAttachDetachToTrack(room, track);

		// for video track adds, send track null if empty(disabled)
		if (isCameraTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.CAMERA_TRACK, value: track.enabled ? track : null });
			callback({ identity, type: UPDATE_TYPE.CAMERA_STATUS, value: track.enabled });
		} else if (isScreenTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_TRACK, value: track.enabled ? track : null });
			callback({ identity, type: UPDATE_TYPE.SCREEN_STATUS, value: track.enabled });
		} else if (isScreenAudioTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_STATUS, value: track.enabled });
		} else if (isAudioTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.AUDIO_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.AUDIO_STATUS, value: track.enabled });
		} else if (isCustomTrack(localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.CUSTOM_TRACK, value: track.enabled ? track : null });
			callback({ identity, type: UPDATE_TYPE.CUSTOM_STATUS, value: track.enabled });
		}

		callback({ identity, type: UPDATE_TYPE.VIDEO_COUNT, value: videoTrackCount });
	};

	const onLocalTrackStopped = (track:HMSTrack) => {
		const localParticipant :any= getState(selectLocalPeer) ;
		const identity = localParticipant?.customerUserId;
		const videoTrackCount = getVideoTrackCount(room, localParticipant);
		track = addAttachDetachToTrack(room, track);

		if (isCameraTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.CAMERA_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.CAMERA_STATUS, value: false });
		} else if (isScreenTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.SCREEN_STATUS, value: false });
		} else if (isScreenAudioTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_STATUS, value: false });
		} else if (isAudioTrack(room, localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.AUDIO_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.AUDIO_STATUS, value: false });
		} else if (isCustomTrack(localParticipant, track)) {
			callback({ identity, type: UPDATE_TYPE.CUSTOM_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.CUSTOM_STATUS, value: false });
		}

		callback({ identity, type: UPDATE_TYPE.VIDEO_COUNT, value: videoTrackCount });
	};

	const onLocalTrackEnabled = () => {
		const identity = getState(selectLocalPeer)?.customerUserId;
		callback({ identity, type: UPDATE_TYPE.AUDIO_STATUS, value: true });
	};

	const onLocalTrackDisabled = () => {
		const identity = getState(selectLocalPeer)?.customerUserId;
		callback({ identity, type: UPDATE_TYPE.AUDIO_STATUS, value: false });
	};

	// const onRemoteTrackSubscribed = () => {
	// 	//
	// };

	const onRemoteTrackStarted = (room:HMSReactiveStore , participant:HMSPeer, track:HMSTrack) => {
		const identity = participant.customerUserId;
		const videoTrackCount = getVideoTrackCount(room, participant);
		track = addAttachDetachToTrack(room, track);

		// for video track adds, send track null if empty(disabled)
		if (isCameraTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.CAMERA_TRACK, value: track.enabled ? track : null });
			callback({ identity, type: UPDATE_TYPE.CAMERA_STATUS, value: track.enabled });
		} else if (isScreenTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_TRACK, value: track.enabled ? track : null });
			callback({ identity, type: UPDATE_TYPE.SCREEN_STATUS, value: track.enabled });
		} else if (isScreenAudioTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_STATUS, value: track.enabled });
		} else if (isAudioTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.AUDIO_TRACK, value: track });
			callback({ identity, type: UPDATE_TYPE.AUDIO_STATUS, value: track.enabled });
		} else if (isCustomTrack(participant, track)) {
			callback({ identity, type: UPDATE_TYPE.CUSTOM_TRACK, value: track.enabled ? track : null });
			callback({ identity, type: UPDATE_TYPE.CUSTOM_STATUS, value: track.enabled });
		}

		callback({ identity, type: UPDATE_TYPE.VIDEO_COUNT, value: videoTrackCount });
	};


	const onRemoteTrackUnpublished = (participant:HMSPeer, track:HMSTrack) => {
		const identity = participant.customerUserId;
		const videoTrackCount = getVideoTrackCount(room, participant);
		track = addAttachDetachToTrack(room, track);

		if (isCameraTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.CAMERA_TRACK, value: null });
			callback({ identity, type: UPDATE_TYPE.CAMERA_STATUS, value: false });
		} else if (isScreenTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_TRACK, value: null });
			callback({ identity, type: UPDATE_TYPE.SCREEN_STATUS, value: false });
		} else if (isScreenAudioTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_TRACK, value: null });
			callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_STATUS, value: false });
		} else if (isAudioTrack(room, participant, track)) {
			callback({ identity, type: UPDATE_TYPE.AUDIO_TRACK, value: null });
			callback({ identity, type: UPDATE_TYPE.AUDIO_STATUS, value: false });
		} else if (isCustomTrack(participant, track)) {
			callback({ identity, type: UPDATE_TYPE.CUSTOM_TRACK, value: null });
			callback({ identity, type: UPDATE_TYPE.CUSTOM_STATUS, value: false });
		}
		callback({ identity, type: UPDATE_TYPE.VIDEO_COUNT, value: videoTrackCount });
	};

	
	const onRemoteTrackEnabled = (participant:HMSPeer, track:HMSTrack) => {
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.AUDIO_STATUS, value: track.enabled });
	};

	const onRemoteTrackDisabled = (participant:HMSPeer, track:HMSTrack) => {
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.AUDIO_STATUS, value: track.enabled });
	};

	const onParticipantConnected = ( participant:HMSPeer ) => {
		participant = addIdentityToParticipant(participant);
		callbackParticipantStatus(participant);
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.PARTICIPANT_ADD, value: participant });
		callback({ identity: participant.customerUserId, type: UPDATE_TYPE.VIDEO_COUNT, value: getVideoTrackCount(room, participant) });
	};

	const onParticipantDisconnected = (participant:HMSPeer) => {
		const identity = participant.customerUserId;
		const videoTrackCount = getVideoTrackCount(room, participant);

		callback({ identity, type: UPDATE_TYPE.PARTICIPANT_REMOVE, value: { identity } });

		callback({ identity, type: UPDATE_TYPE.CAMERA_TRACK, value: null });
		callback({ identity, type: UPDATE_TYPE.SCREEN_TRACK, value: null });
		callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_TRACK, value: null });
		callback({ identity, type: UPDATE_TYPE.AUDIO_TRACK, value: null });
		callback({ identity, type: UPDATE_TYPE.CUSTOM_TRACK, value: null });

		callback({ identity, type: UPDATE_TYPE.CAMERA_STATUS, value: false });
		callback({ identity, type: UPDATE_TYPE.SCREEN_STATUS, value: false });
		callback({ identity, type: UPDATE_TYPE.SCREEN_AUDIO_STATUS, value: false });
		callback({ identity, type: UPDATE_TYPE.AUDIO_STATUS, value: false });
		callback({ identity, type: UPDATE_TYPE.CUSTOM_STATUS, value: false });

		callback({ identity, type: UPDATE_TYPE.VIDEO_COUNT, value: videoTrackCount });
	};

	room.getNotifications().onNotification((notification) => {
		switch (notification.type) {
			// participantConnected
			case HMSNotificationTypes.PEER_LIST:
				notification.data.forEach(onParticipantConnected);
				break;

			// participantConnected
			case HMSNotificationTypes.PEER_JOINED:
				onParticipantConnected(notification.data);
				break;

			// participantDisconnected
			case HMSNotificationTypes.PEER_LEFT:
				onParticipantDisconnected(notification.data);
				break;

			/**
			 * trackDisabled for audio
			 * Twilio requires stopping and unpublishing to mute video track, so send trackStopped for local track and trackUnpublished for remote track on mute
			 */
			case HMSNotificationTypes.TRACK_MUTED: {
				const track : any = notification?.data;
				const participant :any = getState(selectPeerByID(track.peerId));
				if (track.type === 'audio') {
					if (participant?.isLocal) {
						onLocalTrackDisabled();
					} else {
						onRemoteTrackDisabled(track, participant);
					}
				} else if (participant?.isLocal) {
						onLocalTrackStopped(track);
					} else {
						onRemoteTrackUnpublished(track, participant);
					}
				break;
			}

			/**
			 * trackEnabled for audio
			 * Twilio requires starting a new local track and publishing it to unmute a video track, so send trackPublished for local track and trackStarted for remote track on unmute
			 */
			case HMSNotificationTypes.TRACK_UNMUTED: {
				const track :any  = notification?.data;
				const participant : any = getState(selectPeerByID(track.peerId));
				if (track.type === 'audio') {
					if (participant?.isLocal) {
						onLocalTrackEnabled();
					} else {
						onRemoteTrackEnabled(track, participant);
					}
				} else if (participant.isLocal) {
						onLocalTrackPublished({ track });
					} else {
						onRemoteTrackStarted(room,track, participant);
					}
				break;
			}

			/**
			 * trackPublished for local
			 * trackStarted for remote
			 */
			case HMSNotificationTypes.TRACK_ADDED: {
				const track :any= notification.data;
				const participant :any = getState(selectPeerByID(track.peerId));
				if (participant?.isLocal) {
					onLocalTrackPublished({ track });
				} else {
					onRemoteTrackStarted(room,track, participant);
				}
				break;
			}

			/**
			 * trackStopped for local
			 * trackUnpublished for remote
			 */
			case HMSNotificationTypes.TRACK_REMOVED: {
				const track :any= notification.data;
				const participant :any = getState(selectPeerByID(track.peerId));
				if (participant?.isLocal) {
					onLocalTrackStopped(track);
				} else {
					onRemoteTrackUnpublished(track, participant);
				}
				break;
			}
		}
	});

	// callback not implemented by WHJ
	// room.on("trackSubscribed", onRemoteTrackSubscribed);
};

export const stopLocalCamera = function (room:HMSReactiveStore) {
	return room.getActions().setLocalVideoEnabled(false);
};

export const startLocalCamera = async function (room:HMSReactiveStore, videoConstraints:any) {
	await room.getActions().setVideoSettings(videoConstraints);
	await room.getActions().setLocalVideoEnabled(true);
};

export const startLocalAudio = function (room : HMSReactiveStore) {
	return room.getActions().setLocalAudioEnabled(true);
};

export const stopLocalAudio = function (room : HMSReactiveStore) {
	return room.getActions().setLocalAudioEnabled(false);
};

export const startLocalScreen = function (room : HMSReactiveStore, stream:any) {
	const videoTrack = stream.getVideoTracks()[0];
	const audioTracks = stream.getAudioTracks();
	const audioTrack = audioTracks.length ? audioTracks[0] : null;

	return room
		.getActions()
		.addTrack(videoTrack, 'screen')
		.then(() => {
			if (audioTrack) {
				room
					.getActions()
					.addTrack(audioTrack, 'screen')
					.catch((err) => {
						throw err;
					});
			}
		});
};

export const stopLocalScreen = function (room : HMSReactiveStore) {
	return room.getActions().setScreenShareEnabled(false);
};


export const updateLocalCamera = function (room : HMSReactiveStore, videoConstraints:any) {
	return room.getActions().setVideoSettings(videoConstraints);
};

export const updateLocalAudio = function (room :HMSReactiveStore, audioConstraints:any) {
	return room.getActions().setAudioSettings(audioConstraints);
};

export const attachTrack = function (track:any, element:any) {
	track.attach(element);
};

export const detachTrack = function (track:any, element:any) {
	track.detach(element);
};

export const getLocalParticipant = function (room : HMSReactiveStore) {
	return { identity: room?.getStore()?.getState(selectLocalPeer)?.customerUserId };
};
