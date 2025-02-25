import React from 'react';

interface DOOSettingsProps {
  onBack: () => void;
  isLocked: boolean;
}

const DOOSettings: React.FC<DOOSettingsProps> = () => {
  return (
      <div className="bg-white rounded-xl">
        <div className="flex justify-between items-center border-b">
          <h2 className="text-lg font-semibold">DOO Emergency Mode</h2>
          <div className="w-5"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="p-3 space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <h3 className="text-red-600 font-medium mb-1">Asynchronous Pacing Active</h3>
            <p className="text-sm text-red-700">
              DOO mode is an emergency asynchronous pacing mode that paces both chambers at fixed rates regardless of the patient's intrinsic cardiac activity.
            </p>
          </div>
          
          <div className="">
            <p className="text-sm font-bold text-gray-700">Emergency settings have been applied:</p>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Rate:</span>
                <span className="font-medium">80 ppm</span>
              </li>
              <li className="flex justify-between">
                <span>A. Output:</span>
                <span className="font-medium">20.0 mA</span>
              </li>
              <li className="flex justify-between">
                <span>V. Output:</span>
                <span className="font-medium">25.0 mA</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
  );
};

export default DOOSettings;