import { use } from "react";
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

function DemoCall() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const devices = ["device_name"];
  const hookFlag = 0;
  const duplexFlag = 1;
  const basedata_id =
    "fd88c15f15d090841a29b5be71c004f079c5f618c3b51f17cd0935038870351e";
  const [incomingCall, setIncomingCall] = useState(null);
  const [currentCallId, setCurrentCallId] = useState(null);
  const handleClick = (call_type) => {
    navigate(`/stream/0/${call_type}/${hookFlag}/${duplexFlag}/${basedata_id}`);

    // window.open(
    //   `/stream/0/${call_type}/${hookFlag}/${duplexFlag}/${basedata_id}`,
    //   "_blank",
    //   "width=840,height=840"
    // );
    // window.focus();
  };
  // const handleAnswerCall = (call_type) => {
  //   window.open(
  //     `/stream/1/${call_type}/${incomingCall}`,
  //     "_blank",
  //     "width=640,height=640"
  //   );
  //   window.focus();
  // };
  // useEffect(() => {
  //   incomingEvtGuid = window.lemon.call.addIncomingEvt(handleIncomingCall);
  //   return () => {
  //     if (incomingEvtGuid) {
  //       window.lemon.call.removeIncomingEvt(incomingEvtGuid);
  //     }
  //   };
  // }, []);

  // const handleIncomingCall = async (incomingInfo) => {
  //   console.log("Cuộc gọi đến:", incomingInfo);
  //   if ([0, 2].includes(incomingInfo.attribute.call_mode)) {
  //     setIncomingCall(incomingInfo);
  //     setCurrentCallId(incomingInfo.call_id);
  //   }
  // };

  function get_account_info() {
    window.lemon.login
      .getLoginAccountInfo()
      .then((res) => {
        console.log(res);
        return res.account_info;
      })
      .catch((err) => {
        console.error("Error getting account info", err);
        return null;
      });
  }

  // async function handleHangup(callId) {
  //   console.log("Ngắt cuộc gọi:", callId);
  //   try {
  //     await window.lemon.call
  //       .hangupCall({ call_id: callId })
  //       .then((res) => {
  //         console.log("Cuộc gọi đã ngắt thành công:", res);
  //       })
  //       .catch((err) => {
  //         console.error(err);
  //       });
  //   } catch (error) {
  //     console.error("Lỗi khi ngắt cuộc gọi:", error, callId);
  //   }
  // }

  return (
    <div className="flex items-center justify-center">
      <button onClick={() => handleClick("voice")} className="">
        Voice Call
      </button>
      <button onClick={() => handleClick("video")} className="">
        Video Call
      </button>
      <button onClick={() => get_account_info()} className="">
        get account info
      </button>
      {/* <div>
        {incomingCall && (
          <div>
            <p>Cuộc gọi đến từ: {incomingCall.caller_number}</p>
            <button
              onClick={() => handleAnswerCall(incomingCall.call_id, 1, 0)}
            >
              Trả lời
            </button>
            <button onClick={async () => await handleHangup(currentCallId)}>
              Tắt cuộc gọi
            </button>
          </div>
        )}
      </div> */}
    </div>
  );
}

export default DemoCall;
