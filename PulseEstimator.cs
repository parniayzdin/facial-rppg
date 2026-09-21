using System.Numerics;
public record PulseSample(double Time,double Left,double Right,double Motion);
public record PulseResult(double? Bpm,string Status,double Seconds,double[] Wave,string Detail="",double FrameRate=0);
public static class PulseEstimator
{
    public static PulseResult Estimate(PulseSample[] input)
    {
        if(input.Length<2)return new(null,"Collecting",0,[],"Waiting for usable face samples.");
        var samples=input.Where(s=>s.Time>=input[^1].Time-25).ToArray();
        double span=samples[^1].Time-samples[0].Time;
        double fps=span>0?Math.Round((samples.Length-1)/span,1):0;
        if(fps<15&&span>=3)return new(null,"Camera too slow",span,[],"Too few camera frames. Try Chrome or Edge and close other camera apps.",fps);
        if(span<20)return new(null,"Collecting",Math.Round(span,1),[],"Keep your face inside the outline. An estimate needs a clear signal, not just 20 seconds.",fps);
        if(samples.Max(s=>s.Motion)>.045)return new(null,"Hold still",span,[],"Movement interrupted the colour signal. Keep your head still.",fps);
        for(int i=1;i<samples.Length;i++)if(samples[i].Time-samples[i-1].Time>.25)return new(null,"Camera too slow",span,[],"The video has gaps. Keep this tab visible and close other camera apps.",fps);
        int n=(int)Math.Floor(span*30);var left=new double[n];var right=new double[n];int index=0;
        for(int i=0;i<n;i++){double t=samples[0].Time+i/30.0;while(index+1<samples.Length-1&&samples[index+1].Time<t)index++;var a=samples[index];var b=samples[index+1];var f=(t-a.Time)/(b.Time-a.Time);left[i]=a.Left+(b.Left-a.Left)*f;right[i]=a.Right+(b.Right-a.Right)*f;}
        var aResult=Spectrum(left);var bResult=Spectrum(right);
        if(!aResult.Valid||!bResult.Valid){
            var failed=!aResult.Valid?aResult:bResult;
            return new(null,"No clear pulse yet",span,aResult.Wave,failed.Reason+" Still checking; face a steady light and stay still.",fps);
        }
        if(Math.Abs(aResult.Bpm-bResult.Bpm)>6)return new(null,"Signals disagree",span,aResult.Wave,"The two face patches show different rhythms. Face the camera squarely in even light. Still checking.",fps);
        return new(Math.Round((aResult.Bpm+bResult.Bpm)/2),"Experimental estimate",span,aResult.Wave,"Both face patches agree. This is an unvalidated estimate.",fps);
    }
    record Channel(bool Valid,double Bpm,double[] Wave,string Reason="");
    static Channel Spectrum(double[] data)
    {
        int n=data.Length;double mean=data.Average(),mid=(n-1)/2.0,xx=0,xy=0;
        for(int i=0;i<n;i++){xx+=(i-mid)*(i-mid);xy+=(i-mid)*(data[i]-mean);}
        for(int i=0;i<n;i++)data[i]-=mean+xy/xx*(i-mid);
        double sd=Math.Sqrt(data.Sum(x=>x*x)/n);
        var wave=Enumerable.Range(0,120).Select(i=>Math.Clamp(data[i*(n-1)/119]/Math.Max(sd*3,.001),-1,1)).ToArray();
        if(sd<.015)return new(false,0,wave,"The colour changes are too small to measure.");
        if(sd>4)return new(false,0,wave,"Large colour changes are masking the pulse.");
        int count=2048;var bins=new Complex[count];
        // Mathematical pipeline referenced from Pouya Parsa's HR_estimation.py:
        // detrend -> weighted Hamming window -> normalization -> power spectrum.
        for(int i=0;i<n;i++){double hamming=.54-.46*Math.Cos(2*Math.PI*i/(n-1));bins[i]=new Complex(data[i]*(1.4*hamming+.6)/sd,0);}
        Fft(bins);double[] power=bins.Take(count/2).Select(x=>x.Magnitude*x.Magnitude).ToArray();
        int lo=(int)Math.Ceiling(.75*count/30.0),hi=(int)Math.Floor(3*count/30.0),peak=lo;
        for(int k=lo;k<=hi;k++)if(power[k]>power[peak])peak=k;
        double inBand=0,total=0,nearPeak=0;int radius=(int)Math.Ceiling(.1*count/30.0);
        for(int k=1;k<power.Length;k++){total+=power[k];if(k>=lo&&k<=hi)inBand+=power[k];if(Math.Abs(k-peak)<=radius)nearPeak+=power[k];}
        double den=power[peak-1]-2*power[peak]+power[peak+1];double shift=Math.Abs(den)>1e-12?.5*(power[peak-1]-power[peak+1])/den:0;
        double bpm=(peak+Math.Clamp(shift,-.5,.5))*30.0/count*60;
        bool valid=inBand>0&&nearPeak/inBand>.48&&inBand/Math.Max(total,1e-9)>.55&&bpm>=45&&bpm<=180;
        return new(valid,bpm,wave,valid?"":"No consistent pulse rhythm was found above the colour noise.");
    }
    static void Fft(Complex[] data)
    {
        int n=data.Length;for(int i=1,j=0;i<n;i++){int bit=n>>1;for(;(j&bit)!=0;bit>>=1)j^=bit;j^=bit;if(i<j)(data[i],data[j])=(data[j],data[i]);}
        for(int length=2;length<=n;length<<=1){var step=Complex.FromPolarCoordinates(1,-2*Math.PI/length);for(int start=0;start<n;start+=length){var w=Complex.One;for(int j=0;j<length/2;j++){var a=data[start+j];var b=data[start+j+length/2]*w;data[start+j]=a+b;data[start+j+length/2]=a-b;w*=step;}}}
    }
}
