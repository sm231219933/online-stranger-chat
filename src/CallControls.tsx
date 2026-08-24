import { useEffect, useRef, useState } from "react";
import { arrayUnion, collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";

type CallProfile = { uid: string; username: string; avatar: string; photoURL?: string };
type Props = { user: { uid: string } | null; selected: CallProfile | null };
type CallType = "voice" | "video";
type CallStatus = "ringing" | "connecting" | "connected" | "ended";

type CallDoc = {
  callerId: string;
  calleeId: string;
  callerName: string;
  calleeName: string;
  type: CallType;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  callerCandidates?: RTCIceCandidateInit[];
  calleeCandidates?: RTCIceCandidateInit[];
  status?: CallStatus;
  createdAt?: number;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function CallControls({ user, selected }: Props) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const remote = useRef<MediaStream | null>(null);
  const callId = useRef("");
  const callListener = useRef<(() => void) | null>(null);
  const callStatus = useRef<CallStatus>("connecting");
  const seenRemoteCandidates = useRef(new Set<string>());
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);

  const [incoming, setIncoming] = useState<CallDoc | null>(null);
  const [incomingId, setIncomingId] = useState("");
  const [active, setActive] = useState<CallType | null>(null);
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");

  const updateStatus = (next: CallStatus) => {
    callStatus.current = next;
    setStatus(next);
  };

  const cleanup = () => {
    callListener.current?.();
    callListener.current = null;
    pc.current?.close();
    pc.current = null;
    local.current?.getTracks().forEach((track) => track.stop());
    local.current = null;
    remote.current?.getTracks().forEach((track) => track.stop());
    remote.current = null;
    callId.current = "";
    seenRemoteCandidates.current.clear();
    setLocalStream(null);
    setRemoteStream(null);
    setActive(null);
    updateStatus("connecting");
    setMuted(false);
    setCamera(true);
  };

  useEffect(() => {
    if (localVideo.current && localStream) localVideo.current.srcObject = localStream;
    if (remoteVideo.current && remoteStream) remoteVideo.current.srcObject = remoteStream;
    if (remoteAudio.current && remoteStream) remoteAudio.current.srcObject = remoteStream;
  }, [localStream, remoteStream, active]);

  useEffect(() => {
    if (!user || !selected) return;
    const q = query(collection(db, "calls"), where("calleeId", "==", user.uid), where("status", "==", "ringing"));
    return onSnapshot(q, (snapshot) => {
      const call = snapshot.docs[0];
      if (call && !active) {
        setIncoming(call.data() as CallDoc);
        setIncomingId(call.id);
      }
    }, () => {});
  }, [user, selected, active]);

  useEffect(() => () => cleanup(), []);

  const applyRemoteCandidates = async (connection: RTCPeerConnection, candidates: RTCIceCandidateInit[]) => {
    if (!connection.remoteDescription) return;
    for (const candidate of candidates) {
      const key = JSON.stringify(candidate);
      if (seenRemoteCandidates.current.has(key)) continue;
      seenRemoteCandidates.current.add(key);
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // A stale ICE candidate can safely be ignored.
      }
    }
  };

  const start = async (type: CallType) => {
    if (!user || !selected || active) return;
    try {
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Your browser does not support microphone/camera calls.");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      local.current = stream;
      setLocalStream(stream);

      const connection = new RTCPeerConnection(rtcConfig);
      pc.current = connection;
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));

      const ref = doc(collection(db, "calls"));
      callId.current = ref.id;
      connection.onicecandidate = (event) => {
        if (event.candidate) void setDoc(ref, { callerCandidates: arrayUnion(event.candidate.toJSON()) }, { merge: true });
      };
      connection.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          remote.current = stream;
          setRemoteStream(stream);
        }
      };

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await setDoc(ref, {
        callerId: user.uid,
        calleeId: selected.uid,
        callerName: user.uid,
        calleeName: selected.username,
        type,
        offer,
        status: "ringing",
        callerCandidates: [],
        calleeCandidates: [],
        createdAt: Date.now(),
      });

      setActive(type);
      updateStatus("ringing");

      const unsubscribe = onSnapshot(ref, (snapshot) => {
        const data = snapshot.data() as CallDoc | undefined;
        if (!data || !pc.current) return;
        if (data.status === "ended") {
          cleanup();
          return;
        }
        if (data.answer && !connection.currentRemoteDescription) {
          void connection.setRemoteDescription(new RTCSessionDescription(data.answer))
            .then(() => applyRemoteCandidates(connection, data.calleeCandidates || []))
            .then(() => updateStatus("connected"))
            .catch(() => setError("Could not connect the call."));
        } else if (data.calleeCandidates?.length) {
          void applyRemoteCandidates(connection, data.calleeCandidates);
        }
      });
      callListener.current = unsubscribe;
      window.setTimeout(() => {
        if (callId.current === ref.id && callStatus.current !== "connected") {
          void setDoc(ref, { status: "ended" }, { merge: true });
          cleanup();
        }
      }, 300000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start call.");
      cleanup();
    }
  };

  const accept = async () => {
    if (!user || !incoming || !incomingId) return;
    try {
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Your browser does not support microphone/camera calls.");

      const type = incoming.type;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      local.current = stream;
      setLocalStream(stream);

      const connection = new RTCPeerConnection(rtcConfig);
      pc.current = connection;
      callId.current = incomingId;
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));
      const ref = doc(db, "calls", incomingId);

      connection.onicecandidate = (event) => {
        if (event.candidate) void setDoc(ref, { calleeCandidates: arrayUnion(event.candidate.toJSON()) }, { merge: true });
      };
      connection.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          remote.current = stream;
          setRemoteStream(stream);
        }
      };

      await connection.setRemoteDescription(new RTCSessionDescription(incoming.offer!));
      await applyRemoteCandidates(connection, incoming.callerCandidates || []);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      await setDoc(ref, { answer, status: "connected" }, { merge: true });
      setIncoming(null);
      setIncomingId("");
      setActive(type);
      updateStatus("connected");

      callListener.current = onSnapshot(ref, (snapshot) => {
        const data = snapshot.data() as CallDoc | undefined;
        if (data?.status === "ended") cleanup();
        if (data?.callerCandidates?.length && pc.current) void applyRemoteCandidates(pc.current, data.callerCandidates);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept call.");
      cleanup();
    }
  };

  const reject = async () => {
    if (incomingId) await setDoc(doc(db, "calls", incomingId), { status: "ended" }, { merge: true });
    setIncoming(null);
    setIncomingId("");
  };

  const end = async () => {
    if (callId.current) await setDoc(doc(db, "calls", callId.current), { status: "ended" }, { merge: true });
    cleanup();
  };

  if (!user || !selected) return null;

  return <>
    <div className="call-actions">
      <button title="Voice call" aria-label="Start voice call" onClick={() => void start("voice")}>📞</button>
      <button title="Video call" aria-label="Start video call" onClick={() => void start("video")}>🎥</button>
    </div>

    {incoming && <div className="call-overlay">
      <div className="call-card incoming-call-card">
        <div className="call-avatar">{incoming.type === "video" ? "🎥" : "📞"}</div>
        <b>Incoming {incoming.type} call</b>
        <small>@{incoming.callerName || "ChatOnlineMe user"} is calling you.</small>
        <div>
          <button className="accept" onClick={() => void accept()}>Accept</button>
          <button className="reject" onClick={() => void reject()}>Decline</button>
        </div>
      </div>
    </div>}

    {active && <div className="call-overlay">
      <div className={`call-card active-call ${active === "video" ? "video-call-card" : "voice-call-card"}`}>
        {active === "video" ? <div className="video-stage">
          <video ref={remoteVideo} className="remote-video" autoPlay playsInline />
          <video ref={localVideo} className="local-video" autoPlay muted playsInline />
        </div> : <audio ref={remoteAudio} autoPlay />}
        <div className="call-avatar">{active === "video" ? "🎥" : "📞"}</div>
        <b>{active === "video" ? "Video" : "Voice"} call</b>
        <small>{status === "ringing" ? "Calling…" : status === "connected" ? "Connected" : "Connecting…"}</small>
        <div className="call-controls">
          <button onClick={() => { local.current?.getAudioTracks().forEach((track) => { track.enabled = muted; }); setMuted(!muted); }}>{muted ? "🔇" : "🎙️"}</button>
          {active === "video" && <button onClick={() => { local.current?.getVideoTracks().forEach((track) => { track.enabled = !camera; }); setCamera(!camera); }}>{camera ? "📷" : "🚫"}</button>}
          <button className="reject" onClick={() => void end()}>☎ End</button>
        </div>
      </div>
    </div>}

    {error && <div className="toast error">{error}</div>}
  </>;
}
