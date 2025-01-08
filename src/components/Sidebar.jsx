import { useEffect, useState } from "react";

function Sidebar({ tabs, setTabIndex }) {
  return (
    <>
      <div className="bg-white border-r border-gray-200 w-64 h-full fixed top-0 left-0 pt-10 flex flex-col space-y-4 justify-start items-center">
        {Object.keys(tabs).map((tab, index) => (
          <button className="w-[80%] p-4" onClick={() => setTabIndex(index)}>
            {tabs[index].name}
          </button>
        ))}
      </div>
    </>
  );
}

export default Sidebar;
