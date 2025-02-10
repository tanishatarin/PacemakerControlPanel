import React from 'react';
import { DDDModeControl } from './DDDModeControl';
import { ToggleControl } from './ToggleControl';

interface DDDSettingsProps {
  aSensitivity: number;
  vSensitivity: number;
  avDelay: number;
  upperRate: number;
  pvarp: number;
  aTracking: boolean;
  settings: string;
  onSettingChange: {
    setASensitivity: (value: number) => void;
    setVSensitivity: (value: number) => void;
    setAVDelay: (value: number) => void;
    setUpperRate: (value: number) => void;
    setPVARP: (value: number) => void;
    setATracking: (value: boolean) => void;
    setSettings: (value: string) => void;
  };
}

export const DDDSettings: React.FC<DDDSettingsProps> = ({
  aSensitivity,
  vSensitivity,
  avDelay,
  upperRate,
  pvarp,
  aTracking,
  settings,
  onSettingChange
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">DDD Settings</h3>
      <DDDModeControl
        title="A Sensitivity"
        value={aSensitivity}
        unit="mV"
        onChange={onSettingChange.setASensitivity}
        minValue={0.1}
        maxValue={5.0}
      />
      <DDDModeControl
        title="V Sensitivity"
        value={vSensitivity}
        unit="mV"
        onChange={onSettingChange.setVSensitivity}
        minValue={0.1}
        maxValue={5.0}
      />
      <DDDModeControl
        title="AV Delay"
        value={avDelay}
        unit="ms"
        onChange={onSettingChange.setAVDelay}
        minValue={70}
        maxValue={300}
      />
      <DDDModeControl
        title="Upper Rate"
        value={upperRate}
        unit="ppm"
        onChange={onSettingChange.setUpperRate}
        minValue={50}
        maxValue={150}
      />
      <DDDModeControl
        title="PVARP"
        value={pvarp}
        unit="ms"
        onChange={onSettingChange.setPVARP}
        minValue={150}
        maxValue={500}
      />
      <ToggleControl
        title="A. Tracking"
        value={aTracking}
        onChange={onSettingChange.setATracking}
      />
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-700">Settings</span>
        <select
          value={settings}
          onChange={(e) => onSettingChange.setSettings(e.target.value)}
          className="px-3 py-1 rounded-lg bg-gray-100 text-gray-800 text-sm"
        >
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
        </select>
      </div>
    </div>
  );
};