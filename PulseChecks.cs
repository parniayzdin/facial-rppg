static class PulseChecks
{
    public static void Run(){
        foreach(double bpm in new[]{54.0,72,108,156}){var result=PulseEstimator.Estimate(Signal(bpm,bpm));Check($"synthetic {bpm} BPM",result.Bpm.HasValue&&Math.Abs(result.Bpm.Value-bpm)<2);}
        var constant=Enumerable.Range(0,660).Select(i=>new PulseSample(i/30.0,120,120,0)).ToArray();Check("flat video gives no estimate",PulseEstimator.Estimate(constant).Bpm is null);
        Check("wait for sufficient video",PulseEstimator.Estimate(Signal(72,72).Take(400).ToArray()).Status=="Collecting");
        Check("disagreeing cheek signals rejected",PulseEstimator.Estimate(Signal(72,108)).Bpm is null);
        Check("movement rejected",PulseEstimator.Estimate(Signal(72,72).Select(s=>s with{Motion=.1}).ToArray()).Bpm is null);
        var r=new Random(13);var noise=constant.Select(s=>s with{Left=120+r.NextDouble(),Right=120+r.NextDouble()}).ToArray();Check("random noise gives no estimate",PulseEstimator.Estimate(noise).Bpm is null);
        Check("out-of-band flicker rejected",PulseEstimator.Estimate(Signal(240,240)).Bpm is null);
        var flat=PulseEstimator.Estimate(constant);Check("completed flat sample explains missing BPM",flat.Bpm is null&&flat.Status=="No clear pulse yet"&&flat.Detail.Contains("too small"));
        var mismatch=PulseEstimator.Estimate(Signal(72,108));Check("cheek disagreement has an actionable reason",mismatch.Status=="Signals disagree"&&mismatch.Detail.Length>20);
        var slow=Signal(72,72).Where((_,i)=>i%3==0).ToArray();Check("slow camera is identified separately from movement",PulseEstimator.Estimate(slow).Status=="Camera too slow");
        Check("wait for full 20 seconds",PulseEstimator.Estimate(Signal(72,72).Take(600).ToArray()).Status=="Collecting");
    }
    static PulseSample[] Signal(double a,double b)=>Enumerable.Range(0,660).Select(i=>{var t=i/30.0+(i%3)*.001;return new PulseSample(t,120+.5*Math.Sin(2*Math.PI*a/60*t)+t*.02,110+.35*Math.Sin(2*Math.PI*b/60*t+.12)+t*.03,0);}).ToArray();
    static void Check(string title,bool ok){if(!ok)throw new Exception("FAIL: "+title);Console.WriteLine("PASS: "+title);}
}
