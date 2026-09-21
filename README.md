<h1 align="center">Facial rPPG</h1>
<p align="center"><em>Webcam-based pulse estimation through facial colour signals.</em></p>

An experimental remote photoplethysmography (rPPG) prototype built with **C# / ASP.NET Core** and **MediaPipe**. It estimates pulse frequency from small changes in the mean green-channel intensity of two facial regions.

## Method

1. Detect the face and sample two stable cheek regions.
2. Collect 20–25 seconds of video, resample by timestamp, and detrend the signals.
3. Apply a window and FFT, then search for a dominant frequency between 0.75 and 3 Hz.
4. Convert frequency to BPM and display an estimate only when both regions pass quality checks and agree.

**Heart rate (BPM) = dominant frequency (Hz) × 60.**

<p align="center">
  <img src="https://raw.githubusercontent.com/pouya-parsa/heart_rate_estimation/7fa4c8b7156909ebadff501d58910ddfb6821e49/readme/preprocess.png" alt="Reference figure showing facial RGB frames, extracted colour signals, and preprocessing stages" width="520">
</p>

*Reference figure: RGB preprocessing from [Rahman et al. (2016)](https://ep.liu.se/konferensartikel.aspx?Article_No=2&issue=129), linked from [Pouya Parsa’s project](https://github.com/pouya-parsa/heart_rate_estimation). This implementation uses the green channel; the figure illustrates the broader RGB approach.*

## Validation

Synthetic checks cover known pulse frequencies, noise, movement, slow video, and disagreement between face regions. **Real-camera accuracy has not been validated against a reference sensor.** A completed timer does not guarantee a readable signal. This prototype is not a medical device.

<details>
<summary><strong>Run it locally</strong></summary>

Install the **.NET 10 SDK**, then run from the repository root:

```sh
dotnet run --project PulsePreview.csproj
```

Open [Pulse](http://localhost:5197/) in Chrome or Edge. Click **Start camera**, face steady light, and hold still for at least 20 seconds. Video stays in the browser; colour samples are processed locally without storage.

[Method, tests, limitations, and credits](docs/method.md)

</details>
