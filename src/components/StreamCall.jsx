import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import io from "socket.io-client";

function StreamCall() {
  const { call_type, call_mode } = useParams();
  const query = new URLSearchParams(useLocation().search);

  const [callState, setCallState] = useState("idle");
  const [callId, setCallId] = useState(null);
  const [loginStatusCallbackId, setLoginStatusCallbackId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [basedataid, setBaseDataID] = useState(null);
  let dataid = null
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const userInfo = {
    username: "becamex2",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };

  const params = {
    hookFlag: query.get("hookFlag"),
    duplexFlag: query.get("duplexFlag"),
    basedata_id: query.get("basedata_id"),
    listen_flag: query.get("listen_flag"),
    call_id: query.get("call_id"),
  };

  let answerAckGuid = null;
  let mediaStreamGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;

  const handleLogin = async () => {
    try {
      console.log("%%% Attempting login...");
      const resp = await window.lemon.login.login(userInfo);
        if (resp.result !== 0) {
        console.log("%%% Login failed, retrying...");
        handleLogin()
        } else {
        console.log("%%% Login successful");
        }
    } catch (error) {
      console.error("%%% Login error:", error);
    }
    console.log("%%% Logged in successfully");
  };

  const handleEndCall = async (callInfo) => {
    console.log("Ending call...", callInfo);
    if (callInfo?.disconnect_reason === 0) {
      await hangupCall(callInfo.call_id);
      teardownCallHandlers();
    }
  };

  const setupCallHandlers = async () => {
    window.lemon.call.addAnswerAckEvt(() => setCallState("talking"));
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
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (hangupEvtGuid) {
      window.lemon.call.removeHangupEvt(hangupEvtGuid);
    }
    if (forceHangupEvtGuid) {
      window.lemon.call.removeForceHangupEvt(forceHangupEvtGuid);
    }
    if (mediaStreamGuid) {
      lemon.call.removeMediaStream(mediaStreamGuid);
    }
  };
  const handleAnswerCall = async () => {
    if (!params.call_id) return console.error("No incoming call");
    try {
      await window.lemon.call.answerCall({
        call_id: params.call_id,
        duplex_flag: params.duplexFlag,
        listen_flag: params.listen_flag,
      });
      console.log("Call answered successfully");
    } catch (error) {
      console.error("Error answering call:", error);
    }
  };

  const hangupCall = async (callId) => {
    if (!callId) return;
    try {
      await window.lemon.call.hangupCall({ call_id: callId });
      setCallState("stopping");
      setCallId(null);
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  const handleLoginStatusChange = async (loginStatus) => {
    if ([0, 2, 3].includes(loginStatus.login_status)) {
      console.log("%%% Login status changed", dataid, sessionStorage.getItem("basedata_id"));
      if (dataid === sessionStorage.getItem("basedata_id")) {
        console.log("Starting call...");
        await handleLogin();
        await setupCallHandlers();
        setCallState("calling");
        setTimeout(restartVideoCall, 1000);
      }
    }
  };
  function startCallSession() {
    if (call_mode === "0") {
        initiateCall();
    } else if (call_mode === "1") {
        handleAnswerCall();
    }
  }
  function setupSocket() {
    const newSocket = io("http://192.168.101.3:6173");
    setSocket(newSocket);
    newSocket.on("connect", () => console.log("✅ WebSocket Connected"));
    
    newSocket.on("call", async (offer) => {
        let _basedata_id = offer.basedata_id
        console.log("%%% 📥 Received OFFER:", offer);
        setBaseDataID(_basedata_id);
        dataid = _basedata_id
        if (_basedata_id === params.basedata_id) {
            startCallSession()
        } else if (_basedata_id === null) {
            startCallSession()
            setCallState("disconnecting");
            newSocket.emit('call', { status:"call", basedata_id: params.basedata_id });

        } else {
            logout();
        }
      });
    newSocket.emit('call', { status:"call", basedata_id: params.basedata_id });
  }
    useEffect(() => {
      console.log("%%% init media")
        setupSocket()   
        // let media = navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // console.log("%%% media", media)
    }, []);

  useEffect(() => {
    sessionStorage.setItem("basedata_id", params.basedata_id);
    setBaseDataID(params.basedata_id);
    dataid = params.basedata_id
    startCallSession()
    const loginStatusCallbackId = window.lemon.login.addLoginStatusChangeListener(
      handleLoginStatusChange
    );

    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
      if (socket) {
        socket.emit('call', { status:"idle", basedata_id: null });
      }
     
      logout();
    };
  }, []);
  
  window.onbeforeunload = () => {
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
    if (socket) {
        socket.emit('call', { status:"idle", basedata_id: null });
    }
    logout();
  };

  const initiateCall = async () => {
    console.log("Starting call...");
    await handleLogin();
    await setupCallHandlers();
    setCallState("calling");
    setTimeout(startVideoCall, 1000);
  };
  const restartVideoCall = async () => {
    try {
        const resp = await window.lemon.call.makeVideoCall({
          basedata_id: params.basedata_id,
          video_frame_size: 3,
          hook_flag: 0,
        });
        setCallId(resp.call_id);
        if (params.hookFlag === "1") setCallState("waiting");
      } catch (error) {
        console.error("Call initiation failed", error);
        setTimeout(initiateCall, 1000);
      }
  }

  const startVideoCall = async () => {
    try {
      const resp = await window.lemon.call.makeVideoCall({
        basedata_id: params.basedata_id,
        video_frame_size: 3,
        hook_flag: +params.hookFlag,
      });
      setCallId(resp.call_id);
      if (params.hookFlag === "1") setCallState("waiting");
    } catch (error) {
      console.error("Call initiation failed", error);
      setTimeout(initiateCall, 1000);
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
  console.log("%% callState", callState);
  return (
    <div className="flex items-center justify-center h-screen bg-black relative w-full">
      {callState === "idle" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Connecting...</h1>}
      {callState === "calling" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Calling...</h1>}
      {callState === "stopping" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Stopped...</h1>}
      {callState === "waiting" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Waiting...</h1>}
      {callState === "disconnecting" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Disconnecting...</h1>}

      <video ref={remoteVideoRef} crossOrigin="anonymous" autoPlay playsInline className="w-full h-full object-cover" />
      <audio ref={remoteAudioRef} crossOrigin="anonymous" autoPlay />

    </div>
  );
}

export default StreamCall;
