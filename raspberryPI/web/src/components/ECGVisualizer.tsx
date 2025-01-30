import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const ECGVisualizer = ({ rate = 60, aOutput = 5, vOutput = 5 }) => {
  const [data, setData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Define the base complex with more detailed wave morphology
  const baseComplex = [
    { x: 0, y: 0 }, // Baseline
    { x: 1, y: 2 }, // P wave start
    { x: 2, y: 15 }, // P wave peak
    { x: 3, y: 2 }, // P wave end
    { x: 4, y: 0 }, // PR segment
    { x: 5, y: -10 }, // Q wave
    { x: 6, y: 100 }, // R wave peak
    { x: 7, y: -20 }, // S wave
    { x: 8, y: -5 }, // J point
    { x: 9, y: 0 }, // ST segment
    { x: 10, y: 5 }, // T wave start
    { x: 11, y: 20 }, // T wave peak
    { x: 12, y: 5 }, // T wave end
    { x: 13, y: 0 }, // Baseline
    { x: 14, y: 0 }, // Baseline
    { x: 15, y: 0 }, // Baseline
  ];

  // Generate multiple complexes with amplitude adjustments
  const generatePoints = () => {
    const points = [];
    const numberOfComplexes = 10;
    const aScale = aOutput / 5;
    const vScale = vOutput / 5;

    for (let i = 0; i < numberOfComplexes; i++) {
      baseComplex.forEach((point) => {
        let scaledY = point.y;
        
        // Scale P wave based on aOutput
        if (point.x % baseComplex.length >= 1 && point.x % baseComplex.length <= 3) {
          scaledY = point.y * aScale;
        }
        
        // Scale QRS complex based on vOutput
        if (point.x % baseComplex.length >= 5 && point.x % baseComplex.length <= 7) {
          scaledY = point.y * vScale;
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
          />
          <YAxis
            domain={[-50, 150]}
            stroke="#666666"
            tick={{ fill: '#666666' }}
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