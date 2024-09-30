
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

let lastPrediction = {};

app.post('/predict', (req, res) => {
    const inputData = req.body.data;
    const alpha = req.body.params?.find(param => param.name === 'alpha')?.value || 0.5;
    const beta = req.body.params?.find(param => param.name === 'beta')?.value || 0.5;
    const gamma = req.body.params?.find(param => param.name === 'gamma')?.value || 0.5;
    const seasonLength = req.body.params?.find(param => param.name === 'seasonLength')?.value || 4;

    const values = inputData.map(entry => entry.value);

    const { smoothedValues, seasonals, trend } = holtWinters(values, seasonLength, alpha, beta, gamma);

    const forecastedValues = forecastNextWeeks(smoothedValues, seasonals, trend, seasonLength, 10);

    const lastTimestamp = new Date(inputData[inputData.length - 1].timestamp);
    const output = generateOutput(lastTimestamp, forecastedValues);

    lastPrediction = {
        timestamp: new Date(),
        params: req.body.params,
        data: output
    };

    res.json(lastPrediction);
});

app.get('/prediction', (req, res) => {
    res.json(lastPrediction);
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});


/*** POUŽITÉ FUNKCE ***/

function holtWinters(data, seasonLength, alpha, beta, gamma) {
    let smoothedValues = [];
    let trend = [];
    let seasonals = [];

    for (let i = 0; i < seasonLength; i++) {
        seasonals[i] = data[i] / (data.slice(0, seasonLength).reduce((acc, val) => acc + val) / seasonLength);
    }

    let level = data[seasonLength] / seasonals[0];
    let currentTrend = (data[seasonLength] - data[0]) / seasonLength;

    for (let i = 0; i < data.length; i++) {
        if (i >= seasonLength) {
            const prevLevel = level;
            const prevTrend = currentTrend;

            level = alpha * (data[i] / seasonals[i % seasonLength]) + (1 - alpha) * (prevLevel + prevTrend);
            currentTrend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
            seasonals[i % seasonLength] = gamma * (data[i] / level) + (1 - gamma) * seasonals[i % seasonLength];

            smoothedValues.push((level + currentTrend) * seasonals[i % seasonLength]);
            trend.push(currentTrend);
        } else {
            smoothedValues.push(data[i]);
            trend.push(0);
        }
    }

    return { smoothedValues, seasonals, trend };
}

function forecastNextWeeks(data, seasonals, trend, seasonLength, weeks) {
    const lastLevel = data[data.length - 1];
    const lastTrend = trend[trend.length - 1];
    let forecast = [];

    for (let i = 0; i < weeks; i++) {
        const seasonalIndex = (data.length + i) % seasonLength;
        const forecastValue = (lastLevel + (i + 1) * lastTrend) * seasonals[seasonalIndex];
        forecast.push(forecastValue);
    }

    return forecast;
}

function generateOutput(lastTimestamp, forecastValues) {
    const output = [];
    for (let i = 0; i < forecastValues.length; i++) {
        const nextTimestamp = new Date(lastTimestamp);
        nextTimestamp.setDate(lastTimestamp.getDate() + (7 * (i + 1)));
        output.push({
            timestamp: nextTimestamp.toISOString(),
            value: forecastValues[i]
        });
    }
    return output;
}
