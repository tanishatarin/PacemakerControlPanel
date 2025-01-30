import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

const ECGVisualizer = ({ rate = 60, aOutput = 20, vOutput = 25 }) => {
  const [data, setData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Calculate intervals based on rate
  const calculateIntervals = () => {
    const beatInterval = 60000 / rate;
    const pDuration = 120;
    const prInterval = 160;
    const qrsDuration = 100;
    const qtInterval = 400;
    return { beatInterval, pDuration, prInterval, qrsDuration, qtInterval };
  };

  // Generate all the points for one complete beat
  const generateBeatPoints = () => {
    const { pDuration, prInterval, qrsDuration } = calculateIntervals();
    const points = [];
    const samplingRate = 10;
    const totalPoints = 160; // Adjust this to control the length of one beat
    
    for (let i = 0; i < totalPoints; i++) {
      let value = 0;
      const t = i * samplingRate;
      
      // P Wave
      if (t < pDuration) {
        const pAmplitude = (aOutput / 20) * 0.25;
        value += pAmplitude * Math.sin((Math.PI * t) / pDuration);
      }
      
      // QRS Complex
      if (t >= prInterval && t < (prInterval + qrsDuration)) {
        const qrsT = t - prInterval;
        const qrsAmplitude = (vOutput / 25) * 1.5;
        
        if (qrsT < qrsDuration/4) {
          value -= (qrsAmplitude * 0.2);
        } else if (qrsT < qrsDuration/2) {
          value += qrsAmplitude;
        } else {
          value -= (qrsAmplitude * 0.3);
        }
      }
      
      // T Wave
      if (t >= (prInterval + qrsDuration + 50) && t < (prInterval + qrsDuration + 160)) {
        const tAmplitude = (vOutput / 25) * 1.5 * 0.3;
        value += tAmplitude * Math.sin((Math.PI * (t - (prInterval + qrsDuration + 50))) / 110);
      }
      
      points.push({
        x: i,
        y: value
      });
    }
    return points;
  };

  // Generate multiple complexes
  const generateAllPoints = () => {
    const singleBeat = generateBeatPoints();
    const points = [];
    const numberOfComplexes = 10;

    for (let i = 0; i < numberOfComplexes; i++) {
      singleBeat.forEach((point) => {
        points.push({
          x: point.x + i * singleBeat.length,
          y: point.y,
        });
      });
    }
    return points;
  };

  useEffect(() => {
    const points = generateAllPoints();
    const initialDataSize = 100;
    
    // Initialize with first set of points
    setData(points.slice(0, initialDataSize));
    
    // Set up data streaming
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const newIndex = (prevIndex + 1) % points.length;
        setData((prevData) => {
          const newData = [...prevData.slice(1), points[newIndex]];
          return newData;
        });
        return newIndex;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [rate, aOutput, vOutput]);

  return (
    <div className="w-full h-96 bg-white p-4 rounded-lg shadow">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            label={{ value: "Time (ms)", position: "bottom" }}
          />
          <YAxis
            domain={[-2, 2]}
            label={{ value: "mV", angle: -90, position: "left" }}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="#8884d8"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ECGVisualizer;