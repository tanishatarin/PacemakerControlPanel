import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronUp, ChevronDown, Key, Lock, LockOpen, Pause, ArrowLeft, Zap } from 'lucide-react';

interface ControlSectionProps {
  title: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  isLocked?: boolean;
  minValue: number;
  maxValue: number;
  onLockError?: () => void;
  isDimmed?: boolean;
}

interface DDDModeControlProps {
  title: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  minValue: number;
  maxValue: number;
  showMinMax?: boolean;
}

interface ToggleControlProps {
  title: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

const getStepSize = (value: number, title: string) => {
  if (title !== "Rate") {
    if (value <= 1) return 0.1;
    if (value <= 4) return 0.5;
    return 1.0;
  }
  return 1;
};

const getValueColor = (value: number, minValue: number, maxValue: number) => {
  const percentage = (value - minValue) / (maxValue - minValue) * 100;
  if (percentage < 33) return '#4ade80'; // green
  if (percentage < 66) return '#fbbf24'; // yellow
  return '#ef4444'; // red
};

const CircularControl: React.FC<ControlSectionProps> = ({ 
  title, 
  value, 
  unit, 
  onChange,
  isLocked,
  minValue,
  maxValue,
  onLockError,
  isDimmed
}) => {
  const color = getValueColor(value, minValue, maxValue);
  const percentage = ((value - minValue) / (maxValue - minValue)) * 100;
  
  // SVG circle parameters
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const handleChange = (newValue: number) => {
    if (isLocked) {
      onLockError?.();
    } else {
      onChange(newValue);
    }
  };

  return (
    <div className={`mb-8 transition-opacity duration-300 ${isDimmed ? 'opacity-50' : 'opacity-100'}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl text-gray-800">{title}</h2>
        <div className="flex items-center gap-8">
          <div className="relative w-24 h-24">
            <svg className="transform -rotate-90 w-full h-full">
              {/* Background circle */}
              <circle
                stroke="#e5e7eb"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius + stroke}
                cy={radius + stroke}
              />
              {/* Progress circle */}
              <circle
                stroke={color}
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                r={normalizedRadius}
                cx={radius + stroke}
                cy={radius + stroke}
                className="transition-all duration-300 ease-in-out"
              />
              {/* Current value */}
              <text
                x={radius + stroke}
                y={radius + stroke}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color}
                className="text-lg font-bold"
                style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
              >
                {value.toFixed(unit === 'ppm' ? 0 : 1)}
              </text>
            </svg>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold" style={{ color }}>
              {value.toFixed(unit === 'ppm' ? 0 : 1)} {unit}
            </span>
          </div>
        </div>
      </div>
      <div>
        <label className="block mb-2 text-sm text-gray-600">Adjust Value:</label>
        <div className="relative">
          <div className="h-2 bg-gray-100 rounded-full">
            <div 
              className="absolute h-full rounded-full transition-all duration-300 ease-in-out"
              style={{ 
                width: `${percentage}%`,
                backgroundColor: color
              }}
            />
          </div>
          <input
            type="range"
            min={minValue}
            max={maxValue}
            value={value}
            step={getStepSize(value, title)}
            onChange={(e) => handleChange(parseFloat(e.target.value))}
            className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

// Rest of the components remain the same as before
const ToggleControl: React.FC<ToggleControlProps> = ({
  title,
  value,
  onChange
}) => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-700">{title}</span>
        <button
          onClick={() => onChange(!value)}
          className={`px-4 py-1 rounded-full ${
            value ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
          }`}
        >
          {value ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
};

const DDDModeControl: React.FC<DDDModeControlProps> = ({
  title,
  value,
  unit,
  onChange,
  minValue,
  maxValue,
  showMinMax = true
}) => {
  const percentage = ((value - minValue) / (maxValue - minValue)) * 100;
  
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-2">
        <span className="text-sm text-gray-700">{title}</span>
        <span className="text-sm font-medium">{value.toFixed(1)} {unit}</span>
      </div>
      <div className="relative">
        <div className="h-2 bg-gray-100 rounded-full">
          <div 
            className="absolute h-full bg-blue-500 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={minValue}
          max={maxValue}
          value={value}
          step={0.1}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute top-0 w-full h-2 opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
};


const RapidPacingScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [rapValue, setRapValue] = useState(250);
  const [isDelivering, setIsDelivering] = useState(false);
  const deliveryTimeout = useRef<number>();

  useEffect(() => {
    return () => {
      if (deliveryTimeout.current) {
        clearTimeout(deliveryTimeout.current);
      }
    };
  }, []);

  const handleDeliveryStart = () => {
    setIsDelivering(true);
    // In a real implementation, this would trigger the rapid pacing
    deliveryTimeout.current = window.setTimeout(() => {
      setIsDelivering(false);
    }, 5000); // 5-second demo delivery
  };

  const handleDeliveryEnd = () => {
    setIsDelivering(false);
    if (deliveryTimeout.current) {
      clearTimeout(deliveryTimeout.current);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-3xl shadow-sm p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 hover:bg-gray-100 p-2 rounded-lg"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">Rapid Atrial Pacing</h2>
        </div>

        <DDDModeControl
          title="RAP Rate"
          value={rapValue}
          unit="ppm"
          onChange={setRapValue}
          minValue={60}
          maxValue={600}
          showMinMax={true}
        />

        <div className="mt-8">
          <button
            onMouseDown={handleDeliveryStart}
            onMouseUp={handleDeliveryEnd}
            onMouseLeave={handleDeliveryEnd}
            className={`w-full py-4 rounded-xl text-white text-lg font-medium ${
              isDelivering ? 'bg-red-500' : 'bg-yellow-500 hover:bg-yellow-600'
            }`}
          >
            {isDelivering ? 'DELIVERING...' : 'Hold to DELIVER Rapid Atrial Pacing'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ControlPanel = () => {
  const [rate, setRate] = useState(80);
  const [aOutput, setAOutput] = useState(10.0);
  const [vOutput, setVOutput] = useState(10.0);
  const [selectedModeIndex, setSelectedModeIndex] = useState(0);
  const [pendingModeIndex, setPendingModeIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [showAsyncMessage, setShowAsyncMessage] = useState(false);
  const [showLockMessage, setShowLockMessage] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseTimeLeft, setPauseTimeLeft] = useState(10);
  const [showDDDMode, setShowDDDMode] = useState(false);
  const [showRapidPacing, setShowRapidPacing] = useState(false);
  
  // DDD Mode specific states
  const [aSensitivity, setASensitivity] = useState(0.5);
  const [vSensitivity, setVSensitivity] = useState(2.0);
  const [avDelay, setAVDelay] = useState(170);
  const [upperRate, setUpperRate] = useState(110);
  const [pvarp, setPVARP] = useState(300);
  const [aTracking, setATracking] = useState(true);
  const [settings, setSettings] = useState("Automatic");

  const pauseTimerRef = useRef<number>();
  const modes = [
    'VOO', 'VVI',
    'VVT', 'AOO',
    'AAI', 'DOO',
    'DDD', 'DDI'
  ];

  useEffect(() => {
    if (isPausing) {
      pauseTimerRef.current = window.setInterval(() => {
        setPauseTimeLeft((prev) => {
          if (prev <= 0) {
            setIsPausing(false);
            clearInterval(pauseTimerRef.current);
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(pauseTimerRef.current);
      setPauseTimeLeft(10);
    }

    return () => {
      if (pauseTimerRef.current) {
        clearInterval(pauseTimerRef.current);
      }
    };
  }, [isPausing]);

  const handleModeNavigation = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      setPendingModeIndex(prev => {
        const newIndex = prev === 0 ? modes.length - 1 : prev - 1;
        setSelectedModeIndex(newIndex);
        return newIndex;
      });
    } else {
      setPendingModeIndex(prev => {
        const newIndex = prev === modes.length - 1 ? 0 : prev + 1;
        setSelectedModeIndex(newIndex);
        return newIndex;
      });
    }
  };

  const handleLeftArrowPress = () => {
    setSelectedModeIndex(pendingModeIndex);
    if (modes[pendingModeIndex] === 'DDD') {
      setShowDDDMode(true);
    } else {
      setShowDDDMode(false);
    }
  };

  const handleEmergencyMode = () => {
    setRate(80);
    setAOutput(20.0);
    setVOutput(25.0);
    setShowAsyncMessage(true);
    setTimeout(() => setShowAsyncMessage(false), 5000);
  };

  const handleLockError = () => {
    setShowLockMessage(true);
    setTimeout(() => setShowLockMessage(false), 3000);
  };

  const handlePauseStart = () => {
    setIsPausing(true);
  };

  const handlePauseEnd = () => {
    setIsPausing(false);
  };

  if (showRapidPacing) {
    return <RapidPacingScreen onBack={() => setShowRapidPacing(false)} />;
  }

  if (showDDDMode) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowDDDMode(false)}
              className="hover:bg-gray-100 p-2 rounded-lg"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold">DDD Mode Configuration</h2>
            <button
              onClick={() => setShowRapidPacing(true)}
              className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600"
            >
              <Zap className="w-4 h-4" />
              Rapid Pacing
            </button>
          </div>
          
          <div className="space-y-6">
            <DDDModeControl
              title="A Sensitivity"
              value={aSensitivity}
              unit="mV"
              onChange={setASensitivity}
              minValue={0.1}
              maxValue={5.0}
            />
            <DDDModeControl
              title="V Sensitivity"
              value={vSensitivity}
              unit="mV"
              onChange={setVSensitivity}
              minValue={0.1}
              maxValue={5.0}
            />
            <DDDModeControl
              title="AV Delay"
              value={avDelay}
              unit="ms"
              onChange={setAVDelay}
              minValue={70}
              maxValue={300}
            />
            <DDDModeControl
              title="Upper Rate"
              value={upperRate}
              unit="ppm"
              onChange={setUpperRate}
              minValue={50}
              maxValue={150}
            />
            <DDDModeControl
              title="PVARP"
              value={pvarp}
              unit="ms"
              onChange={setPVARP}
              minValue={150}
              maxValue={500}
            />
            <ToggleControl
              title="A. Tracking"
              value={aTracking}
              onChange={setATracking}
            />
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Settings</span>
              <select
                value={settings}
                onChange={(e) => setSettings(e.target.value)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800"
              >
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-3xl shadow-sm p-4 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, index) => {
                const threshold = (index + 1) * 20;
                const isActive = batteryLevel >= threshold;
                return (
                  <div
                    key={index}
                    className={`w-2 h-6 rounded-sm transition-colors ${
                      isActive 
                        ? batteryLevel > 20 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                        : 'bg-gray-200'
                    }`}
                  />
                );
              })}
            </div>
            <span className={`${
              batteryLevel > 20 ? 'text-green-500' : 'text-red-500'
            }`}>{batteryLevel}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={batteryLevel}
            onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        <div className="text-xl font-bold text-gray-800">
          Mode: {modes[selectedModeIndex]}
        </div>
        <div>
          {isLocked ? 
            <Lock className="w-6 h-6 text-green-500" /> : 
            <LockOpen className="w-6 h-6 text-gray-400" />
          }
        </div>
      </div>

      {/* Emergency Mode Button */}
      <button
        onClick={() => {
          handleEmergencyMode();
          setSelectedModeIndex(modes.indexOf('DOO'));
          setPendingModeIndex(modes.indexOf('DOO'));
        }}
        className="w-full mb-4 bg-red-500 text-white py-2 px-4 rounded-xl hover:bg-red-600 transition-colors"
      >
        DOO Emergency Mode
      </button>

      {/* Controls */}
      <div className="bg-white rounded-3xl shadow-sm p-6 mb-6">
        <CircularControl
          title="Rate"
          value={rate}
          unit="ppm"
          onChange={setRate}
          isLocked={isLocked}
          minValue={30}
          maxValue={200}
          onLockError={handleLockError}
        />
        <CircularControl
          title="A. Output"
          value={aOutput}
          unit="mA"
          onChange={setAOutput}
          isLocked={isLocked}
          minValue={0}
          maxValue={20}
          onLockError={handleLockError}
          isDimmed={aOutput === 0}
        />
        <CircularControl
          title="V. Output"
          value={vOutput}
          unit="mA"
          onChange={setVOutput}
          isLocked={isLocked}
          minValue={0}
          maxValue={25}
          onLockError={handleLockError}
          isDimmed={vOutput === 0}
        />
      </div>

      {/* Mode Selection */}
      <div className="flex gap-4">
        <div className="bg-white rounded-3xl shadow-sm p-6 flex-1">
          <div className="grid grid-cols-2 gap-3">
            {modes.map((mode, index) => (
              <button
                key={mode}
                className={`py-2.5 px-6 rounded-2xl text-sm font-medium transition-all
                  ${index === pendingModeIndex 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={() => setIsLocked(!isLocked)}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <Key className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={handleLeftArrowPress}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={() => handleModeNavigation('up')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronUp className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={() => handleModeNavigation('down')}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <ChevronDown className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onMouseDown={handlePauseStart}
            onMouseUp={handlePauseEnd}
            onMouseLeave={handlePauseEnd}
            className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center hover:bg-gray-50"
          >
            <Pause className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {showAsyncMessage && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-xl shadow-lg">
          <p className="">Asynchronous Pacing activated</p>
          <p className="text-sm text-gray-600">Press left arrow to continue with Synchronous Pacing</p>
        </div>
      )}
      
      {showLockMessage && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-xl shadow-lg">
          <p className="text-red-500">Controls are locked</p>
          <p className="text-sm text-gray-600">Press the key button to unlock controls</p>
        </div>
      )}

      {isPausing && (
        <div className="fixed bottom-4 right-4 bg-white p-4 rounded-xl shadow-lg">
          <p className="text-yellow-500">Pacing Paused</p>
          <p className="text-sm text-gray-600">Time remaining: {pauseTimeLeft}s</p>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;