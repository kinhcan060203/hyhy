import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

function StreamCall() {
  const { call_type, basedata_id, hookFlag, duplexFlag } = useParams();
  const [callState, setCallState] = useState("idle");
  const [callId, setCallId] = useState(null);
  const [loginStatusCallbackId, setLoginStatusCallbackId] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  let answerAckGuid = null;
  let mediaStreamGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;

  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };

  const login = async () => {
    try {
      console.log("Attempting login...");
      const resp = await window.lemon.login.login(userInfo);
      if (resp.result !== 0) {
        console.log("Login failed, retrying...");
        await login();
      } else {
        console.log("Login successful");
      }
    } catch (error) {
      console.error("Login error:", error);
      await login();
    }
  };

  const handleEndCall = async () => {
    setCallState("idle");
    console.log("Ending call...");
    await hangupCall();
    teardownCallHandlers();
    await logout();
  };

  const setupCallHandlers = async () => {
    answerAckGuid = window.lemon.call.addAnswerAckEvt(() =>
      setCallState("talking")
    );

    mediaStreamGuid = window.lemon.call.addMediaStream(
      (callId, stream, type) => {
        if (type === "video_src" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        } else if (type === "video_dst" && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        } else if (type === "audio_dst" && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
      }
    );

    hangupEvtGuid = window.lemon.call.addHangupEvt(handleEndCall);
    forceHangupEvtGuid = window.lemon.call.addForceHangupEvt(handleEndCall);
  };

  const teardownCallHandlers = () => {
    [localVideoRef, remoteVideoRef, remoteAudioRef].forEach((ref) => {
      if (ref.current) ref.current.srcObject = null;
    });

    [hangupEvtGuid, forceHangupEvtGuid, mediaStreamGuid].forEach((guid) => {
      if (guid) window.lemon.call.removeEvent(guid);
    });
  };

  const hangupCall = async () => {
    if (!callId) return;
    try {
      console.log("Hanging up call", callId);
      await window.lemon.call.hangupCall({ call_id: callId });
      setCallId(null);
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  const handleLoginStatusChange = async (loginStatus) => {
    console.log("Login status changed", loginStatus);
    if ([0, 2, 3].includes(loginStatus.login_status)) {
      let token = localStorage.getItem("basedata_id");
      if (token === sessionStorage.getItem("basedata_id")) {
        await login();
      }
    }
  };

  useEffect(() => {
    sessionStorage.setItem("basedata_id", basedata_id);
    const loginStatusId = window.lemon.login.addLoginStatusChangeListener(
      handleLoginStatusChange
    );
    setLoginStatusCallbackId(loginStatusId);

    initiateCall();

    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
      handleEndCall();
    };
  }, [basedata_id]);

  window.onbeforeunload = () => {
    localStorage.removeItem("basedata_id");
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
    handleEndCall();
  };

  const initiateCall = async () => {
    localStorage.setItem("basedata_id", basedata_id);
    await login();
    await setupCallHandlers();
    setCallState("calling");
    await startVideoCall();
  };

  const startVideoCall = async () => {
    try {
      const resp = await window.lemon.call.makeVideoCall({
        basedata_id,
        video_frame_size: 3,
        hook_flag: +hookFlag,
      });
      console.log("Call initiated successfully", resp);
      setCallId(resp.call_id);
    } catch (error) {
      console.error("Call initiation failed", error);
    }
  };

  const answerCall = async (callId, duplex_flag, listen_flag) => {
    if (!callId) return console.error("No incoming call to answer");
    try {
      const response = await window.lemon.call.answerCall({
        call_id: callId,
        duplex_flag,
        listen_flag,
      });
      console.log("Call answered successfully", response);
    } catch (error) {
      console.error("Error answering call", error);
    }
  };

  const logout = async () => {
    try {
      const response = await window.lemon.login.logout();
      console.log("Logged out successfully", response);
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-black relative w-full">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <audio ref={remoteAudioRef} autoPlay />
      <button
        onClick={initiateCall}
        className="absolute bottom-5 left-5 bg-blue-400 text-white px-6 py-2 rounded-lg shadow-lg"
      >
        Start Call
      </button>
      <button
        onClick={handleEndCall}
        className="absolute bottom-5 right-5 bg-red-400 text-white px-6 py-2 rounded-lg shadow-lg"
      >
        End Call
      </button>
    </div>
  );
}

export default StreamCall;
