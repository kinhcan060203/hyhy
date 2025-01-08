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

function App() {
  const [count, setCount] = useState(0);

  const [tabIndex, setTabIndex] = useState(0);

  return (
    <>
      <Sidebar tabs={tabs} setTabIndex={setTabIndex} />
      {tabs[tabIndex].component}
    </>
  );
}

export default App;
