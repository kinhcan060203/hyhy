import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import mqtt from "mqtt";
import Paho from "paho-mqtt";

function AutoLogin() {
  const userInfo = {
    username: "becamex2",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };
  const [incomingCall, setIncomingCall] = useState(null);
  const [embeddedCallId, setEmbeddedCallId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [event_status, setEventStatus] = useState("idle");
  const [devices_sub_gps, setDevicesGpsSub] = useState({});
  let mqttClientGPS = null;
  const intervalRef = useRef(null);
  const [devices_gps_map, setDevicesGpsMap] = useState({});

  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const MQTT_BROKER = "103.129.80.171";
  const MQTT_PORT = "8099";
  const MQTT_USERNAME = "securityalert";
  const MQTT_PASSWORD = "securityalert";
  const MQTT_GPS_TOPIC = "alert-security-gps";
  const MQTT_TOPIC = "alert-security-media";
  const MQTT_TOPIC_RESPONSE = "alert-security-media-response";

  let eventStatus = "idle";
  const hookFlag = 1;
  const duplexFlag = 1;
  const call_type = "video";
  let incomingEvtGuid = null;
  let answerAckGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;
  let deviceList = {};
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
      deviceList = newDeviceList;
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
    const newSocket = io("http://192.168.101.3:6173", {
      reconnection: true, // Tự động reconnect
      reconnectionAttempts: 10, // Số lần thử reconnect (mặc định là vô hạn)
      reconnectionDelay: 2000, // Thời gian giữa các lần thử (ms)
      transports: ["websocket"], // Đảm bảo dùng WebSocket thay vì polling
    });
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
          url: "",
          statusCode: 404,
          msg: "basedata_id not found",
        });
      } else {
        console.log("%%% basedata_id:", basedata_id);
        newSocket.emit("call.answer", {
          url: `http://192.168.101.3:8173/stream/${call_type}/0?hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${basedata_id}`,
          statusCode: 200,
          msg: "success",
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
        basedata_id: "",
    })
  }

  const fetchSubDeviceList = async () => {
    const pageIndex = 1;
    const pageSize = 10000;
    try {
      const resp = await window.lemon.gis.fetchSubDeviceList({
        page_index: pageIndex,
        page_size: pageSize,
      });
      if (resp.result === 0) {
        return resp.sub_device_list;
      } else {
        alert(`fetchSubDeviceList failed`);
        return [];
      }
    } catch (error) {
      console.error("### Error calling fetchSubDeviceList:", error);
      return [];
    }
  };

  const queryRecordGPS = async () => {
    try {
      let subDeviceList = await fetchSubDeviceList();
      if (!subDeviceList || subDeviceList.length === 0) {
        if (devices_sub_gps.length !== 0) {
          subDeviceList = devices_sub_gps;
        } else {
          console.warn("%% No sub devices found");
        }
        return [];
      } else if (subDeviceList.length > 0) {
        setDevicesGpsSub(subDeviceList);
      }

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const gpsDataList = [];
      for (const item of subDeviceList) {
        const basedata_id = item.basedata_id;
        const resp = await window.lemon.gis.queryRecordGPS({
          basedata_id,
          start_time: oneMinuteAgo.toISOString(),
          end_time: now.toISOString(),
        });
        if (resp.gps_record_list.length > 0) {
          let filtered = resp.gps_record_list[0];
          gpsDataList.push({
            deviceId: item.alias,
            lng: filtered.longitude,
            lat: filtered.latitude,
            dateTime: filtered.gps_datetime,
          });
          //   const filtered = resp.gps_record_list.find((point) => {
          //     const date = new Date(point.gps_datetime);
          //     return date.getSeconds() === 0;
          //   });

          //   if (filtered) {
          //     gpsDataList.push({
          //       deviceId: item.alias,
          //       lng: filtered.longitude,
          //       lat: filtered.latitude,
          //       dateTime: filtered.gps_datetime,
          //     });
          //   }
        }
      }
      if (gpsDataList.length === 0) {
        console.warn("### No GPS data found");
        return [];
      }
      console.log("### mqttClientGPS:", mqttClientGPS);
      mqttClientGPS.publish(MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      console.log("### Tổng hợp GPS:", gpsDataList);
      return gpsDataList;
    } catch (error) {
      console.error(`queryRecordGPS failed: ${error}`);
      return [];
    }
  };

  useEffect(() => {
    setupSocket();
    intervalRef.current = setInterval(() => {
      queryRecordGPS();
    }, 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    mqttClientGPS = new Paho.Client(
      `ws://${MQTT_BROKER}:${MQTT_PORT}/ws`,
      "client-" + Math.random()
    );
    mqttClientGPS.onConnectionLost = (responseObject) => {
      console.log("### Mất kết nối:", responseObject.errorMessage);
    };
    mqttClientGPS.connect({
      onSuccess: () => {
        console.log("### Đã kết nối MQTT GPS");
        mqttClientGPS.subscribe(MQTT_GPS_TOPIC);
      },
      onFailure: (err) => console.error("### Kết nối thất bại:", err),
      userName: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      useSSL: false,
      reconnect: true, 
      keepAliveInterval: 10, 
    });

    return () => {
      mqttClientGPS.disconnect();
    };
  }, []);

  useEffect(() => {
    const mqttClient = new Paho.Client(
      `ws://${MQTT_BROKER}:${MQTT_PORT}/ws`,
      "client-" + Math.random()
    );

    mqttClient.onConnectionLost = (responseObject) => {
      console.log("Mất kết nối:", responseObject.errorMessage);
    };

    mqttClient.onMessageArrived = (message) => {    
        console.log("%%% Nhận tin nhắn:", message.payloadString);
        console.log("%%%%",message.destinationName);
        if (message.destinationName === MQTT_TOPIC) {
            handleFetchDeviceList();
            let payload = JSON.parse(message.payloadString);
            let alias = payload.DeviceId;
            // let formated_alias = formatText(alias)
            let formated_alias = alias;
            console.log("%%% alias:", formated_alias);

            let basedata_id = deviceList[formated_alias].basedata_id;

            if (!basedata_id) {
                console.error("%%% basedata_id not found");
                let payload = JSON.stringify(
                    {
                        "DeviceId": alias,
                        "url": "",
                        "statusCode": 404,
                        "msg": "basedata_id not found",
                    }
                )
                mqttClient.publish(MQTT_TOPIC_RESPONSE, payload);
            } else {
                console.log("%%% basedata_id:", basedata_id);
                let payload = JSON.stringify(
                    {
                        "DeviceId": alias,
                        "url": `http://192.168.101.3:8173/stream/${call_type}/0?hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${basedata_id}`,
                        "statusCode": 200,
                        "msg": "success",   
                    }
                )
                console.log("%%%", payload, MQTT_TOPIC_RESPONSE)
                mqttClient.publish(MQTT_TOPIC_RESPONSE, payload);
            }
        }
    };
    // http://localhost:8174/stream/video/0?hookFlag=0&duplexFlag=1&basedata_id=fd88c15f15d090841a29b5be71c004f079c5f618c3b51f17cd0935038870351e
    // Kết nối MQTT
    mqttClient.connect({
        onSuccess: () => {
        console.log("%%%% Đã kết nối MQTT");
        mqttClient.subscribe(MQTT_TOPIC);

        },
        onFailure: (error) => {
            console.error("❌ Lỗi kết nối MQTT:", error.errorMessage);
          },
        userName: MQTT_USERNAME,
        password: MQTT_PASSWORD,
        reconnect: true, 
        keepAliveInterval: 10, 

    });
    setClient(mqttClient);
    return () => {
        console.log("Ngắt kết nối MQTT");
        mqttClient.disconnect()
    };
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
    if (deviceList.length ==0) {
      handleFetchDeviceList();
    }
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
      setEmbeddedCallId(
        `http://192.168.101.3:8173/stream/video/1?duplex_flag=${duplex_flag}&listen_flag=${listen_flag}&call_id=${callId}&caller_alias=${caller_alias}`
      );
    } catch (error) {
      console.error("Error answering call", error);
    }
  };

  return (
    <>
      <h1>Auto Login</h1>
      {incomingCall && (
        <div>
          <p>Cuộc gọi đến từ: {incomingCall.caller_number}</p>
          <input type="text" value={embeddedCallId} />
          <button onClick={() => handleAnswerCall()}>Trả lời</button>
          {/* <button onClick={async () => await handleHangup(currentCallId)}>
      Tắt cuộc gọi
    </button> */}
        </div>
      )}
    </>
  );
}

export default AutoLogin;
