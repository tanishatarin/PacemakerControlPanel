import React, { useState, useEffect } from 'react';
import { checkEncoderStatus, simulateRotation, getHardwareDebugInfo, HardwareStatus, ApiStatus } from '../utils/encoderApi';

interface DebugPanelProps {
  isVisible: boolean;
}

const HardwareDebugPanel: React.FC<DebugPanelProps> = ({ isVisible }) => {
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [detailedInfo, setDetailedInfo] = useState<any>(null);

  useEffect(() => {
    if (!isVisible) return;

    const fetchStatus = async () => {
      const data = await checkEncoderStatus();
      if (data) {
        setStatus(data);
        setLastRefresh(new Date());
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [isVisible, refreshInterval]);

  const fetchDetailedInfo = async () => {
    const info = await getHardwareDebugInfo();
    setDetailedInfo(info);
  };

  const handleSimulateRotation = async (direction: 1 | -1) => {
    await simulateRotation(direction);
    // Refresh immediately after simulation
    const data = await checkEncoderStatus();
    if (data) {
      setStatus(data);
      setLastRefresh(new Date());
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-white shadow-lg rounded-lg p-4 max-w-md z-50 text-sm overflow-y-auto max-h-[80vh]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-800">Hardware Debug Panel</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="text-blue-500 hover:text-blue-700"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {status ? (
        <div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">API Status</div>
              <div className={`font-medium ${status.status === 'running' ? 'text-green-600' : 'text-red-600'}`}>
                {status.status}
              </div>
            </div>
            <div className="bg-gray-100 p-2 rounded">
              <div className="text-xs text-gray-500">Hardware Available</div>
              <div className={`font-medium ${status.hardware.gpio_available ? 'text-green-600' : 'text-yellow-600'}`}>
                {status.hardware.gpio_available ? 'Yes' : 'No (Mock Mode)'}
              </div>
            </div>
          </div>

          <div className="bg-gray-100 p-2 rounded mb-2">
            <div className="text-xs text-gray-500">Encoder Activity</div>
            <div className="flex justify-between">
              <span>Rotations: <b>{status.hardware.rotation_count}</b></span>
              <span>Button Presses: <b>{status.hardware.button_press_count}</b></span>
            </div>
          </div>

          {expanded && (
            <>
              <div className="bg-gray-100 p-2 rounded mb-2">
                <div className="text-xs text-gray-500">Current Pin Values</div>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div>
                    CLK: <span className="font-mono">{status.hardware.pin_values.clk ?? 'N/A'}</span>
                  </div>
                  <div>
                    DT: <span className="font-mono">{status.hardware.pin_values.dt ?? 'N/A'}</span>
                  </div>
                  <div>
                    SW: <span className="font-mono">{status.hardware.pin_values.button ?? 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-100 p-2 rounded mb-2">
                <div className="text-xs text-gray-500">Request Counter</div>
                <div className="font-mono">{status.request_counter}</div>
              </div>

              <div className="mb-2">
                <button
                  onClick={fetchDetailedInfo}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-xs mr-2"
                >
                  Fetch Detailed Info
                </button>
                
                <div className="inline-block">
                  <button
                    onClick={() => handleSimulateRotation(-1)}
                    className="bg-gray-500 text-white px-3 py-1 rounded-l text-xs"
                  >
                    ← Rotate CCW
                  </button>
                  <button
                    onClick={() => handleSimulateRotation(1)}
                    className="bg-gray-500 text-white px-3 py-1 rounded-r text-xs border-l border-gray-400"
                  >
                    Rotate CW →
                  </button>
                </div>
              </div>

              <div className="mb-2">
                <label className="text-xs text-gray-500 block mb-1">Refresh Interval (ms)</label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>500ms</span>
                  <span>{refreshInterval}ms</span>
                  <span>5000ms</span>
                </div>
              </div>

              {detailedInfo && (
                <div className="bg-gray-100 p-2 rounded mb-2">
                  <div className="text-xs text-gray-500 mb-1">Detailed Hardware Info</div>
                  <pre className="text-xs overflow-auto max-h-32 bg-gray-800 text-gray-200 p-2 rounded">
                    {JSON.stringify(detailedInfo, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}

          <div className="text-xs text-gray-400 mt-1">
            Last update: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-red-500">Unable to connect to encoder API</div>
      )}
    </div>
  );
};

export default HardwareDebugPanel;