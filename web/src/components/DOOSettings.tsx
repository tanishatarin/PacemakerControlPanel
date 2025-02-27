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
        
        <div className="p-4 space-y-5">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2">
            <h3 className="text-red-600 font-medium mb-1">Asynchronous Pacing Active</h3>
            <p className="text-sm text-red-700">
              DOO mode is an emergency asynchronous pacing mode that paces both chambers at fixed rates regardless of the patient's intrinsic cardiac activity.
            </p>
          </div>
        </div>
      </div>
  );
};

export default DOOSettings;