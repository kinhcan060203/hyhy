import { useRef, useState, useEffect } from "react";
import "./App.css";
import Call from "./components/Call";
import GIS from "./components/GIS";

import Sidebar from "./components/Sidebar";
import System from "./components/System";
import Receive from "./components/Receive";
import Sender from "./components/Sender";

const tabs = {
  0: {
    name: "System",
    component: <System />,
  },
  1: {
    name: "Call",
    component: <Call />,
  },
  2: {
    name: "Receive",
    component: <Receive />,
  },
  3: {
    name: "Sender",
    component: <Sender />,
  },
};

function App() {
  const [count, setCount] = useState(0);
  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
  };
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    console.log("App mounted");
    const onLoginStatusChange = (loginStatus) => {
      console.log("Login status changed", loginStatus);
      if (
        loginStatus.login_status === 0 ||
        loginStatus.login_status === 2 ||
        loginStatus.login_status === 3
      ) {
        attemptRelogin();
      }
    };

    // attemptRelogin();

    const loginStatusCallbackId =
      window.lemon.login.addLoginStatusChangeListener(onLoginStatusChange);

    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
    };
  }, []);

  const attemptRelogin = async () => {
    console.log("Attempting relogin");
    const res = await window.lemon.login
      .login(userInfo)
      .then((resp) => {
        console.log(resp);
        if (resp.result !== 0) {
          attemptRelogin();
        }
      })
      .catch((err) => {
        alert("Login failed");
      });
    console.log(res);
  };

  return (
    <>
      <Sidebar tabs={tabs} setTabIndex={setTabIndex} />
      {tabs[tabIndex].component}
    </>
  );
}

export default App;
