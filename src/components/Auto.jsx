import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";

function AutoLogin() {
  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };
  const [incomingCall, setIncomingCall] = useState(null);
  const [embeddedCallId, setEmbeddedCallId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [event_status, setEventStatus] = useState("idle");
  let eventStatus = "idle";
  const hookFlag = 0;
  const duplexFlag = 1;
  const call_type = "video";
  let incomingEvtGuid = null;
  let answerAckGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;
  let deviceList = {}
  const attemptLogin = async () => {
    console.log("Attempting login");
    try {
      const response = await window.lemon.login.login(userInfo);
      if (response.result !== 0) {
        console.log("Login failed, retrying...");
        setTimeout(attemptLogin, 1000);
      } else {
        console.log("Login successful");
        await handleFetchDeviceList();
      }
    } catch (error) {
      console.log("Login error, retrying...");
      setTimeout(attemptLogin, 1000);
    }
  };
  const handleIncomingCall = async (incomingInfo) => {
    console.log("Calling from:", incomingInfo);
    if ([0, 2].includes(incomingInfo.attribute.call_mode)) {
      setIncomingCall(incomingInfo);
    }
  };

  const attemptLogout = async () => {
    console.log("Logging out");
    await window.lemon.login.logout();
  };

  const handleLoginStatusChange = (loginStatus) => {
    console.log("Login status changed", loginStatus);
    if ([0, 2, 3].includes(loginStatus.login_status)) {
      console.log("%%% Login status changed", eventStatus);
      if (eventStatus === "idle") {
        attemptLogin();
      }
    }
  };
  async function handleFetchDeviceList() {
    try {
      const resp = await window.lemon.basedata.fetchDeviceList({
        page_size: 200,
        page_index: 1,
      });

      if (!resp.device_list) {
        console.warn("%% No devices found");
        return;
      }

      const newDeviceList = resp.device_list.reduce((acc, device) => {
        acc[device.alias] = {
          basedata_id: device.basedata_id,
          number: device.number,
        };
        return acc;
      }, {});
      deviceList = newDeviceList
    } catch (error) {
      console.error("Error fetching device list:", error);
    }
  }
  const handleEndCall = async () => {
    console.log("Ending call");
    setEmbeddedCallId(null);
    setIncomingCall(null);
  };
  function teardownCallHandlers() {
    if (hangupEvtGuid) {
      window.lemon.call.removeHangupEvt(hangupEvtGuid);
    }
    if (forceHangupEvtGuid) {
      window.lemon.call.removeForceHangupEvt(forceHangupEvtGuid);
    }

    if (incomingEvtGuid) {
      window.lemon.call.removeIncomingEvt(incomingEvtGuid);
    }
    if (answerAckGuid) {
      window.lemon.call.removeAnswerAckEvt(answerAckGuid);
    }
  }
  function setupSocket() {
    const newSocket = io("http://192.168.101.3:6173");
    setSocket(newSocket);
    newSocket.on("connect", () => console.log("✅ WebSocket Connected"));
    newSocket.on("call.offer", async (offer) => {
        console.log("%%% ✅ Received call offer:", offer);
        let alias = offer.deviceId;
        console.log("%%% alias:", alias);
        let basedata_id = deviceList[alias].basedata_id;
        if (!basedata_id) {
            console.error("%%% basedata_id not found");
            newSocket.emit("call.answer", {
              "url": "",
              "statusCode": 404,
              "msg": "basedata_id not found",
          });
        } else {
          console.log("%%% basedata_id:", basedata_id);
          newSocket.emit("call.answer", {
              "url": `http://192.168.101.3:8173/stream/${call_type}/0?hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${basedata_id}`,
              "statusCode": 200,
              "msg": "success",
          });
        }

    });
    newSocket.on("call", async (offer) => {
        let status = offer.status;
        console.log("%% call status:", status);
        if (status === "call") {
            setEventStatus("call");
            eventStatus = "call";
            attemptLogout();
        } else if (status === "idle") {
            setEventStatus("idle");
            eventStatus = "idle";
            attemptLogin();
        }
    });

    newSocket.emit("call", {
        status: "idle",
        basedata_id: null,
    })
  }

  useEffect(() => {
    setupSocket()   
  }, []);
  useEffect(() => {
    incomingEvtGuid = window.lemon.call.addIncomingEvt(handleIncomingCall);
    answerAckGuid = window.lemon.call.addAnswerAckEvt(() =>
      setEmbeddedCallId(null)
    );
    hangupEvtGuid = window.lemon.call.addHangupEvt(handleEndCall);
    forceHangupEvtGuid = window.lemon.call.addForceHangupEvt(handleEndCall);
    const loginStatusCallbackId =
      window.lemon.login.addLoginStatusChangeListener(handleLoginStatusChange);

    attemptLogin();

    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
      teardownCallHandlers();
      attemptLogout();
    };
  }, []);
  useEffect(() => {
    console.log("%% deviceList changed", deviceList);

    return () => {};
  }, [deviceList]);

  window.onbeforeunload = () => {
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
    window.lemon.call.removeIncomingEvt(incomingEvtGuid);
    window.lemon.call.removeAnswerAckEvt(answerAckGuid);
    attemptLogout();
  };

  // useEffect(() => {
  //   const handleStorageChange = (event) => {
  //     if (event.key === "basedata_id") {
  //       console.log("basedata_id changed:", event.newValue);
  //       if (!event.newValue) {
  //         console.log("basedata_id removed, reattempting login");
  //         attemptLogin();
  //       } else {
  //         console.log("basedata_id updated, logging out");
  //         attemptLogout();
  //       }
  //     }
  //   };

  //   window.addEventListener("storage", handleStorageChange);
  //   return () => {
  //     window.removeEventListener("storage", handleStorageChange);
  //   };
  // }, []);

  const handleAnswerCall = async () => {
    console.log("Answering call", callId);
    console.log("incomingCall call", incomingCall);
    let duplex_flag = incomingCall.attribute.duplex_flag;
    let listen_flag = incomingCall.listen_flag;
    let caller_alias = incomingCall.caller_alias;
    let callId = incomingCall.call_id;
    try {
      setEmbeddedCallId(`http://192.168.101.3:8173/stream/video/1?duplex_flag=${duplex_flag}&listen_flag=${listen_flag}&call_id=${callId}&caller_alias=${caller_alias}`);
    } catch (error) {
      console.error("Error answering call", error);
    }
  }

  return <>
  <h1>Auto Login</h1> 
  {
    incomingCall && (
      <div>
        <p>Cuộc gọi đến từ: {incomingCall.caller_number}</p>
        <input type="text" value={embeddedCallId} />
        <button
          onClick={() => handleAnswerCall()}
        >
          Trả lời
        </button>
        {/* <button onClick={async () => await handleHangup(currentCallId)}>
      Tắt cuộc gọi
    </button> */}
      </div>)
  }
  </>;
}

export default AutoLogin;
