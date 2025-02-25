import React from 'react';

interface DOOSettingsProps {
  onBack: () => void;
  isLocked: boolean;
}

const DOOSettings: React.FC<DOOSettingsProps> = ({
  onBack,
  isLocked
}) => {
  return (
    <div className="p-4">
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">DOO Emergency Mode</h2>
          <div className="w-5"></div> {/* Spacer for alignment */}
        </div>
        
        <div className="p-3 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h3 className="text-red-600 font-medium mb-1">Asynchronous Pacing Active</h3>
            <p className="text-sm text-red-700">
              DOO mode is an emergency asynchronous pacing mode that paces both chambers at fixed rates regardless of the patient's intrinsic cardiac activity.
            </p>
          </div>
          
          <div className="mt-2">
            <p className="text-sm text-gray-700">Emergency settings have been applied:</p>
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

          <div className="mt-4 pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-600">When to use DOO mode:</p>
            <ul className="mt-1 text-xs text-gray-500 list-disc pl-4 space-y-1">
              <li>Patient's underlying heart rate isn't visible</li>
              <li>Rapid decrease in blood pressure</li>
              <li>Only until stabilizing heart beat is observed</li>
            </ul>
          </div>
          
          <div className="mt-4">
            <button
              onClick={onBack}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              disabled={isLocked}
            >
              Return to Main Controls
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DOOSettings;