import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

function StreamCall() {
  const { call_type, basedata_id, hookFlag, duplexFlag } = useParams();
  const [callState, setCallState] = useState("normal");
  const [rtoken, setToken] = useState(null);
  const [callId, setCallId] = useState(null);
  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  let answerAckGuid = null;
  let mediaStreamGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;
  const [loginStatusCallbackId, setLoginStatusCallbackId] = useState(null);

  const handleEndCall = async () => {
    setCallState("normal");
    console.log("%%%%% End call");
    await handleHangup(callId);
    teardownCallHandlers();
    // window.close();
    handleLogout();

  };
  async function setupCallHandlers() {
    answerAckGuid = window.lemon.call.addAnswerAckEvt(() =>
      setCallState("talking")
    );
    const handleMediaStream = (callId, stream, type) => {
      if (type === "video_src" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      } else if (type === "video_dst" && remoteVideoRef.current) {
        console.log(remoteVideoRef);
        remoteVideoRef.current.srcObject = stream;
      } else if (type === "audio_dst" && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };

    // const onForceHangupEvt = (hangupInfo) => {
    //   console.log("ngắt cuộc gọi:", hangupInfo);
    //   handleEndCall();
    // };
    // const onHangupEvt = async (hangupInfo) => {
    //   console.log("ngắt cuộc gọi:", hangupInfo);
    //   handleEndCall();
    // };
    mediaStreamGuid = window.lemon.call.addMediaStream(handleMediaStream);  
    hangupEvtGuid = window.lemon.call.addHangupEvt(onHangupEvt);
    forceHangupEvtGuid = window.lemon.call.addForceHangupEvt(onForceHangupEvt);
  }
  function teardownCallHandlers() {
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
  }
  const handleLogin = () => {
    console.log("Attempting relogin");
    window.lemon.login
      .login(userInfo)
      .then((resp) => {
        console.log(resp);
        if (resp.result !== 0) {
          console.log("Login failed");
          handleLogin();
        } else {
          console.log("Login success");
        }
      })
      .catch((err) => {
        handleLogin();
      });
  };
  async function handleHangup() {
    console.log("Ngắt cuộc gọi:", callId);
    try {
      setCallState("normal");
      await window.lemon.call
        .hangupCall({ call_id: callId })
        .then((res) => {
          console.log("Cuộc gọi đã ngắt thành công:", res);
        })
        .catch((err) => {
          console.error(err);
        });
    } catch (error) {
      console.error("Lỗi khi ngắt cuộc gọi:", error, callId);
    }
  }
  const handleUnload = () => {
    localStorage.removeItem("basedata_id");
    console.log("%%%%% Remove token");

  };
  const onLoginStatusChange = (loginStatus) => {
    console.log("Login status changed", loginStatus);
    if (
      loginStatus.login_status === 0 ||
      loginStatus.login_status === 2 ||
      loginStatus.login_status === 3
    ) {
    let token = localStorage.getItem("basedata_id");
    console.log("@@@###",sessionStorage.getItem("basedata_id"), localStorage.getItem("basedata_id") === sessionStorage.getItem("basedata_id"));


    if (token === sessionStorage.getItem("basedata_id")) {
      handleLogin();
    }
}};

  useEffect(() => {
    sessionStorage.setItem("basedata_id", basedata_id);
    handleMakeVideoCall();
    console.log("%%%%% Set ok token", localStorage.getItem("basedata_id"));
    window.addEventListener("beforeunload", handleUnload);
    return () => {
        window.removeEventListener("beforeunload", handleUnload);
        if (loginStatusCallbackId) {
        window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
        handleEndCall();
        }

    };
  }, [basedata_id]);
  window.onbeforeunload = function() {
    localStorage.removeItem("basedata_id");

    return '';
  };
  async function VideoCall() {
    await window.lemon.call
      .makeVideoCall({
        basedata_id: basedata_id,
        video_frame_size: 3,
        hook_flag: +hookFlag,
      })
      .then(async (resp) => {
        console.log("Call ok", resp);
        setCallId(resp.call_id);
      })
      .catch((err) => {
        console.error("Call failed", err);
      });
  }
  async function handleMakeVideoCall() {

    let loginStatusId = 
    window.lemon.login.addLoginStatusChangeListener(onLoginStatusChange);
    setLoginStatusCallbackId(loginStatusId);
    console.log("%%%%% Set token");
    localStorage.setItem("basedata_id", basedata_id);
    console.log("%%%%% Login");
    handleLogin();
    console.log("%%%%% Make call");
    // await setupCallHandlers();
    // setCallState("calling");
    // VideoCall();
  }
  async function handleAnswerCall(callId, duplex_flag, listen_flag) {
    try {
      if (callId === null) {
        console.error("Không có cuộc gọi nào đến");
        return;
      }
      const res = await window.lemon.call.answerCall({
        call_id: callId,
        duplex_flag: duplex_flag,
        listen_flag: listen_flag,
      });
      console.log("Trả lời cuộc gọi thành công:", res);
    } catch (error) {
      console.error("Lỗi khi trả lời cuộc gọi:", error);
    }
  }
  window.addEventListener("storage", (event) => {
    if (event.key === "basedata_id") {
      console.log("Token đã thay đổi:", event.newValue);
      if (event.newValue !== sessionStorage.getItem("basedata_id")) {
        console.log("Token khong trung nhau, logout");
        window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
        handleEndCall();
      } 
    }
  });
  async function handleLogout() {
    const res = await window.lemon.login.logout();
    console.log(res);
  }
  return (
    <div className="flex items-center justify-center h-screen bg-black relative h-100 w-100">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <audio ref={remoteAudioRef} autoPlay />
      <button
        onClick={
            handleMakeVideoCall
        }
        className="absolute bottom-5 left-5 transform bg-blue-400 text-white px-6 py-2 rounded-lg text-lg font-bold shadow-lg"
      >
        Start Call
      </button>
      <button
        onClick={handleEndCall}
        className="absolute bottom-5 right-5 transform bg-blue-400 text-white px-6 py-2 rounded-lg text-lg font-bold shadow-lg"
      >
        End Call
      </button>
    </div>
  );
}

export default StreamCall;
