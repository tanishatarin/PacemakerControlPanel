import React from 'react';

interface NotificationsProps {
  showAsyncMessage: boolean;
  showLockMessage: boolean;
  isPausing: boolean;
  pauseTimeLeft: number;
}

const Notifications: React.FC<NotificationsProps> = ({
  showAsyncMessage,
  showLockMessage,
  isPausing,
  pauseTimeLeft
}) => {
  if (!showAsyncMessage && !showLockMessage && !isPausing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 space-y-4 z-50">
      {showAsyncMessage && (
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <p className="text-blue-500 font-medium">Asynchronous Pacing activated</p>
          <p className="text-sm text-gray-600">Press left arrow to continue with Synchronous Pacing</p>
        </div>
      )}
      
      {showLockMessage && (
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <p className="text-red-500 font-medium">Controls are locked</p>
          <p className="text-sm text-gray-600">Press the key button to unlock controls</p>
        </div>
      )}

      {isPausing && (
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <p className="text-yellow-500 font-medium">Pacing Paused</p>
          <p className="text-sm text-gray-600">Time remaining: {pauseTimeLeft}s</p>
        </div>
      )}
    </div>
  );
};

export default Notifications;