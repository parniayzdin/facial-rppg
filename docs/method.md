# Method and validation

## Signal extraction

MediaPipe Face Detector locates one face in the browser. Two rectangular cheek regions supply mean green-channel values. The regions remain anchored through small detector jitter; displacement or scale changes exceeding 4.5% restart collection. Frames remain in the browser. Only timestamps, colour averages, and movement values are sent to the local C# endpoint, processed in memory, and not saved.

The rolling window contains 20–25 seconds of video. Samples are linearly resampled to 30 Hz using video timestamps. Each cheek is processed independently:

1. Remove the mean and least-squares linear trend.
2. Normalize by the detrended standard deviation and apply the weighted window `1.4 × Hamming + 0.6`.
3. Zero-pad to 2048 samples and calculate FFT power.
4. Locate the strongest spectral peak from 0.75 to 3 Hz, refine it with quadratic interpolation, and convert frequency to BPM by multiplying by 60.
5. Display the rounded mean only if both cheeks pass the quality checks and agree within 6 BPM.

Zero-padding interpolates the spectrum; it does not add physiological information or improve the underlying frequency resolution of the recording.

## Quality checks

The prototype rejects insufficient video, fewer than 15 samples per second, frame gaps over 250 ms, excessive movement, and unsuitable illumination. Detrended green-channel standard deviation must lie between 0.015 and 4 pixel-intensity units. Spectral checks require more than 55% of non-DC power inside the search band and more than 48% of band power near the selected peak. The near-peak region extends approximately 0.1 Hz on either side, rounded to FFT bins.

These thresholds are engineering heuristics, not clinically calibrated confidence scores. Passing them does not establish that a detected rhythm is cardiac. The interface explains rejected estimates and continues checking; completion of the collection timer does not guarantee a BPM result. The plotted colour waveform is not an ECG.

## Reproducible checks

From the repository root:

```sh
dotnet run -- --self-test
node --test tests/tracking.test.mjs
```

Node is only required for the browser-logic tests. Synthetic signals at 54, 72, 108, and 156 BPM must produce estimates within 2 BPM. Additional cases check flat input, random noise, insufficient duration, inconsistent cheeks, motion, slow sampling, and out-of-band flicker. Browser-logic tests cover anchored patches, cumulative movement, and feedback after collection.

**No participant study or comparison with a contact reference sensor has been performed.** No real-world MAE, RMSE, or clinical accuracy is claimed. Motion, lighting, camera processing, facial hair, skin appearance, and non-skin pixels in the approximate regions can affect the estimate. The search band also prevents estimates outside 45–180 BPM. This is a research prototype, not a medical device.

## Sources and assets

- [Pouya Parsa — Heart Rate Estimation](https://github.com/pouya-parsa/heart_rate_estimation): reference for cheek colour extraction, detrending, windowing, and spectral analysis. This repository is an independent C# implementation; it does not redistribute the upstream Python source. The upstream repository has no listed reuse licence.
- [Rahman et al. (2016), Real Time Heart Rate Monitoring From Facial RGB Color Video Using Webcam](https://ep.liu.se/konferensartikel.aspx?Article_No=2&issue=129): source credited by Parsa for the RGB preprocessing figure. The README embeds the image from Parsa's repository as a labelled reference, not as a result or screenshot from this implementation. Our estimator uses green-channel signals and FFT; it does not implement the paper's ICA/PCA alternatives.
- [MediaPipe Face Detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector): the locally served runtime retains its [Apache 2.0 licence](../wwwroot/vendor/vision/LICENSE.txt). The BlazeFace short-range model comes from the [official MediaPipe model distribution](https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite).
