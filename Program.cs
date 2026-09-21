using Microsoft.AspNetCore.StaticFiles;
if(args.Contains("--self-test")){PulseChecks.Run();return;}
var builder=WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5197");
builder.WebHost.ConfigureKestrel(o=>o.Limits.MaxRequestBodySize=150_000);
var app=builder.Build();
var types=new FileExtensionContentTypeProvider();types.Mappings[".tflite"]="application/octet-stream";
app.UseDefaultFiles();app.UseStaticFiles(new StaticFileOptions{ContentTypeProvider=types});
app.MapPost("/api/estimate",(PulseSample[] samples)=>{
    if(samples.Length>1200||samples.Any(s=>s is null||!double.IsFinite(s.Time)||!double.IsFinite(s.Left)||!double.IsFinite(s.Right)||!double.IsFinite(s.Motion)||s.Left is <0 or >255||s.Right is <0 or >255||s.Time<0||s.Motion<0))return Results.BadRequest();
    for(int i=1;i<samples.Length;i++)if(samples[i].Time<=samples[i-1].Time)return Results.BadRequest();
    return Results.Ok(PulseEstimator.Estimate(samples));
});
app.Run();
