import { useRef, useState, useEffect } from "react";
import "./App.css";
import Call from "./components/Call";
import GIS from "./components/GIS";

import Sidebar from "./components/Sidebar";
import System from "./components/System";
import Receive from "./components/Receive";
import Sender from "./components/Sender";
import StreamCall from "./components/StreamCall";
import DemoCall from "./components/DemoCall";
import Auto from "./components/Auto";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
  4: {
    name: "GIS",
    component: <GIS />,
  },
  5: {
    name: "DemoCall",
    component: <DemoCall />,
  },
};

function App() {
  const [tabIndex, setTabIndex] = useState(0);
 
  return (
    <>
      <Routes>
        <Route
          path="/stream/:call_mode/:call_type/:hookFlag/:duplexFlag/:basedata_id"
          element={<StreamCall />}
        />
        <Route path="/auto" element={<Auto />} />
        <Route
          path="/"
          element={
            <>
              <Sidebar tabs={tabs} setTabIndex={setTabIndex} />
              {tabs[tabIndex].component}
            </>
          }
        />
      </Routes>
    </>
  );
}

export default App;
