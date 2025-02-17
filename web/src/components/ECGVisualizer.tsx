import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const ECGVisualizer = ({ rate = 60, aOutput = 5, vOutput = 5 }) => {
  const [data, setData] = useState<{ x: number; y: number }[]>([]);
  const [_currentIndex, setCurrentIndex] = useState(0);

  // Define the base complex with physiologically accurate wave morphology
  const baseComplex = [
    { x: 0, y: 0 }, // Baseline
    { x: 1, y: 0.1 }, // P wave start
    { x: 2, y: 0.25 }, // P wave peak
    { x: 3, y: 0.1 }, // P wave end
    { x: 4, y: 0 }, // PR segment
    { x: 5, y: -0.2 }, // Q wave
    { x: 6, y: 1.5 }, // R wave peak (normal amplitude around 1.5mV)
    { x: 7, y: -0.4 }, // S wave
    { x: 8, y: -0.1 }, // J point
    { x: 9, y: 0 }, // ST segment
    { x: 10, y: 0.1 }, // T wave start
    { x: 11, y: 0.4 }, // T wave peak
    { x: 12, y: 0.1 }, // T wave end
    { x: 13, y: 0 }, // Baseline
    { x: 14, y: 0 }, // Baseline
    { x: 15, y: 0 }, // Baseline
  ];

  // Non-linear scaling function to simulate physiological response
  const calculateNonLinearScale = (output: number, maxResponse = 5) => {
    // Logarithmic scaling function that plateaus as current increases
    return Math.min(maxResponse, Math.log(output + 1) / Math.log(6));
  };

  // Generate multiple complexes with amplitude adjustments
  const generatePoints = () => {
    const points: { x: number; y: number }[] = [];
    const numberOfComplexes = 10;
    
    // Calculate non-linear scaling factors
    const aScale = calculateNonLinearScale(aOutput, 1); // Max 1mV for atrial
    const vScale = calculateNonLinearScale(vOutput, 5); // Max 5mV for ventricle

    for (let i = 0; i < numberOfComplexes; i++) {
      baseComplex.forEach((point) => {
        let scaledY = point.y;
        
        // Scale P wave based on aOutput (atrial component)
        if (point.x % baseComplex.length >= 1 && point.x % baseComplex.length <= 3) {
          scaledY = point.y * aScale;
        }
        
        // Scale QRS complex based on vOutput (ventricular component)
        if (point.x % baseComplex.length >= 5 && point.x % baseComplex.length <= 7) {
          scaledY = point.y * vScale;
        }

        // Scale T wave proportionally to QRS
        if (point.x % baseComplex.length >= 10 && point.x % baseComplex.length <= 12) {
          scaledY = point.y * (vScale * 0.3); // T wave typically ~30% of QRS
        }

        points.push({
          x: point.x + i * baseComplex.length,
          y: scaledY,
        });
      });
    }
    return points;
  };

  useEffect(() => {
    const points = generatePoints();
    setData(points.slice(0, 100));

    // Calculate update interval based on heart rate
    const updateInterval = (60000 / rate) / baseComplex.length;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % points.length;
        setData((prevData) => {
          const newData = [...prevData.slice(1), points[newIndex]];
          return newData;
        });
        return newIndex;
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [rate, aOutput, vOutput]);

  return (
    <div className="w-full h-96 bg-black p-4 rounded-lg">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="#333333"
          />
          <XAxis
            dataKey="x"
            stroke="#666666"
            tick={{ fill: '#666666' }}
            label={{ 
              value: "Time (milliseconds)", 
              position: "bottom", 
              fill: "#666666",
              dy: 20
            }}
          />
          <YAxis
            domain={[-2, 5]} // Adjusted to physiological range
            stroke="#666666"
            tick={{ fill: '#666666' }}
            label={{ 
              value: "Amplitude (mV)", 
              angle: -90, 
              position: "left",
              fill: "#666666",
              dx: -30
            }}
            allowDataOverflow={false}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="#00ff00"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ECGVisualizer;
