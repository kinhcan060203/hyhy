import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const Sender = () => {
  const [socket, setSocket] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    const newSocket = io("http://localhost:5000"); // Kết nối đến Flask signaling server
    setSocket(newSocket);
    // check if connected
    newSocket.on("connect", () => {
      console.log("🔗 Connected to signaling server");
    });

    newSocket.on("answer", async (answer) => {
      console.log("📥 Nhận ANSWER:", answer);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    });

    newSocket.on("ice-candidate", async (candidate) => {
      console.log("📥 Nhận ICE Candidate:", candidate);
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    return () => newSocket.disconnect();
  }, []);

  const createPeerConnection = (socket) => {
    const ICE_SERVERS = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ]
    
    const config = { iceServers: ICE_SERVERS };
    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // console.log("🧊 ICE Candidate:", event.candidate);
        socket.emit("ice-candidate", event.candidate);
      }
    };

    return pc;
  };

  const startCall = async () => {
    if (!socket) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideoRef.current.srcObject = stream;

    const pc = createPeerConnection(socket);
    stream.getTracks().forEach((track) => {
      console.log(track);
      pc.addTrack(track, stream);
    });
    console.log("Local Tracks:", stream.getTracks());

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("offer", offer);
    setPeerConnection(pc);
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold">WebRTC Video Call</h2>
      <div className="grid grid-cols-2 gap-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          className="border rounded-lg shadow-lg"
        />

      </div>
      <button
        onClick={startCall}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md"
      >
        Bắt đầu cuộc gọi
      </button>
    </div>
  );
};

export default Sender;
