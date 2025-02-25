export interface ControlSectionProps {
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
  
  export interface DDDSettingsState {
    aSensitivity: number;
    vSensitivity: number;
    avDelay: number;
    upperRate: number;
    pvarp: number;
    aTracking: boolean;
    settings: string;
  }
  
  export type PacingMode = 'VOO' | 'VVI' | 'VVT' | 'AOO' | 'AAI' | 'DOO' | 'DDD' | 'DDI';


// export interface ControlSectionProps {
//   title: string;
//   value: number;
//   unit: string;
//   onChange: (value: number) => void;
//   isLocked?: boolean;
//   minValue: number;
//   maxValue: number;
//   onLockError?: () => void;
//   isDimmed?: boolean;
// }
  
// export interface DDDSettingsState {
//   aSensitivity: number;
//   vSensitivity: number;
//   avDelay: number;
//   upperRate: number;
//   pvarp: number;
//   aTracking: boolean;
//   settings: string;
// }
  
// export type PacingMode = 'VOO' | 'VVI' | 'VVT' | 'AOO' | 'AAI' | 'DOO' | 'DDD' | 'DDI';