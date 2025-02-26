import React, { useEffect, useState, useRef } from "react";
import io from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const Receive = () => {
  const [socket, setSocket] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const videoRef = useRef(null);
  const remoteStream = useRef(new MediaStream()); // Dùng useRef để giữ nguyên stream

  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("connect", () => console.log("✅ WebSocket Connected"));

    newSocket.on("offer", async (offer) => {
      console.log("📥 Received OFFER:", offer);

      const pc = new RTCPeerConnection(ICE_SERVERS);
      setPeerConnection(pc);

      // Gán MediaStream cho videoRef ngay từ đầu
      if (videoRef.current) {
        videoRef.current.srcObject = remoteStream.current;
      }

      pc.ontrack = (event) => {
        console.log("🎥 Receiving remote stream", event.streams);
        event.streams[0].getTracks().forEach((track) => {
          console.log("🎵 Adding track:", track.kind, track);
          remoteStream.current.addTrack(track);
        });

        // Cập nhật video
        if (videoRef.current) {
          videoRef.current.muted = false
          videoRef.current.srcObject = remoteStream.current
          console.log("🎬 VideoRef  updated", videoRef.current.srcObject.getVideoTracks());
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      newSocket.emit("answer", answer);
      console.log("📤 Sent ANSWER:", answer);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          newSocket.emit("ice-candidate", event.candidate);
        }
      };
      pc.oniceconnectionstatechange = () => {
        console.log("ICE State:", pc.iceConnectionState);
    };
    
      newSocket.on("ice-candidate", async (candidate) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("❌ Error adding ICE candidate:", error);
        }
      });
    });

    return () => {
      newSocket.disconnect();
      peerConnection?.close();
    };
  }, []);

  return (
    <div>
      <h2>🎥 Receive WebRTC Stream</h2>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        style={{ width: "100%", maxWidth: "600px", border: "2px solid black" }}
      />
    </div>
  );
};

export default Receive;
