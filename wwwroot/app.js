import {FaceDetector,FilesetResolver} from './vendor/vision/vision_bundle.mjs';
import {lockFacePatch,displayEstimate} from './pulse-tracking.mjs?v=1';
const $=id=>document.getElementById(id),video=$('video'),overlay=$('overlay'),pen=overlay.getContext('2d'),plot=$('signal').getContext('2d');
const capture=document.createElement('canvas'),pixels=capture.getContext('2d',{willReadFrequently:true});
let detector,stream=null,active=false,token=0,version=0,frameId=0,lastFrame=-1,lastDetection=0,box=null,motion=0,samples=[],lastSend=0,posting=false,failures=0,lastResult=null,lastPlot=0,lastArrival=0,watchdog=null,stalled=false;
function status(text){$('status').textContent=text;}
function hint(text){$('hint').textContent=text;}
function message(text){$('error').textContent=text;$('error').hidden=!text;}
function wave(values=[]){plot.clearRect(0,0,460,110);plot.strokeStyle='#dce3d6';plot.lineWidth=1;plot.beginPath();plot.moveTo(0,55);plot.lineTo(460,55);plot.stroke();if(!values.length)return;plot.strokeStyle='#86a57e';plot.lineWidth=1.6;plot.beginPath();values.forEach((x,i)=>{const y=55-x*42;i?plot.lineTo(i/(values.length-1)*460,y):plot.moveTo(0,y);});plot.stroke();}
function resetSignal(text,detail='Face a steady light and keep your head still.'){version++;samples=[];lastResult=null;$('bpm').textContent='—';$('progress').value=0;status(text);hint(detail);wave();}
function stop(text='Camera off'){
    active=false;token++;clearInterval(watchdog);watchdog=null;if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frameId);else cancelAnimationFrame(frameId);
    stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;box=null;pen.clearRect(0,0,overlay.width,overlay.height);$('empty').hidden=false;$('tracking').textContent='Camera off';$('start').textContent='Start camera';resetSignal(text);
}
async function start(){
    if(active){stop();return;}active=true;const run=++token;$('start').textContent='Cancel';message('');status('Allow camera access…');
    try{
        const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30}},audio:false});
        if(run!==token){acquired.getTracks().forEach(t=>t.stop());return;}stream=acquired;video.srcObject=acquired;await video.play();if(run!==token)return;
        capture.width=overlay.width=video.videoWidth;capture.height=overlay.height=video.videoHeight;video.parentElement.style.aspectRatio=`${video.videoWidth}/${video.videoHeight}`;$('empty').hidden=true;$('start').textContent='Stop camera';lastFrame=-1;lastDetection=0;lastSend=0;failures=0;resetSignal('Finding your face…');
        lastArrival=performance.now();stalled=false;
        watchdog=setInterval(()=>{if(run===token&&active&&performance.now()-lastArrival>2000&&!stalled){stalled=true;box=null;resetSignal('Camera paused','No new video frames. Close other camera apps, or stop and restart the camera.');}},500);
        acquired.getVideoTracks()[0].addEventListener('ended',()=>{if(run===token)stop('Camera disconnected');});schedule(run);
    }catch(error){if(run!==token)return;stop('Camera unavailable');message(error.name==='NotAllowedError'?'Allow camera access to try the preview. If the in-app browser blocks it, open http://localhost:5197 in Chrome or Edge.':`Could not start camera: ${error.message}`);}
}
function schedule(run){if(!active||run!==token)return;if(video.requestVideoFrameCallback)frameId=video.requestVideoFrameCallback((now,metadata)=>frame(now,metadata.mediaTime,run));else frameId=requestAnimationFrame(now=>frame(now,video.currentTime,run));}
function region(x,y,w,h){return {x:Math.max(0,Math.round(x)),y:Math.max(0,Math.round(y)),w:Math.max(1,Math.round(w)),h:Math.max(1,Math.round(h))};}
function average(r){if(r.x+r.w>capture.width||r.y+r.h>capture.height)return null;const data=pixels.getImageData(r.x,r.y,r.w,r.h).data;let green=0,light=0,clipped=0;for(let i=0;i<data.length;i+=4){green+=data[i+1];const l=(data[i]+data[i+1]+data[i+2])/3;light+=l;if(l<12||l>246)clipped++;}const count=data.length/4;return {green:green/count,light:light/count,clipped:clipped/count};}
async function estimate(run){
    if(posting||samples.length<2)return;posting=true;const revision=version;
    try{const response=await fetch('/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(samples),signal:AbortSignal.timeout(4000)});if(!response.ok)throw new Error('Estimator unavailable');const result=await response.json();if(run!==token||revision!==version)return;
        lastResult=result;const display=displayEstimate(result);$('bpm').textContent=display.bpm;status(display.status);hint(display.detail);if(result.wave.length)wave(result.wave);failures=0;
    }catch(error){if(run===token&&revision===version){$('bpm').textContent='—';status('Estimator disconnected');hint('The local server is not responding. Reconnecting…');if(++failures>=3){stop('Estimator disconnected');message('The local C# server stopped responding. Restart the preview and try again.');}}}finally{posting=false;}
}
function frame(now,mediaTime,run){
    if(!active||run!==token)return;
    try{
        if(mediaTime===lastFrame){schedule(run);return;}
        if(lastFrame>=0&&(mediaTime-lastFrame>.25||mediaTime<lastFrame)){box=null;resetSignal('Video interrupted','Starting a fresh sample because the camera skipped frames.');}
        lastFrame=mediaTime;lastArrival=now;stalled=false;pen.clearRect(0,0,overlay.width,overlay.height);
        if(now-lastDetection>90){
            lastDetection=now;const detections=detector.detectForVideo(video,now).detections;
            if(detections.length!==1){box=null;resetSignal(detections.length?'One person at a time':'Face not found');$('tracking').textContent='Looking for face';schedule(run);return;}
            const tracked=lockFacePatch(box,detections[0].boundingBox);
            motion=tracked.motion;box=tracked.box;
            if(tracked.restarted){resetSignal('Face moved · starting again','The face moved outside the fixed patches. Keep your head still while the sample rebuilds.');schedule(run);return;}
        }
        if(!box){schedule(run);return;}
        const {originX:x,originY:y,width:w,height:h}=box;
        if(w<110||x<0||y<0||x+w>capture.width||y+h>capture.height){resetSignal('Move closer and centre your face');schedule(run);return;}
        const left=region(x+w*.16,y+h*.48,w*.18,h*.14),right=region(x+w*.66,y+h*.48,w*.18,h*.14);
        pen.strokeStyle='#e5f4d7';pen.lineWidth=1.5;pen.strokeRect(x,y,w,h);pen.strokeStyle='#a9ce8e';for(const r of [left,right]){pen.fillStyle='#b9d7a820';pen.fillRect(r.x,r.y,r.w,r.h);pen.strokeRect(r.x,r.y,r.w,r.h);}
        pixels.drawImage(video,0,0,capture.width,capture.height);const a=average(left),b=average(right);
        if(!a||!b||Math.min(a.light,b.light)<30||Math.max(a.light,b.light)>230||Math.max(a.clipped,b.clipped)>.08){resetSignal('Use soft, even light');schedule(run);return;}
        if(motion>.045){schedule(run);return;}
        samples.push({time:mediaTime,left:a.green,right:b.green,motion});while(samples.length&&samples[0].time<mediaTime-25)samples.shift();if(samples.length>1200)samples.shift();
        const seconds=samples.length>1?mediaTime-samples[0].time:0;$('progress').value=Math.min(20,seconds);$('tracking').textContent='Face detected';
        if(!lastResult||lastResult.status==='Collecting'){
            status(seconds<20?`Collecting · ${Math.floor(seconds)}/20 seconds`:'Checking pulse signal…');
            if(seconds>=20)hint('The sample is ready. Checking whether both face patches contain a clear pulse.');
            if(now-lastPlot>200&&samples.length>8){lastPlot=now;const recent=samples.slice(-120).map(s=>s.left),mean=recent.reduce((a,b)=>a+b)/recent.length,scale=Math.max(.015,Math.sqrt(recent.reduce((a,b)=>a+(b-mean)**2,0)/recent.length)*3);wave(recent.map(value=>Math.max(-1,Math.min(1,(value-mean)/scale))));}
        }
        if(now-lastSend>1500){lastSend=now;estimate(run);}
    }catch(error){stop('Camera processing stopped');message(`Could not process the video: ${error.message}`);return;}
    schedule(run);
}
$('start').addEventListener('click',start);window.addEventListener('pagehide',()=>{stop();detector?.close();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)stop('Paused while tab was hidden');});wave();
try{const files=await FilesetResolver.forVisionTasks('/vendor/vision/wasm');detector=await FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:'/models/blaze_face_short_range.tflite',delegate:'CPU'},runningMode:'VIDEO',minDetectionConfidence:.75});$('start').disabled=false;status('Ready when you are');}
catch(error){status('Face detector unavailable');message(`Try opening this preview in Chrome or Edge. ${error.message}`);}
