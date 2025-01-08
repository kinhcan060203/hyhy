import React, { useEffect, useState, useRef } from "react";
function Call() {
  const [callState, setCallState] = useState("normal");

  const [currentCallId, setCurrentCallId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [hookFlag, setHookFlag] = useState(1);
  const [duplexFlag, setDuplexFlag] = useState(1);
  const [modeCall, setModeCall] = useState(0);
  const localStream = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  let incomingEvtGuid = null;
  let answerAckGuid = null;
  let mediaStreamGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;
  const basedata_id =
    "fd88c15f15d090841a29b5be71c004f0dc0bd25957a527a2fbc7442e92622fd0";

  const basedataId_forward = "00082-890-2023020706-0--mcs.com";

  function setupCallHandlers() {
    incomingEvtGuid = window.lemon.call.addIncomingEvt(handleIncomingCall);
    answerAckGuid = window.lemon.call.addAnswerAckEvt(() =>
      setCallState("talking")
    );
    const handleMediaStream = (callId, stream, type) => {
      console.log("@type", type);
      if (type === "video_src" && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      } else if (type === "video_dst" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      } else if (type === "audio_dst" && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    };
    const onForceHangupEvt = (hangupInfo) => {};
    const onHangupEvt = async (hangupInfo) => {
      console.log("ngắt cuộc gọi:", hangupInfo);
      setCurrentCallId(null);
      setIncomingCall(null);
      setCallState("normal");
      localVideoRef.current.srcObject = null;
      remoteVideoRef.current.srcObject = null;
      remoteAudioRef.current.srcObject = null;
      if (localStream.current) {
        localStream.current.getTracks().forEach(function (track) {
          track.stop();
        });
      }
    };
    mediaStreamGuid = lemon.call.addMediaStream(handleMediaStream);
    hangupEvtGuid = window.lemon.call.addHangupEvt(onHangupEvt);
    forceHangupEvtGuid = window.lemon.call.addForceHangupEvt(onForceHangupEvt);
  }

  function teardownCallHandlers() {
    if (hangupEvtGuid) {
      window.lemon.call.removeHangupEvt(hangupEvtGuid);
    }
    if (forceHangupEvtGuid) {
      window.lemon.call.removeForceHangupEvt(forceHangupEvtGuid);
    }
    if (mediaStreamGuid) {
      lemon.call.removeMediaStream(mediaStreamGuid);
    }
    if (incomingEvtGuid) {
      window.lemon.call.removeIncomingEvt(incomingEvtGuid);
    }
    if (answerAckGuid) {
      window.lemon.call.removeAnswerAckEvt(answerAckGuid);
    }
  }

  const handleIncomingCall = async (incomingInfo) => {
    console.log("Cuộc gọi đến:", incomingInfo);

    if ([0, 2].includes(incomingInfo.attribute.call_mode)) {
      setIncomingCall(incomingInfo);
      setCurrentCallId(incomingInfo.call_id);
      setCallState("calling");
    }
  };

  useEffect(() => {
    setupCallHandlers();
    return () => {
      teardownCallHandlers();
    };
  }, []);

  async function handleHangup(callId) {
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

  async function handleMakeVoiceCall() {
    setCallState("calling");
    await window.lemon.call
      .makeVoiceCall({
        basedata_id: basedata_id,
        duplex_flag: duplexFlag,
        hook_flag: hookFlag,
      })
      .then(async (resp) => {
        setCurrentCallId(resp.call_id);
      })
      .catch((err) => {
        console.error(err);
        setCallState("normal");
      });
  }

  async function handleMakeVideoCall() {
    setCallState("calling");
    await window.lemon.call
      .makeVideoCall({
        basedata_id: basedata_id,
        video_frame_size: 3,
        hook_flag: hookFlag,
      })
      .then(async (resp) => {
        console.log("GOi ne", resp);
        setCurrentCallId(resp.call_id);
        if (modeCall === 2) {
          await setLocalVideo();
        }
      })
      .catch((err) => {
        console.error(err);
        setCallState("normal");
      });
  }
  async function setLocalVideo() {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideoRef.current.srcObject = localStream.current;
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
      setIncomingCall(null);
    } catch (error) {
      console.error("Lỗi khi trả lời cuộc gọi:", error);
    }
  }
  async function forwardCall(basedataId, callId, action = 0) {
    try {
      const result = await lemon.call.forwardVideoCall({
        basedata_id: basedataId,
        call_id: callId,
        action: action,
      });
      console.log("Chuyển tiếp cuộc gọi thành công:", result);
    } catch (error) {
      console.error("Lỗi khi chuyển tiếp cuộc gọi:", error);
    }
  }
  console.log("incomingCall", incomingCall);
  return (
    <div>
      <select
        className="mb-10 block w-[100%] p-2"
        value={hookFlag}
        onChange={(e) => setHookFlag(+e.target.value)}
      >
        <option value="0">Call Auto</option>
        <option value="1">Call Manual</option>
      </select>
      <select
        className="mb-10 block w-[100%] p-2"
        value={modeCall}
        onChange={(e) => setModeCall(+e.target.value)}
      >
        <option value="0">Call Voice</option>
        <option value="2">Call Video</option>
      </select>

      {modeCall === 0 && (
        <select
          className="mb-10 block w-[100%] p-2"
          value={duplexFlag}
          onChange={(e) => setDuplexFlag(+e.target.value)}
        >
          <option value="0">Half Duplex</option>
          <option value="1">Full Duplex</option>
        </select>
      )}

      <button
        onClick={
          callState === "normal"
            ? modeCall === 0
              ? async () => await handleMakeVoiceCall()
              : async () => await handleMakeVideoCall()
            : null
        }
      >
        Gọi
      </button>
      {/* <VoiceCallComponent /> */}
      <button onClick={async () => await handleHangup(currentCallId)}>
        Tắt cuộc gọi
      </button>

      <div>
        <h1>{modeCall === 0 ? "Voice" : "Video"} Call</h1>
        <audio ref={remoteAudioRef} autoPlay />
        <video ref={localVideoRef} autoPlay width="300px" />
        <video ref={remoteVideoRef} autoPlay width="300px" />
      </div>
      <div>
        {callState === "calling" &&
          (incomingCall ? (
            <div>
              <p>Cuộc gọi đến từ: {incomingCall.caller_number}</p>
              <button
                onClick={() => handleAnswerCall(incomingCall.call_id, 1, 0)}
              >
                Trả lời
              </button>
              {/* <button onClick={async () => await handleHangup(currentCallId)}>
            Tắt cuộc gọi
          </button> */}
            </div>
          ) : (
            <h4>calling...</h4>
          ))}
        {callState === "talking" && <div>Call is processing...</div>}
      </div>
    </div>
  );
}

export default Call;
