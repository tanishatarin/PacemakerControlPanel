import React from 'react';
import ControlPanel from './components/ControlPanel';

const App: React.FC = () => {

  return (
    <div className="min-h-screen bg-[#E5EDF8] p-6 rotated-app">
      <ControlPanel />
    </div>
  );
};

export default App;