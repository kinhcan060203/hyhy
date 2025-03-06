import { useRef, useState, useEffect } from "react";
import Call from "./Call";
import GIS from "./GIS";

import Sidebar from "./Sidebar";
import System from "./System";
import Receive from "./Receive";
import Sender from "./Sender";
import DemoCall from "./DemoCall";
import Fake from "./Fake";
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
  6: {
    name: "Fake",
    component: <Fake />,
  },
};

function DemoSDK() {
  const [tabIndex, setTabIndex] = useState(0);
  return (
    <>
      <Sidebar tabs={tabs} setTabIndex={setTabIndex} />
      {tabs[tabIndex].component}
    </>
  );
}

export default DemoSDK;
