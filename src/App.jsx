import { useRef, useState, useEffect } from "react";
import "./App.css";
import Call from "./components/Call";
import Sidebar from "./components/Sidebar";
import System from "./components/System";

const tabs = {
  0: {
    name: "System",
    component: <System />,
  },
  1: {
    name: "Call",
    component: <Call />,
  },
};

{
  /* 
    - Login trên server để nhận được token, token đó sẽ là key để gọi các hàm khác
    - khởi tạo func handleMediaStream sẽ lắng nghe media thay đổi từ server và device được kết nối
    - khởi tạo func hứng event hangup ngắt cuộc gọi khi có sự kiện
    - Client 1 khởi tạo cuộc gọi video (1), gọi hàm makeVideoCall với các tham số như basedata_id (id của device client 2) và hook_flag (chế độ call: 0 - auto, 1 - manual, default 1)
    - Sau khi gửi request call thành công tới server (1 ok), hàm handleMediaStream lắng nghe được và setup local stream video,  call_id được trả về (sau này dùng để ngắt cuộc gọi), server sẽ gửi thông báo tới client 2 (2)
    - Client 2 sau khi chấp nhận cuộc gọi (3) sẽ trigger answerCall, hàm handleMediaStream lắng nghe được và setup remote stream video từ device và show lên UI
    - Mỗi khi setup media thành công, sẽ trả về tag video hoặc audio nhúng lên UI.
    - Khi có sự kiện ngắt cuộc gọi, sẽ gọi hàm hangupCall với call_id để ngắt cuộc gọi 
    > */
}

function App() {
  const [count, setCount] = useState(0);

  const [tabIndex, setTabIndex] = useState(0);
  //

  return (
    <>
      <Sidebar tabs={tabs} setTabIndex={setTabIndex} />
      {tabs[tabIndex].component}
    </>
  );
}

export default App;
